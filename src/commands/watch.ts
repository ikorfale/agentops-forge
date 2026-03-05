/**
 * watch.ts — Continuous health monitor with alerting
 *
 * Runs recurring health checks at a configurable interval and emits
 * structured alerts when service status changes (ok → degraded/down
 * or recovery). Designed for autonomous agent uptime awareness.
 *
 * Usage (CLI):
 *   agentops-forge watch --interval 60 --target all
 *   agentops-forge watch --interval 30 --target a2a --once
 *
 * Usage (API):
 *   import { watchCmd } from "./commands/watch.js";
 *   const result = await watchCmd({ target: "all", intervalSec: 60, once: true });
 */

import { makeReport } from "../core/report.js";
import { healthCmd, HealthTarget, ServiceCheck } from "./health.js";

// ─── types ───────────────────────────────────────────────────────────────────

export interface WatchConfig {
  target: HealthTarget;
  intervalSec: number;
  /** Run once and return (non-daemon mode, used by CLI --once flag) */
  once?: boolean;
  /** Max number of cycles in daemon mode before self-terminating (safety) */
  maxCycles?: number;
  /** Callback invoked on each alert; defaults to console.error */
  onAlert?: (alert: WatchAlert) => void;
}

export interface WatchAlert {
  ts: string;
  service: string;
  prevStatus: ServiceCheck["status"] | "unknown";
  newStatus: ServiceCheck["status"];
  detail?: string;
  url: string;
}

export interface WatchCycleSummary {
  cycle: number;
  ts: string;
  target: HealthTarget;
  healthy: number;
  degraded: number;
  down: number;
  alerts: WatchAlert[];
  durationMs: number;
}

export interface WatchData {
  target: HealthTarget;
  intervalSec: number;
  cycles: WatchCycleSummary[];
  totalAlerts: number;
}

// ─── state tracking ──────────────────────────────────────────────────────────

type StatusMap = Record<string, ServiceCheck["status"]>;

function diffStatuses(
  prev: StatusMap,
  current: ServiceCheck[]
): WatchAlert[] {
  const alerts: WatchAlert[] = [];
  for (const check of current) {
    const prevStatus = prev[check.service] ?? "unknown";
    if (prevStatus !== check.status) {
      alerts.push({
        ts: new Date().toISOString(),
        service: check.service,
        prevStatus,
        newStatus: check.status,
        detail: check.detail,
        url: check.url,
      });
    }
  }
  return alerts;
}

// ─── main entry ──────────────────────────────────────────────────────────────

export async function watchCmd(
  config: WatchConfig
): Promise<ReturnType<typeof makeReport<WatchData>>> {
  const started = Date.now();
  const {
    target,
    intervalSec,
    once = false,
    maxCycles = 100,
    onAlert = (a) =>
      console.error(
        `[watch:alert] ${a.ts} ${a.service} ${a.prevStatus} → ${a.newStatus}${a.detail ? ` (${a.detail})` : ""}`
      ),
  } = config;

  const cycles: WatchCycleSummary[] = [];
  const prevStatuses: StatusMap = {};
  let totalAlerts = 0;
  let cycleNum = 0;

  const runCycle = async (): Promise<void> => {
    const cycleStart = Date.now();
    cycleNum++;

    const healthReport = await healthCmd(target);
    const checks = healthReport.data.checks;

    const alerts = diffStatuses(prevStatuses, checks);
    for (const alert of alerts) {
      onAlert(alert);
      totalAlerts++;
    }

    // Update state
    for (const check of checks) {
      prevStatuses[check.service] = check.status;
    }

    const summary: WatchCycleSummary = {
      cycle: cycleNum,
      ts: new Date().toISOString(),
      target,
      healthy: healthReport.data.healthy,
      degraded: healthReport.data.degraded,
      down: healthReport.data.down,
      alerts,
      durationMs: Date.now() - cycleStart,
    };

    cycles.push(summary);
  };

  if (once) {
    await runCycle();
  } else {
    // Daemon loop — runs until maxCycles or process signal
    const intervalMs = intervalSec * 1000;
    let running = true;

    // Allow graceful shutdown on SIGINT/SIGTERM
    const stop = () => { running = false; };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);

    while (running && cycleNum < maxCycles) {
      await runCycle();
      if (!running || cycleNum >= maxCycles) break;
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }

  const hasProblems = cycles.some((c) => c.down > 0);
  const status = hasProblems ? "partial" : "ok";
  const errors = cycles
    .flatMap((c) => c.alerts)
    .filter((a) => a.newStatus === "down")
    .map((a) => `${a.service} went DOWN at ${a.ts}: ${a.detail ?? "no detail"}`);
  const warnings = cycles
    .flatMap((c) => c.alerts)
    .filter((a) => a.newStatus === "degraded")
    .map((a) => `${a.service} degraded at ${a.ts}: ${a.detail ?? "no detail"}`);

  return makeReport<WatchData>(
    "watch",
    started,
    status,
    { target, intervalSec, cycles, totalAlerts },
    warnings,
    errors
  );
}

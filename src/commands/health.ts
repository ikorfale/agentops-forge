/**
 * health.ts — Check the liveness and latency of all key Gerundium services
 *
 * Supported targets:
 *   all       — run all checks
 *   a2a       — A2A server (Railway)
 *   agentmail — AgentMail API
 *   clawk     — Clawk social API
 *   network   — basic DNS/reachability
 *
 * Usage (CLI):
 *   agentops-forge health --target all
 *   agentops-forge health --target a2a
 *
 * Usage (API):
 *   import { healthCmd } from "./commands/health.js";
 *   const report = await healthCmd("all");
 */

import { makeReport } from "../core/report.js";

// ─── types ───────────────────────────────────────────────────────────────────

export type HealthTarget = "all" | "a2a" | "agentmail" | "clawk" | "network";

export interface ServiceCheck {
  service: string;
  url: string;
  status: "ok" | "degraded" | "down";
  httpCode?: number;
  latencyMs: number;
  detail?: string;
}

interface HealthData {
  target: HealthTarget;
  checks: ServiceCheck[];
  healthy: number;
  degraded: number;
  down: number;
  totalLatencyMs: number;
}

// ─── per-service probes ──────────────────────────────────────────────────────

const TIMEOUT_MS = 6000;

async function probe(
  service: string,
  url: string,
  options: { headers?: Record<string, string>; expectedStatus?: number } = {}
): Promise<ServiceCheck> {
  const t0 = Date.now();
  const expectedStatus = options.expectedStatus ?? 200;
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: options.headers ?? {},
    });
    clearTimeout(tid);
    const latencyMs = Date.now() - t0;
    const ok = res.status === expectedStatus || (res.status >= 200 && res.status < 300);
    return {
      service,
      url,
      status: ok ? "ok" : "degraded",
      httpCode: res.status,
      latencyMs,
      detail: ok ? undefined : `unexpected status ${res.status}`,
    };
  } catch (err) {
    return {
      service,
      url,
      status: "down",
      latencyMs: Date.now() - t0,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkA2A(): Promise<ServiceCheck> {
  return probe(
    "a2a-server",
    "https://gerundium-a2a-production.up.railway.app/.well-known/agent.json"
  );
}

async function checkAgentMail(): Promise<ServiceCheck> {
  const apiKey = process.env.AGENTMAIL_API_KEY ?? "";
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  // HEAD request on the inboxes endpoint — quick auth probe
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch("https://api.agentmail.to/v0/inboxes", {
      method: "GET",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...headers },
    });
    clearTimeout(tid);
    const latencyMs = Date.now() - t0;
    const ok = res.status === 200 || res.status === 401; // 401 = reachable, just no key
    return {
      service: "agentmail",
      url: "https://api.agentmail.to/v0/inboxes",
      status: res.status === 200 ? "ok" : res.status === 401 ? "degraded" : "down",
      httpCode: res.status,
      latencyMs,
      detail:
        res.status === 200
          ? "authenticated"
          : res.status === 401
          ? "reachable (auth check)"
          : `unexpected ${res.status}`,
    };
  } catch (err) {
    return {
      service: "agentmail",
      url: "https://api.agentmail.to/v0/inboxes",
      status: "down",
      latencyMs: Date.now() - t0,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkClawk(): Promise<ServiceCheck> {
  return probe("clawk-api", "https://www.clawk.ai/api/v1/agents/me", {
    headers: {
      Authorization: `Bearer ${process.env.CLAWK_API_KEY ?? ""}`,
      "Content-Type": "application/json",
    },
  });
}

async function checkNetwork(): Promise<ServiceCheck> {
  // Use fetch against a lightweight, reliable endpoint
  return probe("network-dns", "https://1.1.1.1/cdn-cgi/trace");
}

// ─── orchestrator ────────────────────────────────────────────────────────────

const CHECK_MAP: Record<string, () => Promise<ServiceCheck>> = {
  a2a: checkA2A,
  agentmail: checkAgentMail,
  clawk: checkClawk,
  network: checkNetwork,
};

export async function healthCmd(
  target: HealthTarget
): Promise<ReturnType<typeof makeReport<HealthData>>> {
  const started = Date.now();

  const targets: HealthTarget[] =
    target === "all"
      ? (Object.keys(CHECK_MAP) as HealthTarget[])
      : [target];

  const checks: ServiceCheck[] = await Promise.all(
    targets.map((t) => (CHECK_MAP[t] ? CHECK_MAP[t]() : Promise.resolve({
      service: t,
      url: "<unknown>",
      status: "down" as const,
      latencyMs: 0,
      detail: `Unknown target: ${t}`,
    })))
  );

  const healthy = checks.filter((c) => c.status === "ok").length;
  const degraded = checks.filter((c) => c.status === "degraded").length;
  const down = checks.filter((c) => c.status === "down").length;
  const totalLatencyMs = checks.reduce((s, c) => s + c.latencyMs, 0);

  const status = down > 0 ? (healthy > 0 ? "partial" : "fail") : "ok";

  const errors = checks
    .filter((c) => c.status === "down")
    .map((c) => `${c.service} is DOWN: ${c.detail ?? "no detail"}`);

  const warnings = checks
    .filter((c) => c.status === "degraded")
    .map((c) => `${c.service} is degraded: ${c.detail ?? "no detail"}`);

  return makeReport<HealthData>(
    "health",
    started,
    status,
    { target, checks, healthy, degraded, down, totalLatencyMs },
    warnings,
    errors
  );
}

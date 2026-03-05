import {
  dagCmd,
  discoverCmd,
  guardCmd,
  handoffCmd,
  healthCmd,
  listCheckpoints,
  listCheckpointsSummary,
  makeReport,
  outreachCmd,
  parseDagStepSpec,
  parseStepSpec,
  receiptCmd,
  receiptListCmd,
  receiptVerifyCmd,
  replayCmd,
  socialCmd,
  workflowCmd
} from "./chunk-H5QNA3ED.js";

// src/commands/watch.ts
function diffStatuses(prev, current) {
  const alerts = [];
  for (const check of current) {
    const prevStatus = prev[check.service] ?? "unknown";
    if (prevStatus !== check.status) {
      alerts.push({
        ts: (/* @__PURE__ */ new Date()).toISOString(),
        service: check.service,
        prevStatus,
        newStatus: check.status,
        detail: check.detail,
        url: check.url
      });
    }
  }
  return alerts;
}
async function watchCmd(config) {
  const started = Date.now();
  const {
    target,
    intervalSec,
    once = false,
    maxCycles = 100,
    onAlert = (a) => console.error(
      `[watch:alert] ${a.ts} ${a.service} ${a.prevStatus} \u2192 ${a.newStatus}${a.detail ? ` (${a.detail})` : ""}`
    )
  } = config;
  const cycles = [];
  const prevStatuses = {};
  let totalAlerts = 0;
  let cycleNum = 0;
  const runCycle = async () => {
    const cycleStart = Date.now();
    cycleNum++;
    const healthReport = await healthCmd(target);
    const checks = healthReport.data.checks;
    const alerts = diffStatuses(prevStatuses, checks);
    for (const alert of alerts) {
      onAlert(alert);
      totalAlerts++;
    }
    for (const check of checks) {
      prevStatuses[check.service] = check.status;
    }
    const summary = {
      cycle: cycleNum,
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      target,
      healthy: healthReport.data.healthy,
      degraded: healthReport.data.degraded,
      down: healthReport.data.down,
      alerts,
      durationMs: Date.now() - cycleStart
    };
    cycles.push(summary);
  };
  if (once) {
    await runCycle();
  } else {
    const intervalMs = intervalSec * 1e3;
    let running = true;
    const stop = () => {
      running = false;
    };
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
  const errors = cycles.flatMap((c) => c.alerts).filter((a) => a.newStatus === "down").map((a) => `${a.service} went DOWN at ${a.ts}: ${a.detail ?? "no detail"}`);
  const warnings = cycles.flatMap((c) => c.alerts).filter((a) => a.newStatus === "degraded").map((a) => `${a.service} degraded at ${a.ts}: ${a.detail ?? "no detail"}`);
  return makeReport(
    "watch",
    started,
    status,
    { target, intervalSec, cycles, totalAlerts },
    warnings,
    errors
  );
}
export {
  dagCmd,
  discoverCmd,
  guardCmd,
  handoffCmd,
  listCheckpoints,
  listCheckpointsSummary,
  outreachCmd,
  parseDagStepSpec,
  parseStepSpec,
  receiptCmd,
  receiptListCmd,
  receiptVerifyCmd,
  replayCmd,
  socialCmd,
  watchCmd,
  workflowCmd
};

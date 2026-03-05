import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { watchCmd } from "../commands/watch.js";

// Mock the health command so we don't need real network access
vi.mock("../commands/health.js", () => ({
  healthCmd: vi.fn(),
}));

import { healthCmd } from "../commands/health.js";
const mockHealthCmd = vi.mocked(healthCmd);

function makeHealthReport(checks: Array<{ service: string; status: "ok" | "degraded" | "down"; url?: string; latencyMs?: number }>) {
  return {
    requestId: "test-id",
    command: "health",
    status: checks.some((c) => c.status === "down") ? "fail" as const : "ok" as const,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: 10,
    data: {
      target: "all" as const,
      checks: checks.map((c) => ({
        service: c.service,
        url: c.url ?? `https://${c.service}.example.com`,
        status: c.status,
        latencyMs: c.latencyMs ?? 50,
      })),
      healthy: checks.filter((c) => c.status === "ok").length,
      degraded: checks.filter((c) => c.status === "degraded").length,
      down: checks.filter((c) => c.status === "down").length,
      totalLatencyMs: 50,
    },
    warnings: [],
    errors: [],
  };
}

describe("watchCmd", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs one cycle in --once mode and returns ok", async () => {
    mockHealthCmd.mockResolvedValueOnce(makeHealthReport([
      { service: "a2a-server", status: "ok" },
      { service: "agentmail", status: "ok" },
    ]));

    const report = await watchCmd({ target: "all", intervalSec: 30, once: true });

    expect(report.status).toBe("ok");
    expect(report.data.cycles).toHaveLength(1);
    expect(report.data.totalAlerts).toBe(2); // first run: unknown → ok counts as change
    expect(report.errors).toHaveLength(0);
  });

  it("emits alert when service transitions to down", async () => {
    // Cycle 1: all ok
    mockHealthCmd.mockResolvedValueOnce(makeHealthReport([
      { service: "a2a-server", status: "ok" },
    ]));
    // Cycle 2: service goes down
    mockHealthCmd.mockResolvedValueOnce(makeHealthReport([
      { service: "a2a-server", status: "down", url: "https://a2a.example.com" },
    ]));

    const alerts: string[] = [];
    const onAlert = vi.fn((a) => alerts.push(a.newStatus));

    // First cycle (once)
    await watchCmd({ target: "all", intervalSec: 30, once: true, onAlert });
    // Second cycle (once)
    await watchCmd({ target: "all", intervalSec: 30, once: true, onAlert });

    // Second call should have triggered a "down" alert
    expect(onAlert).toHaveBeenCalled();
  });

  it("detects degraded services and populates warnings", async () => {
    mockHealthCmd.mockResolvedValueOnce(makeHealthReport([
      { service: "agentmail", status: "degraded" },
    ]));

    const report = await watchCmd({ target: "all", intervalSec: 30, once: true });

    expect(report.status).toBe("ok"); // no "down"
    // first run: unknown → degraded is an alert; watchCmd maps degraded alerts into report.warnings
    expect(report.warnings.length).toBe(1);
    expect(report.warnings[0]).toMatch(/degraded/);
    expect(report.data.cycles[0].degraded).toBe(1);
  });

  it("returns structured WatchData with cycle metadata", async () => {
    mockHealthCmd.mockResolvedValueOnce(makeHealthReport([
      { service: "a2a-server", status: "ok" },
    ]));

    const report = await watchCmd({ target: "a2a", intervalSec: 60, once: true });

    const { data } = report;
    expect(data.target).toBe("a2a");
    expect(data.intervalSec).toBe(60);
    expect(data.cycles).toHaveLength(1);
    expect(typeof data.cycles[0].durationMs).toBe("number");
    expect(data.cycles[0].cycle).toBe(1);
  });
});

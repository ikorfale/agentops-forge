import { describe, it, expect, vi, beforeEach } from "vitest";
import { healthCmd } from "../commands/health.js";

// Lightweight mock for fetch — avoids real network calls in CI
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
});

function makeFetchOk(status = 200): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status }));
}

function makeFetchError(message: string): Promise<never> {
  return Promise.reject(new Error(message));
}

describe("healthCmd", () => {
  it("returns ok when all services respond 200", async () => {
    mockFetch.mockResolvedValue(makeFetchOk(200));
    const report = await healthCmd("all");
    expect(report.status).toBe("ok");
    expect(report.data.healthy).toBe(4);
    expect(report.data.down).toBe(0);
  });

  it("returns fail when all services are down", async () => {
    mockFetch.mockRejectedValue(new Error("connection refused"));
    const report = await healthCmd("all");
    expect(report.status).toBe("fail");
    expect(report.data.down).toBe(4);
    expect(report.errors.length).toBe(4);
  });

  it("returns partial when some services are down", async () => {
    let call = 0;
    mockFetch.mockImplementation(() => {
      call++;
      if (call === 2) return makeFetchError("timeout");
      return makeFetchOk(200);
    });
    const report = await healthCmd("all");
    expect(report.status).toBe("partial");
    expect(report.data.healthy).toBeGreaterThan(0);
    expect(report.data.down).toBeGreaterThan(0);
  });

  it("single-target check returns service-specific result", async () => {
    mockFetch.mockResolvedValue(makeFetchOk(200));
    const report = await healthCmd("a2a");
    expect(report.status).toBe("ok");
    expect(report.data.checks).toHaveLength(1);
    expect(report.data.checks[0].service).toBe("a2a-server");
  });

  it("handles unknown target gracefully", async () => {
    // No fetch needed — unknown target short-circuits
    const report = await healthCmd("unknown" as any);
    expect(report.status).toBe("fail");
    expect(report.data.checks[0].status).toBe("down");
    expect(report.data.checks[0].detail).toContain("Unknown target");
  });

  it("degraded status when agentmail returns 401", async () => {
    mockFetch.mockResolvedValue(makeFetchOk(401));
    const report = await healthCmd("agentmail");
    expect(report.data.checks[0].status).toBe("degraded");
    expect(report.data.degraded).toBe(1);
    // degraded alone → overall ok (no down)
    expect(report.status).toBe("ok");
  });

  it("includes durationMs in the report", async () => {
    mockFetch.mockResolvedValue(makeFetchOk(200));
    const report = await healthCmd("network");
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
  });
});

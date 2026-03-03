import { describe, it, expect } from "vitest";
import { guardCmd } from "../commands/guard.js";

describe("guardCmd", () => {
  it("env guard returns a report with checks", async () => {
    const report = await guardCmd("env");
    expect(report.command).toBe("guard");
    expect(Array.isArray(report.data.checks)).toBe(true);
    expect(report.data.checks.length).toBeGreaterThan(0);
    expect(report.data.passed + report.data.failed).toBe(report.data.checks.length);
  });

  it("files guard passes when workspace files exist", async () => {
    const report = await guardCmd("files");
    expect(report.command).toBe("guard");
    // SOUL.md, MEMORY.md, TOOLS.md all present in workspace
    const soulCheck = report.data.checks.find((c) => c.name === "file:SOUL.md");
    expect(soulCheck?.passed).toBe(true);
  });

  it("unknown guard kind returns a generic pass", async () => {
    const report = await guardCmd("my-custom-check");
    expect(report.status).toBe("ok");
    expect(report.data.checks[0]?.passed).toBe(true);
  });

  it("schema guard always passes", async () => {
    const report = await guardCmd("schema");
    expect(report.status).toBe("ok");
  });
});

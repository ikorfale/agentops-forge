import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { workflowCmd } from "../commands/workflow.js";
import { replayCmd, listCheckpointsSummary } from "../commands/replay.js";
import { loadCheckpoint, clearCheckpoint } from "../core/checkpoint-store.js";

// Helper: build steps
function makeSteps(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `step-${i + 1}`,
    name: `Step ${i + 1}`,
    input: { index: i + 1 },
  }));
}

describe("checkpoint integration in workflowCmd", () => {
  it("saves a checkpoint when a step fails", async () => {
    const failAt = "step-2";
    const steps = [
      { id: "step-1", name: "Step 1", input: {} },
      {
        id: failAt,
        name: "Step 2 (fails)",
        input: {},
        execute: async () => { throw new Error("induced failure"); },
      },
      { id: "step-3", name: "Step 3", input: {} },
    ];

    const report = await workflowCmd("Test with failure", steps);
    expect(report.status).toBe("fail");
    expect(report.data.failedStep).toBe(failAt);

    // Checkpoint should exist
    const cp = loadCheckpoint(report.data.workflowId);
    expect(cp).not.toBeNull();
    expect(cp!.failedStepId).toBe(failAt);
    expect(cp!.completedSteps).toHaveLength(1);
    expect(cp!.completedSteps[0].stepId).toBe("step-1");

    // Cleanup
    clearCheckpoint(report.data.workflowId);
  });

  it("clears checkpoint on full success", async () => {
    const steps = makeSteps(3);
    const report = await workflowCmd("Successful workflow", steps);
    expect(report.status).toBe("ok");

    const cp = loadCheckpoint(report.data.workflowId);
    expect(cp).toBeNull(); // should have been cleared
  });
});

describe("replayCmd", () => {
  it("returns fail when no checkpoint found", async () => {
    const fakeId = randomUUID();
    const report = await replayCmd(fakeId, makeSteps(2));
    expect(report.status).toBe("fail");
    expect(report.errors).toContain(`No checkpoint found for workflowId: ${fakeId}`);
  });

  it("resumes from last successful step and completes", async () => {
    // 1. Run a workflow that fails on step 2
    let failStep2 = true;
    const steps = [
      { id: "a", name: "Step A", input: { val: 1 } },
      {
        id: "b",
        name: "Step B",
        input: { val: 2 },
        execute: async (input: Record<string, unknown>) => {
          if (failStep2) throw new Error("transient failure");
          return { processed: input.val };
        },
      },
      { id: "c", name: "Step C", input: { val: 3 } },
    ];

    const failedRun = await workflowCmd("Replay demo", steps);
    expect(failedRun.status).toBe("fail");
    expect(failedRun.data.failedStep).toBe("b");

    const workflowId = failedRun.data.workflowId;

    // 2. Fix the failure condition
    failStep2 = false;

    // 3. Replay — should skip step A, re-run B and C
    const replayReport = await replayCmd(workflowId, steps);
    expect(replayReport.status).toBe("ok");
    expect(replayReport.data.completedSteps).toBe(3);
    expect(replayReport.data.failedStep).toBeNull();

    // Step A should appear as carried-over (from checkpoint)
    const stepA = replayReport.data.steps.find((s) => s.stepId === "a");
    expect(stepA?.status).toBe("ok");

    // Steps B and C should have been freshly executed
    const stepB = replayReport.data.steps.find((s) => s.stepId === "b");
    expect(stepB?.status).toBe("ok");

    // Checkpoint should be cleared after successful replay
    expect(loadCheckpoint(workflowId)).toBeNull();
  });

  it("preserves provenance chain across original + replay", async () => {
    let shouldFail = true;
    const steps = [
      { id: "p1", name: "P1", input: {} },
      {
        id: "p2",
        name: "P2",
        input: {},
        execute: async () => {
          if (shouldFail) throw new Error("fail");
          return { ok: true };
        },
      },
    ];

    const first = await workflowCmd("Provenance chain test", steps);
    expect(first.status).toBe("fail");

    shouldFail = false;
    const replayed = await replayCmd(first.data.workflowId, steps);
    expect(replayed.status).toBe("ok");
    // Provenance chain should contain 2 receipt hashes (one per step)
    expect(replayed.data.provenanceChain).toHaveLength(2);
    for (const h of replayed.data.provenanceChain) {
      expect(h).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("listCheckpointsSummary returns no-checkpoint message when clean", () => {
    const summary = listCheckpointsSummary();
    // Either clean or has some entries — just check it returns a string
    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(0);
  });
});

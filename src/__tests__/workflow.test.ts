import { describe, it, expect } from "vitest";
import { workflowCmd, parseStepSpec } from "../commands/workflow.js";

describe("parseStepSpec", () => {
  it("parses id:name format", () => {
    const s = parseStepSpec("step-1:Do the thing");
    expect(s.id).toBe("step-1");
    expect(s.name).toBe("Do the thing");
  });

  it("uses id as name when no colon", () => {
    const s = parseStepSpec("check");
    expect(s.id).toBe("check");
    expect(s.name).toBe("check");
  });
});

describe("workflowCmd", () => {
  it("runs a 3-step workflow and emits provenance chain", async () => {
    const steps = [
      { id: "s1", name: "Step 1", input: { x: 1 } },
      { id: "s2", name: "Step 2", input: { x: 2 } },
      { id: "s3", name: "Step 3", input: { x: 3 } },
    ];
    const report = await workflowCmd("Test goal", steps);
    expect(report.status).toBe("ok");
    expect(report.data.completedSteps).toBe(3);
    expect(report.data.failedStep).toBeNull();
    expect(report.data.provenanceChain).toHaveLength(3);
  });

  it("fails and rolls back on step error", async () => {
    const steps = [
      { id: "good", name: "Good Step", input: {} },
      {
        id: "bad",
        name: "Bad Step",
        input: {},
        execute: async () => {
          throw new Error("intentional failure");
        },
      },
      { id: "skipped", name: "Skipped Step", input: {} },
    ];
    const report = await workflowCmd("Failure test", steps, { stopOnFailure: true });
    expect(report.status).toBe("fail");
    expect(report.data.failedStep).toBe("bad");
    expect(report.data.rolledBack).toBe(true);
    const skippedStep = report.data.steps.find((s) => s.stepId === "skipped");
    expect(skippedStep?.status).toBe("skipped");
  });

  it("continues on failure when stopOnFailure=false", async () => {
    const steps = [
      {
        id: "bad",
        name: "Fail",
        input: {},
        execute: async () => {
          throw new Error("fail");
        },
      },
      { id: "after", name: "After Fail", input: {} },
    ];
    const report = await workflowCmd("No stop", steps, { stopOnFailure: false });
    const afterStep = report.data.steps.find((s) => s.stepId === "after");
    expect(afterStep?.status).toBe("ok");
  });

  it("emits receipt hashes for each completed step", async () => {
    const steps = [{ id: "r1", name: "Receipt step", input: { intent: "test" } }];
    const report = await workflowCmd("Receipt test", steps);
    const step = report.data.steps[0];
    expect(step?.receiptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("retries a failing step", async () => {
    let callCount = 0;
    const steps = [
      {
        id: "flaky",
        name: "Flaky",
        input: {},
        retries: 2,
        execute: async () => {
          callCount++;
          if (callCount < 3) throw new Error("not yet");
          return { done: true };
        },
      },
    ];
    const report = await workflowCmd("Retry test", steps);
    expect(report.status).toBe("ok");
    expect(report.data.steps[0]?.attempts).toBe(3);
    expect(callCount).toBe(3);
  });
});

import { describe, it, expect } from "vitest";
import { dagCmd, parseDagStepSpec, DagStep } from "../commands/dag.js";

describe("parseDagStepSpec", () => {
  it("parses id:name with no deps", () => {
    const s = parseDagStepSpec("step-1:Do the thing");
    expect(s.id).toBe("step-1");
    expect(s.name).toBe("Do the thing");
    expect(s.dependsOn).toEqual([]);
  });

  it("parses deps in brackets", () => {
    const s = parseDagStepSpec("step-2:Process[step-1]");
    expect(s.id).toBe("step-2");
    expect(s.dependsOn).toEqual(["step-1"]);
  });

  it("parses multiple deps", () => {
    const s = parseDagStepSpec("merge:Merge results[fetch-a,fetch-b]");
    expect(s.dependsOn).toEqual(["fetch-a", "fetch-b"]);
  });

  it("uses id as name when no colon", () => {
    const s = parseDagStepSpec("check");
    expect(s.id).toBe("check");
    expect(s.name).toBe("check");
  });
});

describe("dagCmd — basic execution", () => {
  it("runs independent steps and emits provenance chain", async () => {
    const steps: DagStep[] = [
      { id: "a", name: "Step A", input: { x: 1 } },
      { id: "b", name: "Step B", input: { x: 2 } },
      { id: "c", name: "Step C", input: { x: 3 } },
    ];
    const report = await dagCmd("Independent steps test", steps);
    expect(report.status).toBe("ok");
    expect(report.data.completedSteps).toBe(3);
    expect(report.data.failedSteps).toHaveLength(0);
    expect(report.data.provenanceChain).toHaveLength(3);
    expect(report.data.parallelBatches).toBe(1); // all independent → one batch
    expect(report.data.maxConcurrency).toBe(3);
  });

  it("respects dependency order", async () => {
    const order: string[] = [];
    const steps: DagStep[] = [
      {
        id: "first",
        name: "First",
        input: {},
        execute: async () => { order.push("first"); return { done: true }; },
      },
      {
        id: "second",
        name: "Second",
        dependsOn: ["first"],
        input: {},
        execute: async () => { order.push("second"); return { done: true }; },
      },
      {
        id: "third",
        name: "Third",
        dependsOn: ["second"],
        input: {},
        execute: async () => { order.push("third"); return { done: true }; },
      },
    ];
    const report = await dagCmd("Sequential deps", steps);
    expect(report.status).toBe("ok");
    expect(order).toEqual(["first", "second", "third"]);
    expect(report.data.parallelBatches).toBe(3);
  });

  it("passes upstream outputs to downstream steps", async () => {
    let receivedUpstream: Record<string, unknown> = {};
    const steps: DagStep[] = [
      {
        id: "producer",
        name: "Producer",
        input: {},
        execute: async () => ({ result: 42 }),
      },
      {
        id: "consumer",
        name: "Consumer",
        dependsOn: ["producer"],
        input: {},
        execute: async (dagInput) => {
          receivedUpstream = dagInput.upstream;
          return { received: dagInput.upstream["producer"] };
        },
      },
    ];
    const report = await dagCmd("Upstream propagation", steps);
    expect(report.status).toBe("ok");
    expect(receivedUpstream["producer"]).toEqual({ result: 42 });
  });
});

describe("dagCmd — parallel execution", () => {
  it("runs diamond DAG: root → [A, B] → merge", async () => {
    const timeline: { id: string; t: number }[] = [];
    const steps: DagStep[] = [
      {
        id: "root",
        name: "Root",
        input: {},
        execute: async () => { timeline.push({ id: "root", t: Date.now() }); return {}; },
      },
      {
        id: "branch-a",
        name: "Branch A",
        dependsOn: ["root"],
        input: {},
        execute: async () => {
          await new Promise((r) => setTimeout(r, 20));
          timeline.push({ id: "branch-a", t: Date.now() });
          return { a: 1 };
        },
      },
      {
        id: "branch-b",
        name: "Branch B",
        dependsOn: ["root"],
        input: {},
        execute: async () => {
          await new Promise((r) => setTimeout(r, 20));
          timeline.push({ id: "branch-b", t: Date.now() });
          return { b: 2 };
        },
      },
      {
        id: "merge",
        name: "Merge",
        dependsOn: ["branch-a", "branch-b"],
        input: {},
        execute: async (dagInput) => {
          timeline.push({ id: "merge", t: Date.now() });
          return {
            combined: { ...dagInput.upstream["branch-a"], ...dagInput.upstream["branch-b"] },
          };
        },
      },
    ];

    const report = await dagCmd("Diamond DAG", steps);
    expect(report.status).toBe("ok");
    expect(report.data.completedSteps).toBe(4);
    expect(report.data.parallelBatches).toBe(3); // root | [a,b] | merge
    expect(report.data.maxConcurrency).toBe(2);

    const mergeStep = report.data.steps.find((s) => s.stepId === "merge");
    expect(mergeStep?.output).toMatchObject({ combined: { a: 1, b: 2 } });
  });
});

describe("dagCmd — failure handling", () => {
  it("fails and skips downstream steps when stopOnFailure=true", async () => {
    const steps: DagStep[] = [
      {
        id: "bad",
        name: "Bad",
        input: {},
        execute: async () => { throw new Error("boom"); },
      },
      {
        id: "dependent",
        name: "Dependent",
        dependsOn: ["bad"],
        input: {},
      },
    ];
    const report = await dagCmd("Failure propagation", steps, { stopOnFailure: true });
    expect(report.status).toBe("fail");
    expect(report.data.failedSteps).toContain("bad");
    expect(report.data.skippedSteps).toContain("dependent");
  });

  it("continues after failure when stopOnFailure=false", async () => {
    const steps: DagStep[] = [
      {
        id: "bad",
        name: "Bad",
        input: {},
        execute: async () => { throw new Error("boom"); },
      },
      {
        id: "independent",
        name: "Independent (no dep on bad)",
        input: {},
        execute: async () => ({ ok: true }),
      },
    ];
    const report = await dagCmd("No stop on fail", steps, { stopOnFailure: false });
    const indep = report.data.steps.find((s) => s.stepId === "independent");
    expect(indep?.status).toBe("ok");
  });

  it("detects cycles and returns error", async () => {
    const steps: DagStep[] = [
      { id: "a", name: "A", dependsOn: ["b"], input: {} },
      { id: "b", name: "B", dependsOn: ["a"], input: {} },
    ];
    const report = await dagCmd("Cycle detection", steps);
    expect(report.status).toBe("fail");
    expect(report.errors.some((e) => /[Cc]ycle/.test(e))).toBe(true);
  });

  it("detects unknown dependency references", async () => {
    const steps: DagStep[] = [
      { id: "orphan", name: "Orphan", dependsOn: ["ghost"], input: {} },
    ];
    const report = await dagCmd("Unknown dep", steps);
    expect(report.status).toBe("fail");
    expect(report.errors.some((e) => /unknown step/.test(e))).toBe(true);
  });

  it("retries a failing step and succeeds", async () => {
    let callCount = 0;
    const steps: DagStep[] = [
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
    const report = await dagCmd("Retry DAG", steps);
    expect(report.status).toBe("ok");
    expect(report.data.steps[0]?.attempts).toBe(3);
  });
});

describe("dagCmd — receipt integrity", () => {
  it("emits valid SHA-256 receipt hashes for completed steps", async () => {
    const steps: DagStep[] = [
      { id: "r1", name: "Receipt step", input: { intent: "test" } },
    ];
    const report = await dagCmd("Receipt test", steps);
    const step = report.data.steps[0];
    expect(step?.receiptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("provenance chain length equals completed steps", async () => {
    const steps: DagStep[] = [
      { id: "x", name: "X", input: {} },
      { id: "y", name: "Y", input: {} },
    ];
    const report = await dagCmd("Chain length", steps);
    expect(report.data.provenanceChain).toHaveLength(report.data.completedSteps);
  });
});

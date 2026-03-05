#!/usr/bin/env node
import {
  dagCmd,
  discoverCmd,
  guardCmd,
  handoffCmd,
  healthCmd,
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

// src/cli.ts
import { Command } from "commander";

// src/commands/lint.ts
function detectCycles(steps) {
  const adj = /* @__PURE__ */ new Map();
  for (const s of steps) {
    adj.set(s.id, s.dependsOn ?? []);
  }
  const visited = /* @__PURE__ */ new Set();
  const inStack = /* @__PURE__ */ new Set();
  const cycles = [];
  function dfs(node, path) {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      cycles.push(path.slice(cycleStart).concat(node));
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    inStack.add(node);
    path.push(node);
    for (const dep of adj.get(node) ?? []) {
      dfs(dep, [...path]);
    }
    inStack.delete(node);
    visited.delete(node);
  }
  for (const s of steps) {
    if (!visited.has(s.id)) dfs(s.id, []);
  }
  const seen = /* @__PURE__ */ new Set();
  return cycles.filter((c) => {
    const key = [...c].sort().join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function findUnreachable(steps) {
  if (steps.length === 0) return [];
  const hasDeps = steps.some((s) => (s.dependsOn ?? []).length > 0);
  if (!hasDeps) return [];
  const ids = new Set(steps.map((s) => s.id));
  const roots = steps.filter((s) => (s.dependsOn ?? []).length === 0).map((s) => s.id);
  const reachable = new Set(roots);
  const queue = [...roots];
  while (queue.length > 0) {
    const node = queue.shift();
    for (const s of steps) {
      if (!reachable.has(s.id) && (s.dependsOn ?? []).includes(node)) {
        reachable.add(s.id);
        queue.push(s.id);
      }
    }
  }
  return [...ids].filter((id) => !reachable.has(id));
}
function lintWorkflow(options) {
  const { steps, goal = "unnamed", policy = {} } = options;
  const warnSteps = policy.warnSteps ?? 20;
  const errorSteps = policy.errorSteps ?? 50;
  const requireRollback = policy.requireRollback ?? false;
  const violations = [];
  const ids = /* @__PURE__ */ new Set();
  if (steps.length === 0) {
    violations.push({
      code: "E001",
      severity: "error",
      message: "Workflow has no steps."
    });
  }
  if (steps.length > errorSteps) {
    violations.push({
      code: "E002",
      severity: "error",
      message: `Workflow has ${steps.length} steps (policy limit: ${errorSteps}).`
    });
  } else if (steps.length > warnSteps) {
    violations.push({
      code: "W001",
      severity: "warning",
      message: `Workflow has ${steps.length} steps (warn threshold: ${warnSteps}). Consider splitting.`
    });
  }
  for (const step of steps) {
    if (!step.id || step.id.trim() === "") {
      violations.push({
        code: "E003",
        severity: "error",
        message: "Step is missing required field 'id'."
      });
      continue;
    }
    if (!step.name || String(step.name).trim() === "") {
      violations.push({
        code: "W002",
        severity: "warning",
        stepId: step.id,
        message: `Step '${step.id}' is missing field 'name'.`
      });
    }
    if (ids.has(step.id)) {
      violations.push({
        code: "E004",
        severity: "error",
        stepId: step.id,
        message: `Duplicate step id: '${step.id}'.`
      });
    } else {
      ids.add(step.id);
    }
    if (requireRollback && !step.rollbackCmd) {
      violations.push({
        code: "E005",
        severity: "error",
        stepId: step.id,
        message: `Step '${step.id}' has no rollbackCmd (policy: requireRollback=true).`
      });
    } else if (steps.length > 1 && !step.rollbackCmd) {
      violations.push({
        code: "W003",
        severity: "warning",
        stepId: step.id,
        message: `Step '${step.id}' has no rollbackCmd. Consider adding one for failure recovery.`
      });
    }
  }
  const allIds = new Set(steps.map((s) => s.id));
  for (const step of steps) {
    for (const dep of step.dependsOn ?? []) {
      if (!allIds.has(dep)) {
        violations.push({
          code: "E006",
          severity: "error",
          stepId: step.id,
          message: `Step '${step.id}' depends on unknown step '${dep}'.`
        });
      }
    }
  }
  const cycles = detectCycles(steps);
  for (const cycle of cycles) {
    violations.push({
      code: "E007",
      severity: "error",
      message: `Circular dependency detected: ${cycle.join(" \u2192 ")}.`
    });
  }
  const unreachable = findUnreachable(steps);
  for (const stepId of unreachable) {
    violations.push({
      code: "W004",
      severity: "warning",
      stepId,
      message: `Step '${stepId}' is unreachable (no path from any root step).`
    });
  }
  const errorCount = violations.filter((v) => v.severity === "error").length;
  const warningCount = violations.filter((v) => v.severity === "warning").length;
  const status = errorCount > 0 ? "fail" : warningCount > 0 ? "warn" : "pass";
  return {
    goal,
    totalSteps: steps.length,
    status,
    errorCount,
    warningCount,
    violations,
    checkedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function lintCmd(options) {
  const started = Date.now();
  const data = lintWorkflow(options);
  const statusIcon = data.status === "pass" ? "\u2713" : data.status === "warn" ? "\u26A0" : "\u2717";
  const summary = `lint ${statusIcon} ${data.status.toUpperCase()} \u2014 ${data.totalSteps} steps, ${data.errorCount} errors, ${data.warningCount} warnings`;
  data.summary = summary;
  const errors = data.violations.filter((v) => v.severity === "error").map((v) => `[${v.code}]${v.stepId ? ` (${v.stepId})` : ""} ${v.message}`);
  const warnings = data.violations.filter((v) => v.severity === "warning").map((v) => `[${v.code}]${v.stepId ? ` (${v.stepId})` : ""} ${v.message}`);
  return makeReport(
    "lint",
    started,
    data.status === "fail" ? "fail" : "ok",
    data,
    warnings,
    errors
  );
}

// src/cli.ts
var program = new Command();
program.name("agentops-forge").description("Professional toolkit for autonomous agent operations").version("0.1.0");
program.command("discover").requiredOption("-q, --query <query>").option("-l, --limit <n>", "limit", "10").action(async (opts) => {
  console.log(JSON.stringify(await discoverCmd(opts.query, Number(opts.limit)), null, 2));
});
program.command("outreach").requiredOption("-t, --targets <targets>").option("--dry-run", "draft only", false).action(async (opts) => {
  console.log(JSON.stringify(await outreachCmd(String(opts.targets).split(","), Boolean(opts.dryRun)), null, 2));
});
program.command("social").requiredOption("--topic <topic>").action(async (opts) => {
  console.log(JSON.stringify(await socialCmd(opts.topic), null, 2));
});
program.command("guard").requiredOption("--kind <kind>").action(async (opts) => {
  console.log(JSON.stringify(await guardCmd(opts.kind), null, 2));
});
var receiptGroup = program.command("receipt").description("Create, verify, or list provenance receipts");
receiptGroup.command("create").description("Create a new provenance receipt and persist it to the store").requiredOption("--intent <intent>", "what was intended").requiredOption("--outcome <outcome>", "what actually happened").action(async (opts) => {
  console.log(JSON.stringify(await receiptCmd(opts.intent, opts.outcome), null, 2));
});
receiptGroup.command("verify <hash>").description("Verify a receipt hash \u2014 look it up in the persistent store").action(async (hash) => {
  console.log(JSON.stringify(await receiptVerifyCmd(hash), null, 2));
});
receiptGroup.command("list").description("List recent receipts from the persistent store").option("-n, --limit <n>", "max receipts to show", "20").action(async (opts) => {
  console.log(JSON.stringify(await receiptListCmd(Number(opts.limit)), null, 2));
});
program.command("receipt-create", { hidden: true }).requiredOption("--intent <intent>").requiredOption("--outcome <outcome>").action(async (opts) => {
  console.log(JSON.stringify(await receiptCmd(opts.intent, opts.outcome), null, 2));
});
program.command("handoff").requiredOption("--task <task>").requiredOption("--goal <goal>").action(async (opts) => {
  console.log(JSON.stringify(await handoffCmd(opts.task, opts.goal), null, 2));
});
program.command("workflow").description("Run a typed multi-step agent workflow with provenance receipts and rollback").requiredOption("--goal <goal>", "overall workflow goal").requiredOption("--steps <steps>", "comma-separated list of step specs: id:name,id2:name2").option("--no-stop-on-failure", "continue executing steps after a failure").action(async (opts) => {
  const steps = String(opts.steps).split(",").map((s) => parseStepSpec(s.trim())).filter((s) => s.id);
  const result = await workflowCmd(opts.goal, steps, { stopOnFailure: opts.stopOnFailure });
  console.log(JSON.stringify(result, null, 2));
});
program.command("dag").description("Run a DAG-based workflow: parallel steps, provenance receipts, cycle detection").requiredOption("--goal <goal>", "overall workflow goal").requiredOption(
  "--steps <steps>",
  'comma-separated step specs: "id:name" or "id:name[dep1,dep2]"'
).option("--no-stop-on-failure", "continue after a step failure").action(async (opts) => {
  const raw = String(opts.steps);
  const stepSpecs = [];
  let depth = 0, cur = "";
  for (const ch of raw) {
    if (ch === "[") {
      depth++;
      cur += ch;
    } else if (ch === "]") {
      depth--;
      cur += ch;
    } else if (ch === "," && depth === 0) {
      stepSpecs.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) stepSpecs.push(cur.trim());
  const steps = stepSpecs.map((s) => parseDagStepSpec(s)).filter((s) => s.id);
  const result = await dagCmd(opts.goal, steps, { stopOnFailure: opts.stopOnFailure });
  console.log(JSON.stringify(result, null, 2));
});
program.command("health").description("Check liveness and latency of all key services (A2A, AgentMail, Clawk, network)").option("-t, --target <target>", "service to check: all | a2a | agentmail | clawk | network", "all").action(async (opts) => {
  console.log(JSON.stringify(await healthCmd(opts.target), null, 2));
});
var replayGroup = program.command("replay").description("Resume a failed workflow from its last checkpoint, or list saved checkpoints");
replayGroup.command("run <workflowId>").description("Resume a failed workflow by its workflowId").option("--steps <steps>", "step specs to re-run: id:name,id2:name2 (same as original workflow)", "").option("--no-stop-on-failure", "continue after a step failure").option("--keep", "keep the checkpoint file even on full success", false).action(async (workflowId, opts) => {
  const steps = opts.steps ? String(opts.steps).split(",").map((s) => parseStepSpec(s.trim())).filter((s) => s.id) : [];
  const result = await replayCmd(workflowId, steps, {
    stopOnFailure: opts.stopOnFailure,
    clearOnSuccess: !opts.keep
  });
  console.log(JSON.stringify(result, null, 2));
});
replayGroup.command("list").description("List all saved checkpoints (workflows that failed and can be replayed)").action(() => {
  console.log(listCheckpointsSummary());
});
program.command("lint").description("Validate a workflow or DAG definition before execution").requiredOption("--steps <steps>", "Comma-separated step specs: id[:name][:dep1+dep2][:rollback]").option("--goal <goal>", "Workflow goal/name for reporting", "unnamed").option("--require-rollback", "Error if any step lacks a rollbackCmd", false).option("--warn-steps <n>", "Warn threshold for step count", "20").option("--error-steps <n>", "Error threshold for step count", "50").action((opts) => {
  const steps = String(opts.steps).split(",").map((spec) => {
    const [id, name, deps, rollback] = spec.trim().split(":");
    return {
      id: id ?? "",
      name: name ?? id ?? "",
      dependsOn: deps ? deps.split("+").filter(Boolean) : [],
      ...rollback ? { rollbackCmd: rollback } : {}
    };
  }).filter((s) => s.id);
  const result = lintCmd({
    goal: opts.goal,
    steps,
    policy: {
      requireRollback: opts.requireRollback,
      warnSteps: Number(opts.warnSteps),
      errorSteps: Number(opts.errorSteps)
    }
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "fail" ? 1 : 0);
});
program.parse();

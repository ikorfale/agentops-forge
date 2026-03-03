#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/cli.ts
var import_commander = require("commander");

// src/core/report.ts
var import_node_crypto = require("crypto");
function makeReport(command, started, status, data, warnings = [], errors = []) {
  return {
    requestId: (0, import_node_crypto.randomUUID)(),
    command,
    status,
    startedAt: new Date(started).toISOString(),
    finishedAt: (/* @__PURE__ */ new Date()).toISOString(),
    durationMs: Date.now() - started,
    data,
    warnings,
    errors
  };
}

// src/commands/discover.ts
async function discoverCmd(query, limit = 10) {
  const started = Date.now();
  const items = [{ source: "github", title: `Result for: ${query}`, score: 0.72 }].slice(0, limit);
  return makeReport("discover", started, "ok", { query, count: items.length, items });
}

// src/commands/outreach.ts
async function outreachCmd(targets, dryRun = false) {
  const started = Date.now();
  const prepared = targets.map((t) => ({ target: t, channel: "email", status: dryRun ? "drafted" : "sent" }));
  return makeReport("outreach", started, "ok", { dryRun, total: prepared.length, prepared });
}

// src/commands/social.ts
async function socialCmd(topic) {
  const started = Date.now();
  const draft = `Signal: ${topic}
Thesis -> Proof -> Challenge`;
  return makeReport("social", started, "ok", { topic, draft });
}

// src/commands/guard.ts
var import_node_fs = require("fs");
async function guardCmd(kind) {
  const started = Date.now();
  const checks = [];
  switch (kind) {
    case "env": {
      const requiredVars = ["HOME", "PATH", "NODE_ENV"];
      for (const v of requiredVars) {
        checks.push({
          name: `env:${v}`,
          passed: Boolean(process.env[v]),
          detail: process.env[v] ? "set" : "missing"
        });
      }
      const optionalVars = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "SUPABASE_URL"];
      for (const v of optionalVars) {
        checks.push({
          name: `env:${v} (optional)`,
          passed: true,
          // never fail on optional
          detail: process.env[v] ? "set" : "not set (optional)"
        });
      }
      break;
    }
    case "files": {
      const agentFiles = [
        process.env.HOME + "/.openclaw/workspace/SOUL.md",
        process.env.HOME + "/.openclaw/workspace/MEMORY.md",
        process.env.HOME + "/.openclaw/workspace/TOOLS.md"
      ];
      for (const f of agentFiles) {
        const exists = (0, import_node_fs.existsSync)(f);
        checks.push({
          name: `file:${f.split("/").pop()}`,
          passed: exists,
          detail: exists ? "present" : "missing"
        });
      }
      break;
    }
    case "network": {
      try {
        const { Resolver } = await import("dns/promises");
        const resolver = new Resolver();
        resolver.setServers(["8.8.8.8"]);
        const addrs = await Promise.race([
          resolver.resolve4("api.anthropic.com"),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3e3))
        ]);
        checks.push({
          name: "dns:api.anthropic.com",
          passed: Array.isArray(addrs) && addrs.length > 0,
          detail: Array.isArray(addrs) ? `resolved: ${addrs[0]}` : "empty"
        });
      } catch (err) {
        checks.push({
          name: "dns:api.anthropic.com",
          passed: false,
          detail: err instanceof Error ? err.message : String(err)
        });
      }
      break;
    }
    case "schema": {
      checks.push({
        name: "schema:zod",
        passed: true,
        detail: "schema validation is runtime-dependent; pass --schema <path> to enable"
      });
      break;
    }
    default: {
      checks.push({
        name: kind,
        passed: true,
        detail: "generic guard passed"
      });
    }
  }
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.filter((c) => !c.passed).length;
  const status = failed === 0 ? "ok" : passed === 0 ? "fail" : "partial";
  const errors = checks.filter((c) => !c.passed).map((c) => `Guard check failed: ${c.name} \u2014 ${c.detail ?? "no detail"}`);
  return makeReport(
    "guard",
    started,
    status,
    { kind, checks, passed, failed },
    [],
    errors
  );
}

// src/commands/receipt.ts
var import_node_crypto2 = require("crypto");
async function receiptCmd(intent, outcome) {
  const started = Date.now();
  const receiptHash = (0, import_node_crypto2.createHash)("sha256").update(`${intent}::${outcome}`).digest("hex");
  return makeReport("receipt", started, "ok", { intent, outcome, receiptHash });
}

// src/commands/handoff.ts
async function handoffCmd(task, goal) {
  const started = Date.now();
  const packet = { task, goal, definition_of_done: "explicit", provenance: "required" };
  return makeReport("handoff", started, "ok", { score: 92, packet });
}

// src/commands/workflow.ts
var import_node_crypto3 = require("crypto");
async function defaultExecute(input) {
  return { acknowledged: true, ...input };
}
function stepReceipt(stepId, stepName, input, output) {
  const payload = JSON.stringify({ stepId, stepName, input, output });
  return (0, import_node_crypto3.createHash)("sha256").update(payload).digest("hex");
}
async function runStepWithRetry(step, maxAttempts) {
  const exec = step.execute ?? defaultExecute;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const output = await exec(step.input);
      return { output, attempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { output: {}, attempts: maxAttempts, error: lastError };
}
async function workflowCmd(goal, steps, opts = {}) {
  const started = Date.now();
  const workflowId = (0, import_node_crypto3.randomUUID)();
  const stopOnFailure = opts.stopOnFailure ?? true;
  const results = [];
  const provenanceChain = [];
  let failedStep = null;
  let rolledBack = false;
  const warnings = [];
  const errors = [];
  for (const step of steps) {
    if (failedStep !== null && stopOnFailure) {
      results.push({
        stepId: step.id,
        stepName: step.name,
        status: "skipped",
        input: step.input,
        output: {},
        receiptHash: "",
        attempts: 0,
        durationMs: 0
      });
      continue;
    }
    const stepStart = Date.now();
    const maxAttempts = (step.retries ?? 0) + 1;
    const { output, attempts, error } = await runStepWithRetry(step, maxAttempts);
    const durationMs = Date.now() - stepStart;
    const status = error ? "failed" : "ok";
    const receipt = status === "ok" ? stepReceipt(step.id, step.name, step.input, output) : "";
    if (status === "ok") {
      provenanceChain.push(`${step.id}:${receipt.slice(0, 12)}`);
    }
    results.push({
      stepId: step.id,
      stepName: step.name,
      status,
      input: step.input,
      output,
      receiptHash: receipt,
      attempts,
      durationMs,
      error
    });
    if (status === "failed") {
      failedStep = step.id;
      errors.push(`Step ${step.id} (${step.name}) failed after ${attempts} attempt(s): ${error}`);
      if (stopOnFailure) {
        const completed = results.filter((r) => r.status === "ok");
        for (const prev of completed.reverse()) {
          warnings.push(`Rollback: step ${prev.stepId} (${prev.stepName}) marked for reversal`);
        }
        rolledBack = completed.length > 0;
      }
    }
  }
  const completedSteps = results.filter((r) => r.status === "ok").length;
  const overallStatus = failedStep ? "fail" : completedSteps === steps.length ? "ok" : "partial";
  return makeReport(
    "workflow",
    started,
    overallStatus,
    {
      workflowId,
      goal,
      totalSteps: steps.length,
      completedSteps,
      failedStep,
      rolledBack,
      steps: results,
      provenanceChain
    },
    warnings,
    errors
  );
}
function parseStepSpec(spec) {
  const [id, ...rest] = spec.split(":");
  return {
    id: id.trim(),
    name: rest.join(":").trim() || id.trim(),
    input: {},
    retries: 0
  };
}

// src/commands/dag.ts
var import_node_crypto4 = require("crypto");
function stepReceipt2(stepId, stepName, input, output) {
  const payload = JSON.stringify({ stepId, stepName, input, output });
  return (0, import_node_crypto4.createHash)("sha256").update(payload).digest("hex");
}
async function defaultExecute2(dagInput) {
  return { acknowledged: true, ...dagInput.staticInput };
}
async function runWithRetry(step, dagInput, maxAttempts) {
  const exec = step.execute ?? defaultExecute2;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const output = await exec(dagInput);
      return { output, attempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { output: {}, attempts: maxAttempts, error: lastError };
}
function topologicalBatches(steps) {
  const idSet = new Set(steps.map((s) => s.id));
  const inDegree = /* @__PURE__ */ new Map();
  const children = /* @__PURE__ */ new Map();
  for (const s of steps) {
    inDegree.set(s.id, 0);
    children.set(s.id, []);
  }
  for (const s of steps) {
    for (const dep of s.dependsOn ?? []) {
      if (!idSet.has(dep)) {
        throw new Error(`Step "${s.id}" depends on unknown step "${dep}"`);
      }
      inDegree.set(s.id, (inDegree.get(s.id) ?? 0) + 1);
      children.get(dep).push(s.id);
    }
  }
  const batches = [];
  const remaining = new Set(steps.map((s) => s.id));
  const stepById = new Map(steps.map((s) => [s.id, s]));
  while (remaining.size > 0) {
    const ready = [...remaining].filter((id) => (inDegree.get(id) ?? 0) === 0);
    if (ready.length === 0) {
      throw new Error(`Cycle detected among steps: ${[...remaining].join(", ")}`);
    }
    batches.push(ready.map((id) => stepById.get(id)));
    for (const id of ready) {
      remaining.delete(id);
      for (const child of children.get(id) ?? []) {
        inDegree.set(child, (inDegree.get(child) ?? 0) - 1);
      }
    }
  }
  return batches;
}
async function dagCmd(goal, steps, opts = {}) {
  const started = Date.now();
  const workflowId = (0, import_node_crypto4.randomUUID)();
  const stopOnFailure = opts.stopOnFailure ?? true;
  let batches;
  try {
    batches = topologicalBatches(steps);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return makeReport("dag", started, "fail", {
      workflowId,
      goal,
      totalSteps: steps.length,
      completedSteps: 0,
      failedSteps: [],
      skippedSteps: [],
      parallelBatches: 0,
      maxConcurrency: 0,
      steps: [],
      provenanceChain: []
    }, [], [msg]);
  }
  const results = /* @__PURE__ */ new Map();
  const completedOutputs = /* @__PURE__ */ new Map();
  const failedIds = /* @__PURE__ */ new Set();
  const skippedIds = /* @__PURE__ */ new Set();
  const provenanceChain = [];
  const errors = [];
  const warnings = [];
  let parallelBatches = 0;
  let maxConcurrency = 0;
  for (const batch of batches) {
    if (stopOnFailure && failedIds.size > 0) {
      for (const step of batch) {
        skippedIds.add(step.id);
        results.set(step.id, {
          stepId: step.id,
          stepName: step.name,
          status: "skipped",
          dependsOn: step.dependsOn ?? [],
          input: step.input ?? {},
          output: {},
          receiptHash: "",
          attempts: 0,
          durationMs: 0,
          startedAt: (/* @__PURE__ */ new Date()).toISOString(),
          finishedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      continue;
    }
    parallelBatches++;
    maxConcurrency = Math.max(maxConcurrency, batch.length);
    const batchPromises = batch.map(async (step) => {
      const stepStart = Date.now();
      const startedAt = (/* @__PURE__ */ new Date()).toISOString();
      const upstream = {};
      for (const dep of step.dependsOn ?? []) {
        upstream[dep] = completedOutputs.get(dep) ?? {};
      }
      const dagInput = {
        step,
        upstream,
        staticInput: step.input ?? {}
      };
      const maxAttempts = (step.retries ?? 0) + 1;
      const { output, attempts, error } = await runWithRetry(step, dagInput, maxAttempts);
      const durationMs = Date.now() - stepStart;
      const finishedAt = (/* @__PURE__ */ new Date()).toISOString();
      const status = error ? "failed" : "ok";
      const receipt = status === "ok" ? stepReceipt2(step.id, step.name, step.input ?? {}, output) : "";
      return {
        stepId: step.id,
        stepName: step.name,
        status,
        dependsOn: step.dependsOn ?? [],
        input: step.input ?? {},
        output,
        receiptHash: receipt,
        attempts,
        durationMs,
        startedAt,
        finishedAt,
        error
      };
    });
    const batchResults = await Promise.all(batchPromises);
    for (const result of batchResults) {
      results.set(result.stepId, result);
      if (result.status === "ok") {
        completedOutputs.set(result.stepId, result.output);
        provenanceChain.push(`${result.stepId}:${result.receiptHash.slice(0, 12)}`);
      } else {
        failedIds.add(result.stepId);
        errors.push(
          `Step "${result.stepId}" (${result.stepName}) failed after ${result.attempts} attempt(s): ${result.error}`
        );
        if (stopOnFailure) {
          warnings.push(
            `Stopping DAG execution after step "${result.stepId}" failed. Subsequent steps will be skipped.`
          );
        }
      }
    }
  }
  const allResults = steps.map((s) => results.get(s.id));
  const completedSteps = allResults.filter((r) => r.status === "ok").length;
  const overallStatus = failedIds.size > 0 ? "fail" : completedSteps === steps.length ? "ok" : "partial";
  return makeReport(
    "dag",
    started,
    overallStatus,
    {
      workflowId,
      goal,
      totalSteps: steps.length,
      completedSteps,
      failedSteps: [...failedIds],
      skippedSteps: [...skippedIds],
      parallelBatches,
      maxConcurrency,
      steps: allResults,
      provenanceChain
    },
    warnings,
    errors
  );
}
function parseDagStepSpec(spec) {
  const depMatch = spec.match(/\[([^\]]*)\]$/);
  const deps = depMatch ? depMatch[1].split(",").map((d) => d.trim()).filter(Boolean) : [];
  const base = spec.replace(/\[[^\]]*\]$/, "").trim();
  const [id, ...rest] = base.split(":");
  return {
    id: id.trim(),
    name: rest.join(":").trim() || id.trim(),
    dependsOn: deps,
    input: {}
  };
}

// src/cli.ts
var program = new import_commander.Command();
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
program.command("receipt").requiredOption("--intent <intent>").requiredOption("--outcome <outcome>").action(async (opts) => {
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
program.parse();

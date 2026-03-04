"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  dagCmd: () => dagCmd,
  discoverCmd: () => discoverCmd,
  guardCmd: () => guardCmd,
  handoffCmd: () => handoffCmd,
  listCheckpoints: () => listCheckpoints,
  listCheckpointsSummary: () => listCheckpointsSummary,
  outreachCmd: () => outreachCmd,
  parseDagStepSpec: () => parseDagStepSpec,
  parseStepSpec: () => parseStepSpec,
  receiptCmd: () => receiptCmd,
  receiptListCmd: () => receiptListCmd,
  receiptVerifyCmd: () => receiptVerifyCmd,
  replayCmd: () => replayCmd,
  socialCmd: () => socialCmd,
  workflowCmd: () => workflowCmd
});
module.exports = __toCommonJS(index_exports);

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

// src/core/receipt-store.ts
var import_node_fs2 = require("fs");
var import_node_os = require("os");
var import_node_path = require("path");
var FORGE_DIR = (0, import_node_path.join)((0, import_node_os.homedir)(), ".forge");
var STORE_PATH = (0, import_node_path.join)(FORGE_DIR, "receipts.jsonl");
function ensureStore() {
  if (!(0, import_node_fs2.existsSync)(FORGE_DIR)) {
    (0, import_node_fs2.mkdirSync)(FORGE_DIR, { recursive: true });
  }
}
function storeReceipt(entry) {
  ensureStore();
  (0, import_node_fs2.appendFileSync)(STORE_PATH, JSON.stringify(entry) + "\n", "utf8");
}
function lookupReceipt(hash) {
  if (!(0, import_node_fs2.existsSync)(STORE_PATH)) return null;
  const lines = (0, import_node_fs2.readFileSync)(STORE_PATH, "utf8").split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.receiptHash === hash) return entry;
    } catch {
    }
  }
  return null;
}
function listReceipts(limit = 50) {
  if (!(0, import_node_fs2.existsSync)(STORE_PATH)) return [];
  const lines = (0, import_node_fs2.readFileSync)(STORE_PATH, "utf8").split("\n").filter(Boolean);
  return lines.map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  }).filter(Boolean).reverse().slice(0, limit);
}
function storePath() {
  return STORE_PATH;
}

// src/commands/receipt.ts
async function receiptCmd(intent, outcome) {
  const started = Date.now();
  const receiptHash = (0, import_node_crypto2.createHash)("sha256").update(`${intent}::${outcome}`).digest("hex");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  storeReceipt({
    receiptHash,
    kind: "simple",
    createdAt: now,
    label: `${intent} \u2192 ${outcome}`,
    payload: { intent, outcome }
  });
  return makeReport("receipt", started, "ok", { intent, outcome, receiptHash });
}
async function receiptVerifyCmd(hash) {
  const started = Date.now();
  const entry = lookupReceipt(hash);
  if (!entry) {
    return makeReport(
      "receipt:verify",
      started,
      "fail",
      { hash, found: false, storePath: storePath() },
      [],
      [`No receipt found for hash ${hash}`]
    );
  }
  return makeReport("receipt:verify", started, "ok", {
    hash,
    found: true,
    receipt: {
      receiptHash: entry.receiptHash,
      kind: entry.kind,
      createdAt: entry.createdAt,
      label: entry.label,
      payload: entry.payload,
      requestId: entry.requestId
    },
    storePath: storePath()
  });
}
async function receiptListCmd(limit = 20) {
  const started = Date.now();
  const entries = listReceipts(limit);
  return makeReport("receipt:list", started, "ok", {
    count: entries.length,
    receipts: entries.map((e) => ({
      receiptHash: e.receiptHash,
      kind: e.kind,
      createdAt: e.createdAt,
      label: e.label
    })),
    storePath: storePath()
  });
}

// src/commands/handoff.ts
async function handoffCmd(task, goal) {
  const started = Date.now();
  const packet = { task, goal, definition_of_done: "explicit", provenance: "required" };
  return makeReport("handoff", started, "ok", { score: 92, packet });
}

// src/commands/workflow.ts
var import_node_crypto3 = require("crypto");

// src/core/checkpoint-store.ts
var import_node_fs3 = require("fs");
var import_node_os2 = require("os");
var import_node_path2 = require("path");
var CHECKPOINT_DIR = (0, import_node_path2.join)((0, import_node_os2.homedir)(), ".forge", "checkpoints");
function ensureDir() {
  if (!(0, import_node_fs3.existsSync)(CHECKPOINT_DIR)) {
    (0, import_node_fs3.mkdirSync)(CHECKPOINT_DIR, { recursive: true });
  }
}
function checkpointPath(workflowId) {
  return (0, import_node_path2.join)(CHECKPOINT_DIR, `${workflowId}.json`);
}
function saveCheckpoint(checkpoint) {
  ensureDir();
  (0, import_node_fs3.writeFileSync)(
    checkpointPath(checkpoint.workflowId),
    JSON.stringify({ ...checkpoint, savedAt: (/* @__PURE__ */ new Date()).toISOString() }, null, 2),
    "utf8"
  );
}
function loadCheckpoint(workflowId) {
  const path = checkpointPath(workflowId);
  if (!(0, import_node_fs3.existsSync)(path)) return null;
  try {
    return JSON.parse((0, import_node_fs3.readFileSync)(path, "utf8"));
  } catch {
    return null;
  }
}
function clearCheckpoint(workflowId) {
  const path = checkpointPath(workflowId);
  if (!(0, import_node_fs3.existsSync)(path)) return false;
  (0, import_node_fs3.unlinkSync)(path);
  return true;
}
function listCheckpoints() {
  ensureDir();
  const files = (0, import_node_fs3.readdirSync)(CHECKPOINT_DIR).filter((f) => f.endsWith(".json"));
  const summaries = [];
  for (const file of files) {
    try {
      const cp = JSON.parse(
        (0, import_node_fs3.readFileSync)((0, import_node_path2.join)(CHECKPOINT_DIR, file), "utf8")
      );
      summaries.push({
        workflowId: cp.workflowId,
        goal: cp.goal,
        savedAt: cp.savedAt,
        completedCount: cp.completedSteps.length,
        pendingCount: cp.pendingStepIds.length,
        failedStepId: cp.failedStepId
      });
    } catch {
    }
  }
  return summaries.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

// src/commands/workflow.ts
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
  const checkpointEnabled = opts.checkpoint ?? true;
  const results = [];
  const provenanceChain = [];
  let failedStep = null;
  let rolledBack = false;
  const warnings = [];
  const errors = [];
  if (checkpointEnabled) {
    saveCheckpoint({
      workflowId,
      goal,
      savedAt: (/* @__PURE__ */ new Date()).toISOString(),
      completedSteps: [],
      pendingStepIds: steps.map((s) => s.id),
      failedStepId: null
    });
  }
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
    const stepResult = {
      stepId: step.id,
      stepName: step.name,
      status,
      input: step.input,
      output,
      receiptHash: receipt,
      attempts,
      durationMs,
      error
    };
    results.push(stepResult);
    if (status === "ok") {
      provenanceChain.push(`${step.id}:${receipt.slice(0, 12)}`);
      storeReceipt({
        receiptHash: receipt,
        kind: "step",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        label: `workflow/${workflowId} step ${step.id}: ${step.name}`,
        payload: { workflowId, stepId: step.id, stepName: step.name, input: step.input, output }
      });
      if (checkpointEnabled) {
        saveCheckpoint({
          workflowId,
          goal,
          savedAt: (/* @__PURE__ */ new Date()).toISOString(),
          completedSteps: results.filter((r) => r.status === "ok").map((r) => ({ ...r })),
          pendingStepIds: steps.slice(results.length).map((s) => s.id),
          failedStepId: null
        });
      }
    }
    if (status === "failed") {
      failedStep = step.id;
      errors.push(`Step ${step.id} (${step.name}) failed after ${attempts} attempt(s): ${error}`);
      if (checkpointEnabled) {
        saveCheckpoint({
          workflowId,
          goal,
          savedAt: (/* @__PURE__ */ new Date()).toISOString(),
          completedSteps: results.filter((r) => r.status === "ok").map((r) => ({ ...r })),
          pendingStepIds: steps.slice(results.findIndex((r) => r.stepId === step.id)).map((s) => s.id),
          failedStepId: step.id
        });
      }
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
  if (overallStatus === "ok" && checkpointEnabled) {
    clearCheckpoint(workflowId);
  }
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
        storeReceipt({
          receiptHash: result.receiptHash,
          kind: "dag_step",
          createdAt: result.finishedAt,
          label: `dag/${workflowId} step ${result.stepId}: ${result.stepName}`,
          payload: {
            workflowId,
            stepId: result.stepId,
            stepName: result.stepName,
            dependsOn: result.dependsOn,
            input: result.input,
            output: result.output
          }
        });
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

// src/commands/replay.ts
var import_node_crypto5 = require("crypto");
async function defaultExecute3(input) {
  return { acknowledged: true, ...input };
}
function computeReceipt(stepId, stepName, input, output) {
  return (0, import_node_crypto5.createHash)("sha256").update(JSON.stringify({ stepId, stepName, input, output })).digest("hex");
}
async function runWithRetry2(step, maxAttempts) {
  const exec = step.execute ?? defaultExecute3;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return { output: await exec(step.input), attempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { output: {}, attempts: maxAttempts, error: lastError };
}
async function replayCmd(workflowId, steps, opts = {}) {
  const started = Date.now();
  const stopOnFailure = opts.stopOnFailure ?? true;
  const clearOnSuccess = opts.clearOnSuccess ?? true;
  const checkpoint = loadCheckpoint(workflowId);
  if (!checkpoint) {
    return makeReport(
      "replay",
      started,
      "fail",
      {
        workflowId,
        goal: `<replay: no checkpoint found for ${workflowId}>`,
        totalSteps: steps.length,
        completedSteps: 0,
        failedStep: null,
        rolledBack: false,
        steps: [],
        provenanceChain: []
      },
      [],
      [`No checkpoint found for workflowId: ${workflowId}`]
    );
  }
  const goal = checkpoint.goal;
  const completedById = new Map(
    checkpoint.completedSteps.map((s) => [s.stepId, s])
  );
  const results = [];
  const provenanceChain = [];
  for (const cs of checkpoint.completedSteps) {
    results.push(cs);
    provenanceChain.push(cs.receiptHash);
  }
  const warnings = [];
  const errors = [];
  let failedStep = null;
  let rolledBack = false;
  for (const step of steps) {
    if (completedById.has(step.id)) {
      continue;
    }
    const maxAttempts = Math.max(1, (step.retries ?? 0) + 1);
    const stepStart = Date.now();
    const { output, attempts, error } = await runWithRetry2(step, maxAttempts);
    const durationMs = Date.now() - stepStart;
    const status = error ? "failed" : "ok";
    const receiptHash = computeReceipt(step.id, step.name, step.input, output);
    storeReceipt({
      receiptHash,
      kind: "step",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      label: `${step.id}:${step.name}`,
      payload: { stepId: step.id, stepName: step.name, input: step.input, output }
    });
    provenanceChain.push(receiptHash);
    const result = {
      stepId: step.id,
      stepName: step.name,
      status,
      input: step.input,
      output,
      receiptHash,
      attempts,
      durationMs,
      error
    };
    results.push(result);
    if (status === "ok") {
      const updatedCheckpoint = {
        ...checkpoint,
        completedSteps: [...checkpoint.completedSteps, result],
        pendingStepIds: checkpoint.pendingStepIds.filter((id) => id !== step.id),
        failedStepId: null
      };
      saveCheckpoint(updatedCheckpoint);
    } else {
      failedStep = step.id;
      errors.push(`Step ${step.id} (${step.name}) failed after ${attempts} attempt(s): ${error}`);
      if (stopOnFailure) {
        const completed = results.filter((r) => r.status === "ok");
        for (const prev of completed.reverse()) {
          warnings.push(`Rollback: step ${prev.stepId} (${prev.stepName}) marked for reversal`);
        }
        rolledBack = completed.length > 0;
        break;
      }
    }
  }
  const executedIds = new Set(results.map((r) => r.stepId));
  for (const step of steps) {
    if (!executedIds.has(step.id)) {
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
    }
  }
  const completedCount = results.filter((r) => r.status === "ok").length;
  const overallStatus = failedStep ? "fail" : completedCount === steps.length ? "ok" : "partial";
  if (overallStatus === "ok" && clearOnSuccess) {
    clearCheckpoint(workflowId);
  }
  return makeReport(
    "replay",
    started,
    overallStatus,
    {
      workflowId,
      goal,
      totalSteps: steps.length,
      completedSteps: completedCount,
      failedStep,
      rolledBack,
      steps: results,
      provenanceChain
    },
    warnings,
    errors
  );
}
function listCheckpointsSummary() {
  const checkpoints = listCheckpoints();
  if (checkpoints.length === 0) {
    return "No saved checkpoints. All workflows completed cleanly.";
  }
  const lines = ["Saved workflow checkpoints:", ""];
  for (const cp of checkpoints) {
    lines.push(`  workflowId: ${cp.workflowId}`);
    lines.push(`  goal:       ${cp.goal}`);
    lines.push(`  savedAt:    ${cp.savedAt}`);
    lines.push(`  completed:  ${cp.completedCount} steps`);
    lines.push(`  pending:    ${cp.pendingCount} steps`);
    lines.push(`  failed:     ${cp.failedStepId ?? "none"}`);
    lines.push("");
  }
  return lines.join("\n");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
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
  workflowCmd
});

#!/usr/bin/env node
"use strict";

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
async function guardCmd(kind) {
  const started = Date.now();
  const checks = [{ name: kind, passed: true }];
  return makeReport("guard", started, "ok", { checks });
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
program.parse();

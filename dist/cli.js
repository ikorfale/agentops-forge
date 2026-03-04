#!/usr/bin/env node
import {
  dagCmd,
  discoverCmd,
  guardCmd,
  handoffCmd,
  outreachCmd,
  parseDagStepSpec,
  parseStepSpec,
  receiptCmd,
  receiptListCmd,
  receiptVerifyCmd,
  socialCmd,
  workflowCmd
} from "./chunk-XJFJP6RV.js";

// src/cli.ts
import { Command } from "commander";
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
program.parse();

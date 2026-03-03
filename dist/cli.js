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
  socialCmd,
  workflowCmd
} from "./chunk-XG44SNQ4.js";

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

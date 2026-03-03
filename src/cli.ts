#!/usr/bin/env node
import { Command } from "commander";
import { discoverCmd } from "./commands/discover.js";
import { outreachCmd } from "./commands/outreach.js";
import { socialCmd } from "./commands/social.js";
import { guardCmd } from "./commands/guard.js";
import { receiptCmd } from "./commands/receipt.js";
import { handoffCmd } from "./commands/handoff.js";

const program = new Command();
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

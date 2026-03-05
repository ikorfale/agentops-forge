#!/usr/bin/env node
import { Command } from "commander";
import { discoverCmd } from "./commands/discover.js";
import { outreachCmd } from "./commands/outreach.js";
import { socialCmd } from "./commands/social.js";
import { guardCmd } from "./commands/guard.js";
import { receiptCmd, receiptVerifyCmd, receiptListCmd } from "./commands/receipt.js";
import { handoffCmd } from "./commands/handoff.js";
import { workflowCmd, parseStepSpec } from "./commands/workflow.js";
import { dagCmd, parseDagStepSpec } from "./commands/dag.js";
import { healthCmd, type HealthTarget } from "./commands/health.js";
import { replayCmd, listCheckpointsSummary } from "./commands/replay.js";
import { lintCmd, type LintStep } from "./commands/lint.js";

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

// receipt — subcommands: create (default), verify, list
const receiptGroup = program.command("receipt").description("Create, verify, or list provenance receipts");

receiptGroup
  .command("create")
  .description("Create a new provenance receipt and persist it to the store")
  .requiredOption("--intent <intent>", "what was intended")
  .requiredOption("--outcome <outcome>", "what actually happened")
  .action(async (opts) => {
    console.log(JSON.stringify(await receiptCmd(opts.intent, opts.outcome), null, 2));
  });

receiptGroup
  .command("verify <hash>")
  .description("Verify a receipt hash — look it up in the persistent store")
  .action(async (hash: string) => {
    console.log(JSON.stringify(await receiptVerifyCmd(hash), null, 2));
  });

receiptGroup
  .command("list")
  .description("List recent receipts from the persistent store")
  .option("-n, --limit <n>", "max receipts to show", "20")
  .action(async (opts) => {
    console.log(JSON.stringify(await receiptListCmd(Number(opts.limit)), null, 2));
  });

// Keep the legacy `receipt --intent --outcome` form working for backward compatibility
program
  .command("receipt-create", { hidden: true })
  .requiredOption("--intent <intent>")
  .requiredOption("--outcome <outcome>")
  .action(async (opts) => {
    console.log(JSON.stringify(await receiptCmd(opts.intent, opts.outcome), null, 2));
  });

program.command("handoff").requiredOption("--task <task>").requiredOption("--goal <goal>").action(async (opts) => {
  console.log(JSON.stringify(await handoffCmd(opts.task, opts.goal), null, 2));
});

program
  .command("workflow")
  .description("Run a typed multi-step agent workflow with provenance receipts and rollback")
  .requiredOption("--goal <goal>", "overall workflow goal")
  .requiredOption("--steps <steps>", "comma-separated list of step specs: id:name,id2:name2")
  .option("--no-stop-on-failure", "continue executing steps after a failure")
  .action(async (opts) => {
    const steps = String(opts.steps)
      .split(",")
      .map((s) => parseStepSpec(s.trim()))
      .filter((s) => s.id);
    const result = await workflowCmd(opts.goal, steps, { stopOnFailure: opts.stopOnFailure });
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("dag")
  .description("Run a DAG-based workflow: parallel steps, provenance receipts, cycle detection")
  .requiredOption("--goal <goal>", "overall workflow goal")
  .requiredOption(
    "--steps <steps>",
    'comma-separated step specs: "id:name" or "id:name[dep1,dep2]"'
  )
  .option("--no-stop-on-failure", "continue after a step failure")
  .action(async (opts) => {
    // Split on commas that are NOT inside brackets to preserve dep lists like [dep1,dep2]
    const raw = String(opts.steps);
    const stepSpecs: string[] = [];
    let depth = 0, cur = "";
    for (const ch of raw) {
      if (ch === "[") { depth++; cur += ch; }
      else if (ch === "]") { depth--; cur += ch; }
      else if (ch === "," && depth === 0) { stepSpecs.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    if (cur.trim()) stepSpecs.push(cur.trim());
    const steps = stepSpecs.map((s) => parseDagStepSpec(s)).filter((s) => s.id);
    const result = await dagCmd(opts.goal, steps, { stopOnFailure: opts.stopOnFailure });
    console.log(JSON.stringify(result, null, 2));
  });

// ─── health ──────────────────────────────────────────────────────────────────
program
  .command("health")
  .description("Check liveness and latency of all key services (A2A, AgentMail, Clawk, network)")
  .option("-t, --target <target>", "service to check: all | a2a | agentmail | clawk | network", "all")
  .action(async (opts) => {
    console.log(JSON.stringify(await healthCmd(opts.target as HealthTarget), null, 2));
  });

// ─── replay ──────────────────────────────────────────────────────────────────
const replayGroup = program
  .command("replay")
  .description("Resume a failed workflow from its last checkpoint, or list saved checkpoints");

replayGroup
  .command("run <workflowId>")
  .description("Resume a failed workflow by its workflowId")
  .option("--steps <steps>", "step specs to re-run: id:name,id2:name2 (same as original workflow)", "")
  .option("--no-stop-on-failure", "continue after a step failure")
  .option("--keep", "keep the checkpoint file even on full success", false)
  .action(async (workflowId: string, opts) => {
    const steps = opts.steps
      ? String(opts.steps)
          .split(",")
          .map((s: string) => parseStepSpec(s.trim()))
          .filter((s: ReturnType<typeof parseStepSpec>) => s.id)
      : [];
    const result = await replayCmd(workflowId, steps, {
      stopOnFailure: opts.stopOnFailure,
      clearOnSuccess: !opts.keep,
    });
    console.log(JSON.stringify(result, null, 2));
  });

replayGroup
  .command("list")
  .description("List all saved checkpoints (workflows that failed and can be replayed)")
  .action(() => {
    console.log(listCheckpointsSummary());
  });

// ─── lint ─────────────────────────────────────────────────────────────────────
program
  .command("lint")
  .description("Validate a workflow or DAG definition before execution")
  .requiredOption("--steps <steps>", "Comma-separated step specs: id[:name][:dep1+dep2][:rollback]")
  .option("--goal <goal>", "Workflow goal/name for reporting", "unnamed")
  .option("--require-rollback", "Error if any step lacks a rollbackCmd", false)
  .option("--warn-steps <n>", "Warn threshold for step count", "20")
  .option("--error-steps <n>", "Error threshold for step count", "50")
  .action((opts) => {
    const steps: LintStep[] = String(opts.steps)
      .split(",")
      .map((spec: string) => {
        const [id, name, deps, rollback] = spec.trim().split(":");
        return {
          id: id ?? "",
          name: name ?? id ?? "",
          dependsOn: deps ? deps.split("+").filter(Boolean) : [],
          ...(rollback ? { rollbackCmd: rollback } : {}),
        };
      })
      .filter((s: LintStep) => s.id);
    const result = lintCmd({
      goal: opts.goal,
      steps,
      policy: {
        requireRollback: opts.requireRollback,
        warnSteps: Number(opts.warnSteps),
        errorSteps: Number(opts.errorSteps),
      },
    });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === "fail" ? 1 : 0);
  });

program.parse();

#!/usr/bin/env node
import {
  dagCmd,
  discoverCmd,
  guardCmd,
  handoffCmd,
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
} from "./chunk-MLFMIK6T.js";

// src/cli.ts
import { Command } from "commander";

// src/commands/health.ts
var TIMEOUT_MS = 6e3;
async function probe(service, url, options = {}) {
  const t0 = Date.now();
  const expectedStatus = options.expectedStatus ?? 200;
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: options.headers ?? {}
    });
    clearTimeout(tid);
    const latencyMs = Date.now() - t0;
    const ok = res.status === expectedStatus || res.status >= 200 && res.status < 300;
    return {
      service,
      url,
      status: ok ? "ok" : "degraded",
      httpCode: res.status,
      latencyMs,
      detail: ok ? void 0 : `unexpected status ${res.status}`
    };
  } catch (err) {
    return {
      service,
      url,
      status: "down",
      latencyMs: Date.now() - t0,
      detail: err instanceof Error ? err.message : String(err)
    };
  }
}
async function checkA2A() {
  return probe(
    "a2a-server",
    "https://gerundium-a2a-production.up.railway.app/.well-known/agent.json"
  );
}
async function checkAgentMail() {
  const apiKey = process.env.AGENTMAIL_API_KEY ?? "";
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch("https://api.agentmail.to/v0/inboxes", {
      method: "GET",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...headers }
    });
    clearTimeout(tid);
    const latencyMs = Date.now() - t0;
    const ok = res.status === 200 || res.status === 401;
    return {
      service: "agentmail",
      url: "https://api.agentmail.to/v0/inboxes",
      status: res.status === 200 ? "ok" : res.status === 401 ? "degraded" : "down",
      httpCode: res.status,
      latencyMs,
      detail: res.status === 200 ? "authenticated" : res.status === 401 ? "reachable (auth check)" : `unexpected ${res.status}`
    };
  } catch (err) {
    return {
      service: "agentmail",
      url: "https://api.agentmail.to/v0/inboxes",
      status: "down",
      latencyMs: Date.now() - t0,
      detail: err instanceof Error ? err.message : String(err)
    };
  }
}
async function checkClawk() {
  return probe("clawk-api", "https://www.clawk.ai/api/v1/agents/me", {
    headers: {
      Authorization: `Bearer ${process.env.CLAWK_API_KEY ?? ""}`,
      "Content-Type": "application/json"
    }
  });
}
async function checkNetwork() {
  return probe("network-dns", "https://1.1.1.1/cdn-cgi/trace");
}
var CHECK_MAP = {
  a2a: checkA2A,
  agentmail: checkAgentMail,
  clawk: checkClawk,
  network: checkNetwork
};
async function healthCmd(target) {
  const started = Date.now();
  const targets = target === "all" ? Object.keys(CHECK_MAP) : [target];
  const checks = await Promise.all(
    targets.map((t) => CHECK_MAP[t] ? CHECK_MAP[t]() : Promise.resolve({
      service: t,
      url: "<unknown>",
      status: "down",
      latencyMs: 0,
      detail: `Unknown target: ${t}`
    }))
  );
  const healthy = checks.filter((c) => c.status === "ok").length;
  const degraded = checks.filter((c) => c.status === "degraded").length;
  const down = checks.filter((c) => c.status === "down").length;
  const totalLatencyMs = checks.reduce((s, c) => s + c.latencyMs, 0);
  const status = down > 0 ? healthy > 0 ? "partial" : "fail" : "ok";
  const errors = checks.filter((c) => c.status === "down").map((c) => `${c.service} is DOWN: ${c.detail ?? "no detail"}`);
  const warnings = checks.filter((c) => c.status === "degraded").map((c) => `${c.service} is degraded: ${c.detail ?? "no detail"}`);
  return makeReport(
    "health",
    started,
    status,
    { target, checks, healthy, degraded, down, totalLatencyMs },
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
program.parse();

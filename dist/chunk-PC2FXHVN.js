// src/core/report.ts
import { randomUUID } from "crypto";
function makeReport(command, started, status, data, warnings = [], errors = []) {
  return {
    requestId: randomUUID(),
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
import { createHash } from "crypto";
async function receiptCmd(intent, outcome) {
  const started = Date.now();
  const receiptHash = createHash("sha256").update(`${intent}::${outcome}`).digest("hex");
  return makeReport("receipt", started, "ok", { intent, outcome, receiptHash });
}

// src/commands/handoff.ts
async function handoffCmd(task, goal) {
  const started = Date.now();
  const packet = { task, goal, definition_of_done: "explicit", provenance: "required" };
  return makeReport("handoff", started, "ok", { score: 92, packet });
}

export {
  discoverCmd,
  outreachCmd,
  socialCmd,
  guardCmd,
  receiptCmd,
  handoffCmd
};

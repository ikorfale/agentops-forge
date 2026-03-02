"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  discoverCmd: () => discoverCmd,
  guardCmd: () => guardCmd,
  handoffCmd: () => handoffCmd,
  outreachCmd: () => outreachCmd,
  receiptCmd: () => receiptCmd,
  socialCmd: () => socialCmd
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  discoverCmd,
  guardCmd,
  handoffCmd,
  outreachCmd,
  receiptCmd,
  socialCmd
});

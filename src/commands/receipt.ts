import { createHash } from "node:crypto";
import { makeReport } from "../core/report.js";

export async function receiptCmd(intent: string, outcome: string) {
  const started = Date.now();
  const receiptHash = createHash("sha256").update(`${intent}::${outcome}`).digest("hex");
  return makeReport("receipt", started, "ok", { intent, outcome, receiptHash });
}

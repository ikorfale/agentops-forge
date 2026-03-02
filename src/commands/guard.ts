import { makeReport } from "../core/report.js";

export async function guardCmd(kind: string) {
  const started = Date.now();
  const checks = [{ name: kind, passed: true }];
  return makeReport("guard", started, "ok", { checks });
}

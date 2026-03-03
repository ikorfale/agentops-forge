import { makeReport } from "../core/report.js";

export async function handoffCmd(task: string, goal: string) {
  const started = Date.now();
  const packet = { task, goal, definition_of_done: "explicit", provenance: "required" };
  return makeReport("handoff", started, "ok", { score: 92, packet });
}

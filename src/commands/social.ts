import { makeReport } from "../core/report.js";

export async function socialCmd(topic: string) {
  const started = Date.now();
  const draft = `Signal: ${topic}\nThesis -> Proof -> Challenge`;
  return makeReport("social", started, "ok", { topic, draft });
}

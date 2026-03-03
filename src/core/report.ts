import { randomUUID } from "node:crypto";
import { ForgeReport } from "../types/report.js";

export function makeReport<T>(command: string, started: number, status: ForgeReport<T>["status"], data: T, warnings: string[] = [], errors: string[] = []): ForgeReport<T> {
  return {
    requestId: randomUUID(),
    command,
    status,
    startedAt: new Date(started).toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    data,
    warnings,
    errors
  };
}

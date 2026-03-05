export type ForgeStatus = "ok" | "fail" | "partial";

export interface ForgeReport<T = unknown> {
  requestId: string;
  command: string;
  status: ForgeStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  traceparent?: string;
  data: T;
  warnings: string[];
  errors: string[];
}

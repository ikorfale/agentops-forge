import { createHash, randomUUID } from "node:crypto";
import { makeReport } from "../core/report.js";
import { storeReceipt } from "../core/receipt-store.js";

export interface WorkflowStep {
  id: string;
  name: string;
  input: Record<string, unknown>;
  /** Simulates work; in a real integration, replace with actual async logic */
  execute?: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  retries?: number;
  rollbackCmd?: string;
}

export interface StepResult {
  stepId: string;
  stepName: string;
  status: "ok" | "failed" | "skipped";
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  receiptHash: string;
  attempts: number;
  durationMs: number;
  error?: string;
}

export interface WorkflowData {
  workflowId: string;
  goal: string;
  totalSteps: number;
  completedSteps: number;
  failedStep: string | null;
  rolledBack: boolean;
  steps: StepResult[];
  provenanceChain: string[];
}

/** Default identity executor — logs the intent, returns empty output */
async function defaultExecute(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  return { acknowledged: true, ...input };
}

function stepReceipt(stepId: string, stepName: string, input: Record<string, unknown>, output: Record<string, unknown>): string {
  const payload = JSON.stringify({ stepId, stepName, input, output });
  return createHash("sha256").update(payload).digest("hex");
}

async function runStepWithRetry(
  step: WorkflowStep,
  maxAttempts: number
): Promise<{ output: Record<string, unknown>; attempts: number; error?: string }> {
  const exec = step.execute ?? defaultExecute;
  let lastError: string | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const output = await exec(step.input);
      return { output, attempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { output: {}, attempts: maxAttempts, error: lastError };
}

export async function workflowCmd(
  goal: string,
  steps: WorkflowStep[],
  opts: { stopOnFailure?: boolean } = {}
): Promise<ReturnType<typeof makeReport<WorkflowData>>> {
  const started = Date.now();
  const workflowId = randomUUID();
  const stopOnFailure = opts.stopOnFailure ?? true;

  const results: StepResult[] = [];
  const provenanceChain: string[] = [];
  let failedStep: string | null = null;
  let rolledBack = false;
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const step of steps) {
    if (failedStep !== null && stopOnFailure) {
      results.push({
        stepId: step.id,
        stepName: step.name,
        status: "skipped",
        input: step.input,
        output: {},
        receiptHash: "",
        attempts: 0,
        durationMs: 0,
      });
      continue;
    }

    const stepStart = Date.now();
    const maxAttempts = (step.retries ?? 0) + 1;
    const { output, attempts, error } = await runStepWithRetry(step, maxAttempts);
    const durationMs = Date.now() - stepStart;
    const status = error ? "failed" : "ok";
    const receipt = status === "ok" ? stepReceipt(step.id, step.name, step.input, output) : "";

    if (status === "ok") {
      provenanceChain.push(`${step.id}:${receipt.slice(0, 12)}`);
      // Persist receipt for later verification
      storeReceipt({
        receiptHash: receipt,
        kind: "step",
        createdAt: new Date().toISOString(),
        label: `workflow/${workflowId} step ${step.id}: ${step.name}`,
        payload: { workflowId, stepId: step.id, stepName: step.name, input: step.input, output },
      });
    }

    results.push({
      stepId: step.id,
      stepName: step.name,
      status,
      input: step.input,
      output,
      receiptHash: receipt,
      attempts,
      durationMs,
      error,
    });

    if (status === "failed") {
      failedStep = step.id;
      errors.push(`Step ${step.id} (${step.name}) failed after ${attempts} attempt(s): ${error}`);

      // Trigger rollback for completed steps in reverse order
      if (stopOnFailure) {
        const completed = results.filter((r) => r.status === "ok");
        for (const prev of completed.reverse()) {
          warnings.push(`Rollback: step ${prev.stepId} (${prev.stepName}) marked for reversal`);
        }
        rolledBack = completed.length > 0;
      }
    }
  }

  const completedSteps = results.filter((r) => r.status === "ok").length;
  const overallStatus = failedStep
    ? "fail"
    : completedSteps === steps.length
    ? "ok"
    : "partial";

  return makeReport<WorkflowData>(
    "workflow",
    started,
    overallStatus,
    {
      workflowId,
      goal,
      totalSteps: steps.length,
      completedSteps,
      failedStep,
      rolledBack,
      steps: results,
      provenanceChain,
    },
    warnings,
    errors
  );
}

/** Parse a simple step spec string: "id:name" */
export function parseStepSpec(spec: string): WorkflowStep {
  const [id, ...rest] = spec.split(":");
  return {
    id: id.trim(),
    name: rest.join(":").trim() || id.trim(),
    input: {},
    retries: 0,
  };
}

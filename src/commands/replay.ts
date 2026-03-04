/**
 * replay.ts — Resume a failed workflow from its last successful checkpoint
 *
 * When a `workflowCmd` run fails mid-way, this command loads the saved
 * checkpoint, skips already-completed steps (preserving their outputs and
 * receipt hashes), and resumes execution from the failed or pending step.
 *
 * Usage:
 *   const report = await replayCmd(workflowId, steps);
 *
 * The resumed run produces a new combined report with the full step history
 * and a fresh provenance chain that includes both carried-over and new receipts.
 */

import { createHash, randomUUID } from "node:crypto";
import { makeReport } from "../core/report.js";
import { storeReceipt } from "../core/receipt-store.js";
import {
  loadCheckpoint,
  saveCheckpoint,
  clearCheckpoint,
  listCheckpoints,
  type CheckpointStep,
  type WorkflowCheckpoint,
} from "../core/checkpoint-store.js";
import type { WorkflowStep, StepResult, WorkflowData } from "./workflow.js";

export type { WorkflowCheckpoint };
export { listCheckpoints };

// ─── helpers ────────────────────────────────────────────────────────────────

async function defaultExecute(
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return { acknowledged: true, ...input };
}

function computeReceipt(
  stepId: string,
  stepName: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>
): string {
  return createHash("sha256")
    .update(JSON.stringify({ stepId, stepName, input, output }))
    .digest("hex");
}

async function runWithRetry(
  step: WorkflowStep,
  maxAttempts: number
): Promise<{ output: Record<string, unknown>; attempts: number; error?: string }> {
  const exec = step.execute ?? defaultExecute;
  let lastError: string | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return { output: await exec(step.input), attempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { output: {}, attempts: maxAttempts, error: lastError };
}

// ─── core ────────────────────────────────────────────────────────────────────

export interface ReplayOptions {
  stopOnFailure?: boolean;
  /** If true, clear the checkpoint file after a successful replay */
  clearOnSuccess?: boolean;
}

/**
 * Resume a workflow from a saved checkpoint.
 *
 * @param workflowId  The UUID from the original (failed) workflowCmd run.
 * @param steps       The full step array — same definition as the original call.
 *                    Already-completed steps are skipped automatically.
 * @param opts        Replay options.
 */
export async function replayCmd(
  workflowId: string,
  steps: WorkflowStep[],
  opts: ReplayOptions = {}
): Promise<ReturnType<typeof makeReport<WorkflowData>>> {
  const started = Date.now();
  const stopOnFailure = opts.stopOnFailure ?? true;
  const clearOnSuccess = opts.clearOnSuccess ?? true;

  // ── 1. Load checkpoint ──────────────────────────────────────────────────
  const checkpoint = loadCheckpoint(workflowId);
  if (!checkpoint) {
    return makeReport<WorkflowData>(
      "replay",
      started,
      "fail",
      {
        workflowId,
        goal: `<replay: no checkpoint found for ${workflowId}>`,
        totalSteps: steps.length,
        completedSteps: 0,
        failedStep: null,
        rolledBack: false,
        steps: [],
        provenanceChain: [],
      },
      [],
      [`No checkpoint found for workflowId: ${workflowId}`]
    );
  }

  const goal = checkpoint.goal;

  // ── 2. Build a set of already-completed step IDs ────────────────────────
  const completedById = new Map<string, CheckpointStep>(
    checkpoint.completedSteps.map((s) => [s.stepId, s])
  );

  // ── 3. Reconstruct carried-over results ─────────────────────────────────
  const results: StepResult[] = [];
  const provenanceChain: string[] = [];

  for (const cs of checkpoint.completedSteps) {
    results.push(cs as StepResult);
    provenanceChain.push(cs.receiptHash);
  }

  // ── 4. Execute pending / failed steps ───────────────────────────────────
  const warnings: string[] = [];
  const errors: string[] = [];
  let failedStep: string | null = null;
  let rolledBack = false;

  for (const step of steps) {
    // Skip steps that already completed successfully
    if (completedById.has(step.id)) {
      continue;
    }

    const maxAttempts = Math.max(1, (step.retries ?? 0) + 1);
    const stepStart = Date.now();
    const { output, attempts, error } = await runWithRetry(step, maxAttempts);
    const durationMs = Date.now() - stepStart;

    const status: "ok" | "failed" = error ? "failed" : "ok";
    const receiptHash = computeReceipt(step.id, step.name, step.input, output);

    // Persist receipt to store
    storeReceipt({
      receiptHash,
      kind: "step",
      createdAt: new Date().toISOString(),
      label: `${step.id}:${step.name}`,
      payload: { stepId: step.id, stepName: step.name, input: step.input, output },
    });

    provenanceChain.push(receiptHash);

    const result: StepResult = {
      stepId: step.id,
      stepName: step.name,
      status,
      input: step.input,
      output,
      receiptHash,
      attempts,
      durationMs,
      error,
    };
    results.push(result);

    if (status === "ok") {
      // Update checkpoint incrementally
      const updatedCheckpoint: WorkflowCheckpoint = {
        ...checkpoint,
        completedSteps: [...checkpoint.completedSteps, result as CheckpointStep],
        pendingStepIds: checkpoint.pendingStepIds.filter((id) => id !== step.id),
        failedStepId: null,
      };
      saveCheckpoint(updatedCheckpoint);
    } else {
      failedStep = step.id;
      errors.push(`Step ${step.id} (${step.name}) failed after ${attempts} attempt(s): ${error}`);

      if (stopOnFailure) {
        const completed = results.filter((r) => r.status === "ok");
        for (const prev of completed.reverse()) {
          warnings.push(`Rollback: step ${prev.stepId} (${prev.stepName}) marked for reversal`);
        }
        rolledBack = completed.length > 0;
        break;
      }
    }
  }

  // Mark remaining steps as skipped if we stopped early
  const executedIds = new Set(results.map((r) => r.stepId));
  for (const step of steps) {
    if (!executedIds.has(step.id)) {
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
    }
  }

  const completedCount = results.filter((r) => r.status === "ok").length;
  const overallStatus = failedStep
    ? "fail"
    : completedCount === steps.length
    ? "ok"
    : "partial";

  // Clear checkpoint on full success
  if (overallStatus === "ok" && clearOnSuccess) {
    clearCheckpoint(workflowId);
  }

  return makeReport<WorkflowData>(
    "replay",
    started,
    overallStatus,
    {
      workflowId,
      goal,
      totalSteps: steps.length,
      completedSteps: completedCount,
      failedStep,
      rolledBack,
      steps: results,
      provenanceChain,
    },
    warnings,
    errors
  );
}

/**
 * List all saved checkpoints (workflows that failed and can be replayed).
 * Returns a formatted summary string suitable for CLI display.
 */
export function listCheckpointsSummary(): string {
  const checkpoints = listCheckpoints();
  if (checkpoints.length === 0) {
    return "No saved checkpoints. All workflows completed cleanly.";
  }
  const lines = ["Saved workflow checkpoints:", ""];
  for (const cp of checkpoints) {
    lines.push(`  workflowId: ${cp.workflowId}`);
    lines.push(`  goal:       ${cp.goal}`);
    lines.push(`  savedAt:    ${cp.savedAt}`);
    lines.push(`  completed:  ${cp.completedCount} steps`);
    lines.push(`  pending:    ${cp.pendingCount} steps`);
    lines.push(`  failed:     ${cp.failedStepId ?? "none"}`);
    lines.push("");
  }
  return lines.join("\n");
}

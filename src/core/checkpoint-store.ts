/**
 * checkpoint-store.ts — Persistent workflow checkpoint storage for AgentOps Forge
 *
 * When a workflow step completes, its result is checkpointed to disk.
 * If the workflow fails, `replayCmd` can load the checkpoint and resume
 * from the last successful step instead of starting from scratch.
 *
 * Storage: ~/.forge/checkpoints/<workflowId>.json (one file per workflow run)
 */

import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface CheckpointStep {
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

export interface WorkflowCheckpoint {
  /** UUID matching the original workflowCmd run */
  workflowId: string;
  /** Human-readable goal */
  goal: string;
  /** ISO-8601 timestamp when the checkpoint was last written */
  savedAt: string;
  /** Steps that completed successfully (status === "ok") */
  completedSteps: CheckpointStep[];
  /** Step IDs still pending at the time the checkpoint was saved */
  pendingStepIds: string[];
  /** Step ID that failed, if any */
  failedStepId: string | null;
}

const CHECKPOINT_DIR = join(homedir(), ".forge", "checkpoints");

function ensureDir(): void {
  if (!existsSync(CHECKPOINT_DIR)) {
    mkdirSync(CHECKPOINT_DIR, { recursive: true });
  }
}

function checkpointPath(workflowId: string): string {
  return join(CHECKPOINT_DIR, `${workflowId}.json`);
}

/** Save or update a checkpoint for an in-progress workflow. */
export function saveCheckpoint(checkpoint: WorkflowCheckpoint): void {
  ensureDir();
  writeFileSync(
    checkpointPath(checkpoint.workflowId),
    JSON.stringify({ ...checkpoint, savedAt: new Date().toISOString() }, null, 2),
    "utf8"
  );
}

/** Load a checkpoint by workflowId. Returns null if not found or corrupted. */
export function loadCheckpoint(workflowId: string): WorkflowCheckpoint | null {
  const path = checkpointPath(workflowId);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as WorkflowCheckpoint;
  } catch {
    return null;
  }
}

/** Delete a checkpoint once a workflow completes successfully. */
export function clearCheckpoint(workflowId: string): boolean {
  const path = checkpointPath(workflowId);
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}

export interface CheckpointSummary {
  workflowId: string;
  goal: string;
  savedAt: string;
  completedCount: number;
  pendingCount: number;
  failedStepId: string | null;
}

/** List all saved checkpoints (unfinished workflows). */
export function listCheckpoints(): CheckpointSummary[] {
  ensureDir();
  const files = readdirSync(CHECKPOINT_DIR).filter((f) => f.endsWith(".json"));
  const summaries: CheckpointSummary[] = [];
  for (const file of files) {
    try {
      const cp: WorkflowCheckpoint = JSON.parse(
        readFileSync(join(CHECKPOINT_DIR, file), "utf8")
      );
      summaries.push({
        workflowId: cp.workflowId,
        goal: cp.goal,
        savedAt: cp.savedAt,
        completedCount: cp.completedSteps.length,
        pendingCount: cp.pendingStepIds.length,
        failedStepId: cp.failedStepId,
      });
    } catch {
      // skip corrupted files
    }
  }
  return summaries.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

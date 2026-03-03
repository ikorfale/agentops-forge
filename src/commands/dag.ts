/**
 * dag.ts — DAG-based parallel workflow executor for AgentOps Forge
 *
 * Runs workflow steps in topological order, parallelising steps whose
 * dependencies are already satisfied.  Full provenance chain (SHA-256
 * receipt per step) is emitted in the report.
 */

import { createHash, randomUUID } from "node:crypto";
import { makeReport } from "../core/report.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DagStep {
  id: string;
  name: string;
  /** IDs of steps that must complete before this one starts */
  dependsOn?: string[];
  /** Resolved at call time; defaults to identity executor */
  execute?: (input: DagInput) => Promise<Record<string, unknown>>;
  /** Number of retry attempts on transient failures */
  retries?: number;
  /** Static input; resolved outputs from dependencies are merged in */
  input?: Record<string, unknown>;
}

export interface DagInput {
  step: DagStep;
  /** Merged outputs from all dependency steps */
  upstream: Record<string, Record<string, unknown>>;
  staticInput: Record<string, unknown>;
}

export interface DagStepResult {
  stepId: string;
  stepName: string;
  status: "ok" | "failed" | "skipped";
  dependsOn: string[];
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  receiptHash: string;
  attempts: number;
  durationMs: number;
  startedAt: string;
  finishedAt: string;
  error?: string;
}

export interface DagWorkflowData {
  workflowId: string;
  goal: string;
  totalSteps: number;
  completedSteps: number;
  failedSteps: string[];
  skippedSteps: string[];
  parallelBatches: number;
  maxConcurrency: number;
  steps: DagStepResult[];
  provenanceChain: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stepReceipt(
  stepId: string,
  stepName: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>
): string {
  const payload = JSON.stringify({ stepId, stepName, input, output });
  return createHash("sha256").update(payload).digest("hex");
}

async function defaultExecute(dagInput: DagInput): Promise<Record<string, unknown>> {
  return { acknowledged: true, ...dagInput.staticInput };
}

async function runWithRetry(
  step: DagStep,
  dagInput: DagInput,
  maxAttempts: number
): Promise<{ output: Record<string, unknown>; attempts: number; error?: string }> {
  const exec = step.execute ?? defaultExecute;
  let lastError: string | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const output = await exec(dagInput);
      return { output, attempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { output: {}, attempts: maxAttempts, error: lastError };
}

/**
 * Topological sort via Kahn's algorithm.
 * Returns batches — steps within a batch are independent and can run in parallel.
 * Throws if a cycle is detected.
 */
function topologicalBatches(steps: DagStep[]): DagStep[][] {
  const idSet = new Set(steps.map((s) => s.id));
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>(); // parent → children

  for (const s of steps) {
    inDegree.set(s.id, 0);
    children.set(s.id, []);
  }

  for (const s of steps) {
    for (const dep of s.dependsOn ?? []) {
      if (!idSet.has(dep)) {
        throw new Error(`Step "${s.id}" depends on unknown step "${dep}"`);
      }
      inDegree.set(s.id, (inDegree.get(s.id) ?? 0) + 1);
      children.get(dep)!.push(s.id);
    }
  }

  const batches: DagStep[][] = [];
  const remaining = new Set(steps.map((s) => s.id));
  const stepById = new Map(steps.map((s) => [s.id, s]));

  while (remaining.size > 0) {
    const ready = [...remaining].filter((id) => (inDegree.get(id) ?? 0) === 0);
    if (ready.length === 0) {
      throw new Error(`Cycle detected among steps: ${[...remaining].join(", ")}`);
    }
    batches.push(ready.map((id) => stepById.get(id)!));
    for (const id of ready) {
      remaining.delete(id);
      for (const child of children.get(id) ?? []) {
        inDegree.set(child, (inDegree.get(child) ?? 0) - 1);
      }
    }
  }

  return batches;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function dagCmd(
  goal: string,
  steps: DagStep[],
  opts: { stopOnFailure?: boolean } = {}
): Promise<ReturnType<typeof makeReport<DagWorkflowData>>> {
  const started = Date.now();
  const workflowId = randomUUID();
  const stopOnFailure = opts.stopOnFailure ?? true;

  // Validate and compute execution order
  let batches: DagStep[][];
  try {
    batches = topologicalBatches(steps);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return makeReport<DagWorkflowData>("dag", started, "fail", {
      workflowId,
      goal,
      totalSteps: steps.length,
      completedSteps: 0,
      failedSteps: [],
      skippedSteps: [],
      parallelBatches: 0,
      maxConcurrency: 0,
      steps: [],
      provenanceChain: [],
    }, [], [msg]);
  }

  const results = new Map<string, DagStepResult>();
  const completedOutputs = new Map<string, Record<string, unknown>>();
  const failedIds = new Set<string>();
  const skippedIds = new Set<string>();
  const provenanceChain: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let parallelBatches = 0;
  let maxConcurrency = 0;

  for (const batch of batches) {
    if (stopOnFailure && failedIds.size > 0) {
      // Skip remaining steps
      for (const step of batch) {
        skippedIds.add(step.id);
        results.set(step.id, {
          stepId: step.id,
          stepName: step.name,
          status: "skipped",
          dependsOn: step.dependsOn ?? [],
          input: step.input ?? {},
          output: {},
          receiptHash: "",
          attempts: 0,
          durationMs: 0,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        });
      }
      continue;
    }

    parallelBatches++;
    maxConcurrency = Math.max(maxConcurrency, batch.length);

    // Execute all steps in this batch concurrently
    const batchPromises = batch.map(async (step) => {
      const stepStart = Date.now();
      const startedAt = new Date().toISOString();

      // Resolve upstream outputs from dependencies
      const upstream: Record<string, Record<string, unknown>> = {};
      for (const dep of step.dependsOn ?? []) {
        upstream[dep] = completedOutputs.get(dep) ?? {};
      }

      const dagInput: DagInput = {
        step,
        upstream,
        staticInput: step.input ?? {},
      };

      const maxAttempts = (step.retries ?? 0) + 1;
      const { output, attempts, error } = await runWithRetry(step, dagInput, maxAttempts);
      const durationMs = Date.now() - stepStart;
      const finishedAt = new Date().toISOString();
      const status: DagStepResult["status"] = error ? "failed" : "ok";
      const receipt = status === "ok" ? stepReceipt(step.id, step.name, step.input ?? {}, output) : "";

      return {
        stepId: step.id,
        stepName: step.name,
        status,
        dependsOn: step.dependsOn ?? [],
        input: step.input ?? {},
        output,
        receiptHash: receipt,
        attempts,
        durationMs,
        startedAt,
        finishedAt,
        error,
      } as DagStepResult;
    });

    const batchResults = await Promise.all(batchPromises);

    for (const result of batchResults) {
      results.set(result.stepId, result);
      if (result.status === "ok") {
        completedOutputs.set(result.stepId, result.output);
        provenanceChain.push(`${result.stepId}:${result.receiptHash.slice(0, 12)}`);
      } else {
        failedIds.add(result.stepId);
        errors.push(
          `Step "${result.stepId}" (${result.stepName}) failed after ${result.attempts} attempt(s): ${result.error}`
        );
        if (stopOnFailure) {
          warnings.push(
            `Stopping DAG execution after step "${result.stepId}" failed. Subsequent steps will be skipped.`
          );
        }
      }
    }
  }

  const allResults = steps.map((s) => results.get(s.id)!);
  const completedSteps = allResults.filter((r) => r.status === "ok").length;
  const overallStatus =
    failedIds.size > 0 ? "fail" : completedSteps === steps.length ? "ok" : "partial";

  return makeReport<DagWorkflowData>(
    "dag",
    started,
    overallStatus,
    {
      workflowId,
      goal,
      totalSteps: steps.length,
      completedSteps,
      failedSteps: [...failedIds],
      skippedSteps: [...skippedIds],
      parallelBatches,
      maxConcurrency,
      steps: allResults,
      provenanceChain,
    },
    warnings,
    errors
  );
}

/** Parse extended step spec: "id:name[dep1,dep2]" */
export function parseDagStepSpec(spec: string): DagStep {
  const depMatch = spec.match(/\[([^\]]*)\]$/);
  const deps = depMatch ? depMatch[1].split(",").map((d) => d.trim()).filter(Boolean) : [];
  const base = spec.replace(/\[[^\]]*\]$/, "").trim();
  const [id, ...rest] = base.split(":");
  return {
    id: id.trim(),
    name: rest.join(":").trim() || id.trim(),
    dependsOn: deps,
    input: {},
  };
}

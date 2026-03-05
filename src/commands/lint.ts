/**
 * lint.ts — Workflow/DAG definition linter for AgentOps Forge
 *
 * Validates workflow and DAG definitions before execution.
 * Catches structural issues, policy violations, and risk patterns
 * that would cause runtime failures or silent misbehaviour.
 *
 * Checks performed:
 *   - Duplicate step IDs
 *   - Missing dependency references (depends on non-existent step)
 *   - Circular dependencies (cycle detection via DFS)
 *   - Unreachable steps (steps with no path from any root)
 *   - Empty workflow (zero steps)
 *   - Missing required fields (id, name)
 *   - Over-large workflows (policy: >20 steps warns; >50 errors)
 *   - Steps with no rollbackCmd (warns if workflow has >1 step)
 */

import { makeReport } from "../core/report.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LintStep {
  id: string;
  name?: string;
  dependsOn?: string[];
  rollbackCmd?: string;
  [key: string]: unknown;
}

export interface LintOptions {
  /** Workflow goal / name for reporting */
  goal?: string;
  /** Steps to lint (WorkflowStep or DagStep shape) */
  steps: LintStep[];
  /**
   * Policy thresholds.
   * `warnSteps`: warn when step count exceeds this (default 20).
   * `errorSteps`: error when step count exceeds this (default 50).
   * `requireRollback`: error if any step lacks rollbackCmd (default false).
   */
  policy?: {
    warnSteps?: number;
    errorSteps?: number;
    requireRollback?: boolean;
  };
}

export interface LintViolation {
  code: string;
  severity: "error" | "warning";
  stepId?: string;
  message: string;
}

export interface LintData {
  goal: string;
  totalSteps: number;
  status: "pass" | "warn" | "fail";
  errorCount: number;
  warningCount: number;
  violations: LintViolation[];
  checkedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectCycles(steps: LintStep[]): string[][] {
  const adj = new Map<string, string[]>();
  for (const s of steps) {
    adj.set(s.id, s.dependsOn ?? []);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(node: string, path: string[]): void {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      cycles.push(path.slice(cycleStart).concat(node));
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    for (const dep of adj.get(node) ?? []) {
      dfs(dep, [...path]);
    }

    inStack.delete(node);
    visited.delete(node); // allow re-detection from different roots
  }

  for (const s of steps) {
    if (!visited.has(s.id)) dfs(s.id, []);
  }

  // Deduplicate cycles by canonical form
  const seen = new Set<string>();
  return cycles.filter((c) => {
    const key = [...c].sort().join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findUnreachable(steps: LintStep[]): string[] {
  if (steps.length === 0) return [];

  // In a sequential workflow (no dependsOn on any step), skip — no concept of unreachable
  const hasDeps = steps.some((s) => (s.dependsOn ?? []).length > 0);
  if (!hasDeps) return [];

  const ids = new Set(steps.map((s) => s.id));

  // Roots: steps with no dependsOn (starting points of the DAG)
  const roots = steps.filter((s) => (s.dependsOn ?? []).length === 0).map((s) => s.id);

  // BFS forward: from roots, follow edges (root → steps that depend on root)
  const reachable = new Set<string>(roots);
  const queue = [...roots];
  while (queue.length > 0) {
    const node = queue.shift()!;
    // Children: steps that list `node` as a dependency
    for (const s of steps) {
      if (!reachable.has(s.id) && (s.dependsOn ?? []).includes(node)) {
        reachable.add(s.id);
        queue.push(s.id);
      }
    }
  }

  return [...ids].filter((id) => !reachable.has(id));
}

// ─── Core lint function ───────────────────────────────────────────────────────

export function lintWorkflow(options: LintOptions): LintData {
  const { steps, goal = "unnamed", policy = {} } = options;
  const warnSteps = policy.warnSteps ?? 20;
  const errorSteps = policy.errorSteps ?? 50;
  const requireRollback = policy.requireRollback ?? false;

  const violations: LintViolation[] = [];
  const ids = new Set<string>();

  // ── Check: empty workflow
  if (steps.length === 0) {
    violations.push({
      code: "E001",
      severity: "error",
      message: "Workflow has no steps.",
    });
  }

  // ── Check: size policy
  if (steps.length > errorSteps) {
    violations.push({
      code: "E002",
      severity: "error",
      message: `Workflow has ${steps.length} steps (policy limit: ${errorSteps}).`,
    });
  } else if (steps.length > warnSteps) {
    violations.push({
      code: "W001",
      severity: "warning",
      message: `Workflow has ${steps.length} steps (warn threshold: ${warnSteps}). Consider splitting.`,
    });
  }

  for (const step of steps) {
    // ── Check: missing id
    if (!step.id || step.id.trim() === "") {
      violations.push({
        code: "E003",
        severity: "error",
        message: "Step is missing required field 'id'.",
      });
      continue;
    }

    // ── Check: missing name
    if (!step.name || String(step.name).trim() === "") {
      violations.push({
        code: "W002",
        severity: "warning",
        stepId: step.id,
        message: `Step '${step.id}' is missing field 'name'.`,
      });
    }

    // ── Check: duplicate id
    if (ids.has(step.id)) {
      violations.push({
        code: "E004",
        severity: "error",
        stepId: step.id,
        message: `Duplicate step id: '${step.id}'.`,
      });
    } else {
      ids.add(step.id);
    }

    // ── Check: rollback policy
    if (requireRollback && !step.rollbackCmd) {
      violations.push({
        code: "E005",
        severity: "error",
        stepId: step.id,
        message: `Step '${step.id}' has no rollbackCmd (policy: requireRollback=true).`,
      });
    } else if (steps.length > 1 && !step.rollbackCmd) {
      violations.push({
        code: "W003",
        severity: "warning",
        stepId: step.id,
        message: `Step '${step.id}' has no rollbackCmd. Consider adding one for failure recovery.`,
      });
    }
  }

  // ── Check: missing dependency references
  const allIds = new Set(steps.map((s) => s.id));
  for (const step of steps) {
    for (const dep of step.dependsOn ?? []) {
      if (!allIds.has(dep)) {
        violations.push({
          code: "E006",
          severity: "error",
          stepId: step.id,
          message: `Step '${step.id}' depends on unknown step '${dep}'.`,
        });
      }
    }
  }

  // ── Check: cycles
  const cycles = detectCycles(steps);
  for (const cycle of cycles) {
    violations.push({
      code: "E007",
      severity: "error",
      message: `Circular dependency detected: ${cycle.join(" → ")}.`,
    });
  }

  // ── Check: unreachable steps (DAG only)
  const unreachable = findUnreachable(steps);
  for (const stepId of unreachable) {
    violations.push({
      code: "W004",
      severity: "warning",
      stepId,
      message: `Step '${stepId}' is unreachable (no path from any root step).`,
    });
  }

  const errorCount = violations.filter((v) => v.severity === "error").length;
  const warningCount = violations.filter((v) => v.severity === "warning").length;
  const status: LintData["status"] =
    errorCount > 0 ? "fail" : warningCount > 0 ? "warn" : "pass";

  return {
    goal,
    totalSteps: steps.length,
    status,
    errorCount,
    warningCount,
    violations,
    checkedAt: new Date().toISOString(),
  };
}

// ─── CLI wrapper ──────────────────────────────────────────────────────────────

export interface LintCmdOptions {
  goal?: string;
  steps: LintStep[];
  policy?: LintOptions["policy"];
}

export function lintCmd(options: LintCmdOptions) {
  const started = Date.now();
  const data = lintWorkflow(options);

  const statusIcon =
    data.status === "pass" ? "✓" : data.status === "warn" ? "⚠" : "✗";
  const summary = `lint ${statusIcon} ${data.status.toUpperCase()} — ${data.totalSteps} steps, ${data.errorCount} errors, ${data.warningCount} warnings`;

  // Embed summary into data for reporting
  (data as LintData & { summary: string }).summary = summary;

  const errors = data.violations
    .filter((v) => v.severity === "error")
    .map((v) => `[${v.code}]${v.stepId ? ` (${v.stepId})` : ""} ${v.message}`);
  const warnings = data.violations
    .filter((v) => v.severity === "warning")
    .map((v) => `[${v.code}]${v.stepId ? ` (${v.stepId})` : ""} ${v.message}`);

  return makeReport(
    "lint",
    started,
    data.status === "fail" ? "fail" : "ok",
    data,
    warnings,
    errors,
  );
}

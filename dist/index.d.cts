type ForgeStatus = "ok" | "fail" | "partial";
interface ForgeReport<T = unknown> {
    requestId: string;
    command: string;
    status: ForgeStatus;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    traceparent?: string;
    data: T;
    warnings?: string[];
    errors?: string[];
}

declare function discoverCmd(query: string, limit?: number): Promise<ForgeReport<{
    query: string;
    count: number;
    items: {
        source: string;
        title: string;
        score: number;
    }[];
}>>;

declare function outreachCmd(targets: string[], dryRun?: boolean): Promise<ForgeReport<{
    dryRun: boolean;
    total: number;
    prepared: {
        target: string;
        channel: string;
        status: string;
    }[];
}>>;

declare function socialCmd(topic: string): Promise<ForgeReport<{
    topic: string;
    draft: string;
}>>;

declare function makeReport<T>(command: string, started: number, status: ForgeReport<T>["status"], data: T, warnings?: string[], errors?: string[]): ForgeReport<T>;

type GuardKind = "env" | "files" | "network" | "schema" | string;
/**
 * Run pre-flight checks for the given guard kind.
 *
 * Supported built-in kinds:
 *   env     — verify that common required env vars are set
 *   files   — verify agent workspace files are present
 *   network — verify internet reachability via DNS
 *   schema  — verify JSON schema compliance (stub, always pass)
 *   <any>   — generic single check (passes)
 */
declare function guardCmd(kind: GuardKind): Promise<ReturnType<typeof makeReport<GuardData>>>;

declare function receiptCmd(intent: string, outcome: string): Promise<ForgeReport<{
    intent: string;
    outcome: string;
    receiptHash: string;
}>>;
interface ReceiptVerifyData {
    hash: string;
    found: boolean;
    receipt?: {
        receiptHash: string;
        kind: string;
        createdAt: string;
        label: string;
        payload: Record<string, unknown>;
        requestId?: string;
    };
    storePath: string;
}
declare function receiptVerifyCmd(hash: string): Promise<ForgeReport<ReceiptVerifyData>>;
interface ReceiptListData {
    count: number;
    receipts: Array<{
        receiptHash: string;
        kind: string;
        createdAt: string;
        label: string;
    }>;
    storePath: string;
}
declare function receiptListCmd(limit?: number): Promise<ForgeReport<ReceiptListData>>;

declare function handoffCmd(task: string, goal: string): Promise<ForgeReport<{
    score: number;
    packet: {
        task: string;
        goal: string;
        definition_of_done: string;
        provenance: string;
    };
}>>;

interface WorkflowStep {
    id: string;
    name: string;
    input: Record<string, unknown>;
    /** Simulates work; in a real integration, replace with actual async logic */
    execute?: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    retries?: number;
    rollbackCmd?: string;
}
interface StepResult {
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
interface WorkflowData {
    workflowId: string;
    goal: string;
    totalSteps: number;
    completedSteps: number;
    failedStep: string | null;
    rolledBack: boolean;
    steps: StepResult[];
    provenanceChain: string[];
}
declare function workflowCmd(goal: string, steps: WorkflowStep[], opts?: {
    stopOnFailure?: boolean;
    checkpoint?: boolean;
}): Promise<ReturnType<typeof makeReport<WorkflowData>>>;
/** Parse a simple step spec string: "id:name" */
declare function parseStepSpec(spec: string): WorkflowStep;

/**
 * dag.ts — DAG-based parallel workflow executor for AgentOps Forge
 *
 * Runs workflow steps in topological order, parallelising steps whose
 * dependencies are already satisfied.  Full provenance chain (SHA-256
 * receipt per step) is emitted in the report.
 */

interface DagStep {
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
interface DagInput {
    step: DagStep;
    /** Merged outputs from all dependency steps */
    upstream: Record<string, Record<string, unknown>>;
    staticInput: Record<string, unknown>;
}
interface DagStepResult {
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
interface DagWorkflowData {
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
declare function dagCmd(goal: string, steps: DagStep[], opts?: {
    stopOnFailure?: boolean;
}): Promise<ReturnType<typeof makeReport<DagWorkflowData>>>;
/** Parse extended step spec: "id:name[dep1,dep2]" */
declare function parseDagStepSpec(spec: string): DagStep;

/**
 * checkpoint-store.ts — Persistent workflow checkpoint storage for AgentOps Forge
 *
 * When a workflow step completes, its result is checkpointed to disk.
 * If the workflow fails, `replayCmd` can load the checkpoint and resume
 * from the last successful step instead of starting from scratch.
 *
 * Storage: ~/.forge/checkpoints/<workflowId>.json (one file per workflow run)
 */
interface CheckpointStep {
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
interface WorkflowCheckpoint {
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
interface CheckpointSummary {
    workflowId: string;
    goal: string;
    savedAt: string;
    completedCount: number;
    pendingCount: number;
    failedStepId: string | null;
}
/** List all saved checkpoints (unfinished workflows). */
declare function listCheckpoints(): CheckpointSummary[];

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

interface ReplayOptions {
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
declare function replayCmd(workflowId: string, steps: WorkflowStep[], opts?: ReplayOptions): Promise<ReturnType<typeof makeReport<WorkflowData>>>;
/**
 * List all saved checkpoints (workflows that failed and can be replayed).
 * Returns a formatted summary string suitable for CLI display.
 */
declare function listCheckpointsSummary(): string;

export { type DagInput, type DagStep, type DagStepResult, type DagWorkflowData, type GuardKind, type ReceiptListData, type ReceiptVerifyData, type ReplayOptions, type StepResult, type WorkflowCheckpoint, type WorkflowData, type WorkflowStep, dagCmd, discoverCmd, guardCmd, handoffCmd, listCheckpoints, listCheckpointsSummary, outreachCmd, parseDagStepSpec, parseStepSpec, receiptCmd, receiptListCmd, receiptVerifyCmd, replayCmd, socialCmd, workflowCmd };

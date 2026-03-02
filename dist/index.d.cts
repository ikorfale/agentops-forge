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

declare function guardCmd(kind: string): Promise<ForgeReport<{
    checks: {
        name: string;
        passed: boolean;
    }[];
}>>;

declare function receiptCmd(intent: string, outcome: string): Promise<ForgeReport<{
    intent: string;
    outcome: string;
    receiptHash: string;
}>>;

declare function handoffCmd(task: string, goal: string): Promise<ForgeReport<{
    score: number;
    packet: {
        task: string;
        goal: string;
        definition_of_done: string;
        provenance: string;
    };
}>>;

export { discoverCmd, guardCmd, handoffCmd, outreachCmd, receiptCmd, socialCmd };

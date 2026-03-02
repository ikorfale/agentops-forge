# AgentOps Forge — API/CLI Specification (TypeScript)

**Status:** Draft v0.1  
**Project:** `agentops-forge`  
**Runtime:** Node.js 20+ / TypeScript 5+  
**Module Type:** ESM-first (CJS build optional)

---

## 1) Scope

This spec defines:

1. CLI command surface for:
   - `discover`
   - `outreach`
   - `social`
   - `guard`
   - `receipt`
   - `handoff`
2. Shared config schema (file + env + flags layering)
3. Machine-readable JSON report formats for every command
4. Programmatic TypeScript API contracts aligned with CLI behavior

Goal: deterministic, automatable agent-ops workflows with verifiable provenance.

---

## 2) Package Layout (recommended)

```text
agentops-forge/
  src/
    cli.ts
    commands/
      discover.ts
      outreach.ts
      social.ts
      guard.ts
      receipt.ts
      handoff.ts
    core/
      config.ts
      logger.ts
      provenance.ts
      reports.ts
      errors.ts
    schemas/
      config.schema.json
      report.base.schema.json
      report.discover.schema.json
      report.outreach.schema.json
      report.social.schema.json
      report.guard.schema.json
      report.receipt.schema.json
      report.handoff.schema.json
  docs/
    cli-spec-subagent.md
```

---

## 3) CLI Overview

Binary name (recommended): `forge`

```bash
forge <command> [options]
```

### 3.1 Global Options

- `-c, --config <path>`: Path to YAML/JSON config file
- `--profile <name>`: Named profile in config
- `--env <name>`: Runtime environment (`dev|staging|prod`)
- `--format <json|pretty|ndjson>`: Output format (default: `pretty`)
- `--output <path>`: Write final report JSON to file
- `--traceparent <value>`: W3C traceparent override
- `--request-id <id>`: Idempotency/request correlation id
- `--dry-run`: Validate and plan without side effects
- `--strict`: Fail on warnings/policy soft violations
- `-v, --verbose`: Increase log verbosity
- `-h, --help`
- `--version`

### 3.2 Exit Codes

- `0` success
- `1` generic failure
- `2` validation/config error
- `3` auth/permission failure
- `4` network/provider failure
- `5` policy/guardrail block
- `6` partial success (some targets failed)

---

## 4) Config Specification

Precedence (highest first):
1. CLI flags
2. Environment variables
3. Config file
4. Defaults

### 4.1 Config File

Supported formats: `.yaml`, `.yml`, `.json`.

Default path lookup:
1. `--config`
2. `./agentops.forge.yaml`
3. `./agentops.forge.json`
4. `~/.config/agentops-forge/config.yaml`

### 4.2 TypeScript Config Types

```ts
export type ForgeEnvironment = "dev" | "staging" | "prod";

export interface ForgeConfig {
  version: "1";
  profile?: string;
  env?: ForgeEnvironment;
  workspace?: string;

  telemetry?: {
    enabled?: boolean;
    serviceName?: string;
    otlpEndpoint?: string;
    sampleRate?: number; // 0..1
    includePayloads?: boolean;
  };

  provenance?: {
    enabled?: boolean;
    actorId?: string;
    agentId?: string;
    delegationChain?: string[];
    hashAlgorithm?: "sha256" | "sha512";
    signReports?: boolean;
    signingKeyPath?: string;
  };

  providers?: {
    github?: {
      tokenEnv?: string; // default GITHUB_TOKEN
      apiBaseUrl?: string;
    };
    x?: {
      bearerTokenEnv?: string;
      apiBaseUrl?: string;
    };
    email?: {
      provider?: "agentmail" | "smtp";
      apiKeyEnv?: string;
      from?: string;
    };
    webhook?: {
      endpoint?: string;
      authHeaderEnv?: string;
    };
  };

  defaults?: {
    timeoutMs?: number;
    concurrency?: number;
    retries?: number;
    retryBackoffMs?: number;
    rateLimitPerMin?: number;
  };

  policy?: {
    allowExternalSend?: boolean;
    blockedDomains?: string[];
    blockedHandles?: string[];
    requireHumanApproval?: boolean;
    piiMode?: "allow" | "mask" | "deny";
    maxRecipientsPerRun?: number;
  };

  commands?: {
    discover?: DiscoverConfig;
    outreach?: OutreachConfig;
    social?: SocialConfig;
    guard?: GuardConfig;
    receipt?: ReceiptConfig;
    handoff?: HandoffConfig;
  };
}

export interface DiscoverConfig {
  sources?: Array<"github" | "web" | "social" | "registry">;
  queries?: string[];
  limit?: number;
  minScore?: number; // 0..1
}

export interface OutreachConfig {
  channel?: "email" | "dm" | "comment";
  templatePath?: string;
  maxSends?: number;
  requireApproval?: boolean;
}

export interface SocialConfig {
  platform?: "x" | "bluesky" | "linkedin";
  mode?: "draft" | "publish";
  thread?: boolean;
}

export interface GuardConfig {
  checks?: Array<"policy" | "auth" | "rate" | "duplication" | "content">;
  failOn?: Array<"warning" | "error">;
}

export interface ReceiptConfig {
  includeEvidence?: boolean;
  includePayloadHashes?: boolean;
  outputDir?: string;
}

export interface HandoffConfig {
  target?: "human" | "agent" | "queue";
  assignee?: string;
  urgency?: "low" | "normal" | "high" | "critical";
}
```

### 4.3 Environment Variable Mapping (minimum)

- `FORGE_CONFIG`
- `FORGE_PROFILE`
- `FORGE_ENV`
- `FORGE_FORMAT`
- `FORGE_OUTPUT`
- `FORGE_TRACEPARENT`
- `FORGE_REQUEST_ID`
- `FORGE_DRY_RUN`
- `FORGE_STRICT`
- `FORGE_TIMEOUT_MS`
- `FORGE_CONCURRENCY`

Provider tokens are read from configured `*Env` names.

---

## 5) Shared Report Envelope (JSON)

Every command returns a report envelope:

```ts
export interface ForgeReportBase<TData = unknown> {
  schemaVersion: "1.0";
  command: "discover" | "outreach" | "social" | "guard" | "receipt" | "handoff";
  status: "ok" | "partial" | "failed" | "blocked";
  startedAt: string; // ISO-8601
  finishedAt: string; // ISO-8601
  durationMs: number;

  request: {
    requestId?: string;
    traceparent?: string;
    profile?: string;
    env?: ForgeEnvironment;
    dryRun?: boolean;
  };

  metrics?: {
    attempted?: number;
    succeeded?: number;
    failed?: number;
    skipped?: number;
    blocked?: number;
    retries?: number;
  };

  warnings?: Array<{
    code: string;
    message: string;
    target?: string;
  }>;

  errors?: Array<{
    code: string;
    message: string;
    target?: string;
    retryable?: boolean;
    cause?: string;
  }>;

  provenance?: {
    actorId?: string;
    agentId?: string;
    inputHash?: string;
    outputHash?: string;
    delegationChain?: string[];
    signature?: string;
    evidence?: Array<{
      type: "url" | "file" | "log" | "screenshot" | "api-response";
      ref: string;
      hash?: string;
    }>;
  };

  data: TData;
}
```

---

## 6) Command Specs

## 6.1 `discover`

Find targets/opportunities from configured sources.

### CLI

```bash
forge discover [options]
```

Options:
- `--source <github|web|social|registry>` (repeatable)
- `--query <text>` (repeatable)
- `--limit <n>`
- `--min-score <0..1>`
- `--since <ISO date>`
- `--tag <name>` (repeatable)

### Data Payload

```ts
export interface DiscoverItem {
  id: string;
  source: "github" | "web" | "social" | "registry";
  title: string;
  url?: string;
  summary?: string;
  tags?: string[];
  score: number; // 0..1
  discoveredAt: string;
  metadata?: Record<string, unknown>;
}

export interface DiscoverReportData {
  querySet: string[];
  filters?: {
    sources?: string[];
    minScore?: number;
    since?: string;
    tags?: string[];
  };
  items: DiscoverItem[];
}
```

---

## 6.2 `outreach`

Send or stage outreach messages to selected targets.

### CLI

```bash
forge outreach [options]
```

Options:
- `--input <path>`: JSON/CSV targets file
- `--channel <email|dm|comment>`
- `--template <path>`
- `--subject <text>`
- `--max <n>`
- `--approval <required|optional|off>`
- `--send` (default is draft unless explicit send)
- `--idempotency-key <key>`

### Data Payload

```ts
export interface OutreachTarget {
  id: string;
  channel: "email" | "dm" | "comment";
  address: string;
  name?: string;
  context?: Record<string, unknown>;
}

export interface OutreachResult {
  targetId: string;
  status: "drafted" | "sent" | "skipped" | "failed" | "blocked";
  providerMessageId?: string;
  reason?: string;
}

export interface OutreachReportData {
  mode: "draft" | "send";
  templateRef?: string;
  idempotencyKey?: string;
  results: OutreachResult[];
}
```

---

## 6.3 `social`

Create, schedule, or publish social content.

### CLI

```bash
forge social [options]
```

Options:
- `--platform <x|bluesky|linkedin>`
- `--input <path>`: markdown/json content spec
- `--mode <draft|schedule|publish>`
- `--schedule-at <ISO date-time>`
- `--thread`
- `--media <pathOrUrl>` (repeatable)

### Data Payload

```ts
export interface SocialPostResult {
  platform: "x" | "bluesky" | "linkedin";
  status: "drafted" | "scheduled" | "published" | "failed" | "blocked";
  postId?: string;
  url?: string;
  scheduledAt?: string;
  reason?: string;
}

export interface SocialReportData {
  mode: "draft" | "schedule" | "publish";
  items: SocialPostResult[];
}
```

---

## 6.4 `guard`

Run policy/compliance/quality checks on planned or completed actions.

### CLI

```bash
forge guard [options]
```

Options:
- `--input <path>`: report or plan file
- `--check <policy|auth|rate|duplication|content>` (repeatable)
- `--policy-file <path>`
- `--fail-on <warning|error>`
- `--emit-patch <path>`: optional remediation suggestions

### Data Payload

```ts
export interface GuardFinding {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  target?: string;
  remediation?: string;
}

export interface GuardReportData {
  checksRun: string[];
  findings: GuardFinding[];
  pass: boolean;
}
```

---

## 6.5 `receipt`

Generate immutable-style operation receipt(s) from a prior report or run-id.

### CLI

```bash
forge receipt [options]
```

Options:
- `--input <path>`: prior report JSON
- `--run-id <id>`
- `--include-evidence`
- `--sign`
- `--out-dir <path>`

### Data Payload

```ts
export interface ReceiptArtifact {
  receiptId: string;
  runId?: string;
  command: string;
  createdAt: string;
  hash: string;
  signature?: string;
  path?: string;
}

export interface ReceiptReportData {
  sourceRef: string;
  artifacts: ReceiptArtifact[];
}
```

---

## 6.6 `handoff`

Create structured handoff package for a human or another agent/queue.

### CLI

```bash
forge handoff [options]
```

Options:
- `--input <path>`: source report(s)
- `--target <human|agent|queue>`
- `--assignee <id>`
- `--urgency <low|normal|high|critical>`
- `--summary <text>`
- `--attach <path>` (repeatable)
- `--notify <webhook|email|none>`

### Data Payload

```ts
export interface HandoffPackage {
  handoffId: string;
  target: "human" | "agent" | "queue";
  assignee?: string;
  urgency: "low" | "normal" | "high" | "critical";
  summary: string;
  linkedReports: string[];
  attachments?: string[];
  nextActions?: string[];
  dueAt?: string;
}

export interface HandoffReportData {
  package: HandoffPackage;
  delivery: {
    status: "queued" | "sent" | "failed";
    channel?: string;
    reference?: string;
  };
}
```

---

## 7) JSON Schema Requirements

Provide JSON Schemas in `src/schemas/`:

- `config.schema.json`
- `report.base.schema.json`
- `report.<command>.schema.json`

Minimum constraints:
- `schemaVersion` must be const `1.0`
- `startedAt`, `finishedAt` must be `format: date-time`
- `durationMs >= 0`
- command-specific `data` required
- `status` enum: `ok|partial|failed|blocked`

Validation library recommendation: `zod` for runtime + `zod-to-json-schema` export.

---

## 8) Programmatic API (TypeScript)

```ts
export interface ForgeRunOptions {
  config?: Partial<ForgeConfig>;
  profile?: string;
  env?: ForgeEnvironment;
  traceparent?: string;
  requestId?: string;
  dryRun?: boolean;
  strict?: boolean;
}

export interface DiscoverInput {
  sources?: Array<"github" | "web" | "social" | "registry">;
  queries: string[];
  limit?: number;
  minScore?: number;
  since?: string;
  tags?: string[];
}

export interface OutreachInput {
  targets: OutreachTarget[];
  mode: "draft" | "send";
  template?: string;
  subject?: string;
  idempotencyKey?: string;
}

export interface SocialInput {
  platform: "x" | "bluesky" | "linkedin";
  mode: "draft" | "schedule" | "publish";
  text: string;
  scheduleAt?: string;
  media?: string[];
  thread?: boolean;
}

export interface GuardInput {
  report: ForgeReportBase;
  checks?: Array<"policy" | "auth" | "rate" | "duplication" | "content">;
}

export interface ReceiptInput {
  report: ForgeReportBase;
  includeEvidence?: boolean;
  sign?: boolean;
}

export interface HandoffInput {
  reports: ForgeReportBase[];
  target: "human" | "agent" | "queue";
  assignee?: string;
  urgency?: "low" | "normal" | "high" | "critical";
  summary: string;
  attachments?: string[];
}

export interface ForgeApi {
  discover(input: DiscoverInput, opts?: ForgeRunOptions): Promise<ForgeReportBase<DiscoverReportData>>;
  outreach(input: OutreachInput, opts?: ForgeRunOptions): Promise<ForgeReportBase<OutreachReportData>>;
  social(input: SocialInput, opts?: ForgeRunOptions): Promise<ForgeReportBase<SocialReportData>>;
  guard(input: GuardInput, opts?: ForgeRunOptions): Promise<ForgeReportBase<GuardReportData>>;
  receipt(input: ReceiptInput, opts?: ForgeRunOptions): Promise<ForgeReportBase<ReceiptReportData>>;
  handoff(input: HandoffInput, opts?: ForgeRunOptions): Promise<ForgeReportBase<HandoffReportData>>;
}
```

---

## 9) Determinism, Idempotency, and Provenance

- `requestId` SHOULD be stable per external trigger.
- `outreach --idempotency-key` MUST prevent duplicate sends.
- Report MUST include `inputHash` and `outputHash` when provenance enabled.
- `traceparent` SHOULD be accepted via flag/env and propagated to providers.
- Any blocked action by guard policy MUST set `status="blocked"` and exit code `5`.

---

## 10) Minimal JSON Examples

### discover

```json
{
  "schemaVersion": "1.0",
  "command": "discover",
  "status": "ok",
  "startedAt": "2026-03-02T03:00:00.000Z",
  "finishedAt": "2026-03-02T03:00:01.200Z",
  "durationMs": 1200,
  "request": { "requestId": "req_123", "env": "prod" },
  "metrics": { "attempted": 20, "succeeded": 20 },
  "data": {
    "querySet": ["agent observability"],
    "items": [
      {
        "id": "gh_1",
        "source": "github",
        "title": "awesome-agentops",
        "url": "https://github.com/example/awesome-agentops",
        "score": 0.91,
        "discoveredAt": "2026-03-02T03:00:01.000Z"
      }
    ]
  }
}
```

### guard (blocked)

```json
{
  "schemaVersion": "1.0",
  "command": "guard",
  "status": "blocked",
  "startedAt": "2026-03-02T03:10:00.000Z",
  "finishedAt": "2026-03-02T03:10:00.120Z",
  "durationMs": 120,
  "errors": [
    {
      "code": "POLICY_EXTERNAL_SEND_DISABLED",
      "message": "External send blocked by policy",
      "retryable": false
    }
  ],
  "data": {
    "checksRun": ["policy"],
    "findings": [
      {
        "severity": "error",
        "code": "POLICY_EXTERNAL_SEND_DISABLED",
        "message": "Outbound send is disabled"
      }
    ],
    "pass": false
  }
}
```

---

## 11) Recommended Dependencies

- CLI: `commander` or `yargs`
- Config: `cosmiconfig` + `yaml`
- Validation: `zod`
- JSON schema export: `zod-to-json-schema`
- Logging: `pino`
- HTTP: `undici`
- Hash/sign: Node `crypto` (+ optional `jose`)

---

## 12) Non-Goals (for v0.1)

- UI/dashboard spec
- Persistent DB schema
- Multi-tenant auth server design
- Full provider-specific payload mappings

---

## 13) Implementation Checklist

- [ ] Implement config loader with precedence rules
- [ ] Add zod schemas for config + all reports
- [ ] Implement six command handlers
- [ ] Enforce exit code mapping
- [ ] Add `--format json|pretty|ndjson`
- [ ] Add provenance hashing/signing utilities
- [ ] Add fixtures for each command report in `test/fixtures/reports/`
- [ ] Add contract tests validating JSON schema compatibility

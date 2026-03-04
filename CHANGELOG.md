# Changelog

All notable changes to AgentOps Forge are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.5.0] — 2026-03-05

### Added
- **`health` command** — live liveness + latency check for all key Gerundium services
  - Targets: `all`, `a2a`, `agentmail`, `clawk`, `network`
  - Parallel probes with 6s timeout per service
  - Returns structured `ServiceCheck[]` with `status`, `httpCode`, `latencyMs`
  - Overall status: `ok` / `partial` / `fail` based on `down` count
  - 7 new unit tests (mocked fetch) covering ok/fail/partial/unknown/degraded/single-target scenarios
- **`replay` CLI commands** — expose the existing (but unregistered) `replay.ts` via CLI
  - `replay run <workflowId> [--steps ...]` — resume failed workflow from checkpoint
  - `replay list` — show all saved checkpoints (workflowId, goal, savedAt, completed, pending, failed)
- **Test isolation fix** — added `afterEach(cleanup)` to `receiptListCmd` describe block; eliminates receipt store state leakage between test suites

### Stats
- 51/51 tests passing (was 50/51 before this cycle)
- 3 new CLI subcommands exposed

---

## [0.4.0] — 2026-03-03

### Added
- **`workflow` command** — typed multi-step agent workflow orchestrator
  - Sequential step execution with configurable `stopOnFailure`
  - Per-step SHA-256 receipt (hash of stepId + name + input + output)
  - Provenance chain: ordered list of `stepId:receiptHash[:12]` for traceability
  - Retry logic per step (`--retries N`) with configurable max attempts
  - Rollback acknowledgement: when a step fails, all completed steps are marked for reversal
  - Exported `parseStepSpec(spec)` for CLI step parsing
- **11 new tests** covering guard (4) and workflow (7) commands — all green

### Improved
- **`guard` command** — now runs real pre-flight checks instead of always returning `passed: true`
  - `guard --kind env` — checks `HOME`, `PATH`, `NODE_ENV` (required) + optional API keys
  - `guard --kind files` — verifies `SOUL.md`, `MEMORY.md`, `TOOLS.md` presence in workspace
  - `guard --kind network` — live DNS resolution of `api.anthropic.com` with 3s timeout
  - `guard --kind schema` — schema validation stub (signals intent, extensible)
  - Generic fallback for unknown kinds: single pass check
  - Emits `errors[]` for every failed check; status is `ok|partial|fail`

## [0.5.0] — 2026-03-04

### Added
- **Receipt persistence & verification** — closes the provenance loop
  - New `receipt-store.ts` core module: JSONL log at `~/.forge/receipts.jsonl`
  - `receipt create --intent --outcome` — creates receipt AND persists it
  - `receipt verify <hash>` — looks up any hash from the store; returns full payload or `found: false` + `fail` status
  - `receipt list [-n N]` — returns N most-recent receipts (newest first)
  - Workflow step receipts (`workflow`, `dag`) now also auto-persist to store
- **12 new tests** for receipt-store + create/verify/list — all green (38 total ✅)

### Improved
- CLI `receipt` restructured as subcommand group (`create` / `verify` / `list`); legacy hidden `receipt-create` alias preserved for backward compatibility

## [Unreleased]

### Planned
- A2A / MCP bridge for interoperability with external agent networks
- KPI tracker integration (activation rate, failure rate, receipt coverage)
- Runtime guardrail hooks with configurable deny-lists
- Agent-to-agent handoff with typed contract enforcement

---

## [0.3.0] — 2026-03-02

### Added
- **HTTP service** (`src/server.ts`) — REST API exposing all Forge commands over HTTP
- **Railway deployment config** (`railway.json`) — one-click cloud deployment
- Health endpoint `GET /health` returning build metadata

### Changed
- CLI entrypoint hardened with typed arg parsing
- All commands now return structured JSON for machine consumption

---

## [0.2.0] — 2026-03-02

### Added
- `discover` command — query-driven agent/target discovery
- `outreach` command — structured outreach with message templates
- `social` command — topic-driven social content generation
- `guard` command — guardrail checks (PII, secrets, content policy)
- `receipt` command — provenance receipts for agent actions (intent + outcome + hash)
- `handoff` command — typed task handoff between agents with goal tracking
- TypeScript source (`src/`) with full type definitions in `src/types/`
- Provider abstraction layer (`src/providers/`) for swappable backends
- Architecture docs (`docs/architecture-subagent.md`)
- CLI spec (`docs/cli-spec-subagent.md`)
- Adoption loop design (`docs/adoption-loop-subagent.md`)

---

## [0.1.0] — 2026-03-02

### Added
- Initial TypeScript project scaffold (`package.json`, `tsconfig.json`)
- Vitest test harness
- Professional `.gitignore` (no vendored deps)
- MIT license

---

## KPIs tracked per release

| Metric | Target | Status |
|---|---|---|
| Commands with typed contracts | 6/6 | ✅ 0.3.0 |
| HTTP service deployed | yes | ✅ 0.3.0 |
| Receipt coverage | 100% | ⏳ in progress |
| A2A interoperability | 1 bridge | ⏳ planned |
| Real external users | ≥1 | ⏳ planned |

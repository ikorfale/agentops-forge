# AgentOps Forge — TypeScript Toolkit Architecture (Subagent Draft)

## 1) Goal
Transform a large collection of standalone automation scripts into a production-grade TypeScript toolkit with:
- consistent runtime contracts,
- composable modules,
- clear CLI/app boundaries,
- auditable execution and provenance,
- easy extension via plugins.

---

## 2) Architectural Style
**Hexagonal + Event-Driven + Plugin-first monorepo**

- **Hexagonal (Ports/Adapters):** business logic isolated from APIs, CLIs, queues, and external services.
- **Event-driven core:** scripts become domain commands and events (`task.started`, `outreach.sent`, `memory.updated`).
- **Plugin-first:** each old script family maps to a plugin package with command handlers.
- **Monorepo (pnpm/turbo):** shared types + utilities, independent deployable apps.

---

## 3) Target Monorepo Layout

```text
agentops-forge/
  apps/
    cli/                     # forge CLI (commander or oclif)
    worker/                  # async jobs + retries + schedules
    api/                     # optional REST control plane
  packages/
    core/                    # domain entities, use-cases, orchestrator
    contracts/               # zod schemas, shared DTOs, event envelopes
    config/                  # env loading, feature flags, policy
    observability/           # logs/metrics/tracing (OpenTelemetry)
    provenance/              # traceparent + signed action receipts
    memory/                  # memory store adapters + retrieval API
    social/                  # posting, engagement, response tracking
    outreach/                # discovery, ranking, campaigns, replies
    identity/                # DID/VC/agent card, validation
    trust/                   # trust scores, decay, policy checks
    autonomy/                # planner, evaluator, quality gates
    adapters-http/           # REST clients (Clawk/Moltbook/etc)
    adapters-db/             # sqlite/postgres/redis implementations
    adapters-mq/             # queue/event bus implementations
    plugin-sdk/              # plugin interface + lifecycle hooks
  plugins/
    plugin-agentmail/
    plugin-clawfriend/
    plugin-moltbook/
    plugin-x/
    plugin-face-display/
  docs/
  tests/
```

---

## 4) Module Map (from script clusters)

| Current script cluster | New package/module | Notes |
|---|---|---|
| `agentmail_*`, `reply_*`, `send_*` | `packages/outreach`, `plugins/plugin-agentmail` | Inbox, thread sync, smart replies, campaign execution |
| `clawfriend_*`, `social_*`, `x_engage`, `moltbook_*` | `packages/social` + platform plugins | Unified social contract, per-platform adapters |
| `memory_*`, `reflection_*`, `daily_reflection` | `packages/memory`, `packages/autonomy` | Memory append/retrieve/consolidate + learning loop |
| `provenance_*`, `trace_viewer`, `email_provenance` | `packages/provenance`, `packages/observability` | end-to-end provenance receipts + distributed tracing |
| `agent_identity*`, `agent_card_tool`, `identity_drift_guard` | `packages/identity` | DID/VC, identity continuity, drift alerts |
| `trust_*`, `attestation_decay`, `performative_trust` | `packages/trust` | trust scoring, decay curves, policy gates |
| `autonomy_*`, `quality_checker`, `orchestration_quality_gate` | `packages/autonomy`, `packages/core` | planner/evaluator/executor loop |
| `resilient_request`, `api_health_retry`, `context_*` | `packages/core`, `packages/contracts` | retries, envelopes, context budget, guardrails |
| `face_*`, `smart_face` | `plugins/plugin-face-display` | optional UX/telemetry output adapter |
| `agent_network_bridge`, `ble_mesh_agent` | `packages/adapters-mq`, future `packages/mesh` | communication fabric and protocol bridge |

---

## 5) Runtime Contracts

### Command Envelope
```ts
{
  id: string;
  type: string;                 // e.g. outreach.send
  actor: { agentId: string };
  input: unknown;
  context: {
    traceparent?: string;
    sessionId?: string;
    source?: "cli" | "api" | "cron" | "event";
  };
}
```

### Event Envelope
```ts
{
  id: string;
  type: string;                 // e.g. outreach.sent
  at: string;                   // ISO timestamp
  causationId?: string;
  correlationId?: string;
  payload: unknown;
  provenance?: {
    traceId?: string;
    spanId?: string;
    receiptHash?: string;
  };
}
```

Validation with **zod**, versioned schemas in `packages/contracts`.

---

## 6) MVP Command Set (CLI)

**Binary:** `forge`

1. `forge doctor`
   - checks env vars, API credentials, DB connectivity, queue health.

2. `forge ingest scripts --path ./scripts`
   - indexes existing scripts, tags by domain, suggests migration targets.

3. `forge run <command>`
   - executes a registered command with full trace/provenance.

4. `forge outreach discover --source <platform>`
   - finds leads/accounts using configured adapters.

5. `forge outreach send --campaign <id> [--dry-run]`
   - sends outreach with policy checks + receipts.

6. `forge social engage --platform <x|moltbook|clawfriend>`
   - pulls mentions/replies and proposes or executes responses.

7. `forge memory append --kind <event|lesson|contact>`
   - structured memory write.

8. `forge memory consolidate`
   - summarizes and deduplicates memory into long-term records.

9. `forge trust score --entity <id>`
   - computes trust score with factors + decay.

10. `forge trace show --id <traceId>`
   - displays execution timeline + provenance chain.

11. `forge plugin list|add|remove`
   - manages integration modules.

12. `forge plan next`
   - runs autonomy planner and emits top next actions.

---

## 7) Migration Plan (scripts → toolkit)

- **Phase 0: Inventory** — classify all scripts by domain, side effects, dependencies.
- **Phase 1: Wrap** — expose script behavior as command handlers without changing logic.
- **Phase 2: Normalize** — enforce shared contracts/events/logging.
- **Phase 3: Replace** — reimplement high-value paths natively in TypeScript.
- **Phase 4: Harden** — testing matrix, canary runs, rollback support.

Priority first: `outreach`, `social`, `memory`, `provenance`.

---

## 8) Non-Functional Requirements

- **Reliability:** idempotent handlers, retries with jitter, dead-letter queue.
- **Security:** secret manager integration, least-privilege adapters, signed receipts.
- **Observability:** OpenTelemetry traces, structured logs, command/event metrics.
- **Auditability:** every external action emits provenance receipt.
- **Developer Experience:** typed SDK, codegen for commands/events, local sandbox mode.

---

## 9) Recommended Stack

- TypeScript + Node 20+
- pnpm + Turborepo
- zod (contracts)
- pino (logging)
- OpenTelemetry SDK
- BullMQ or Temporal (jobs/workflows)
- Prisma + Postgres (state)
- Vitest + Playwright (tests)

---

## 10) Success Criteria for MVP

- 80% of routine automation executed through `forge` CLI instead of raw scripts.
- All outbound actions produce trace + provenance receipt.
- Median command onboarding time for new plugin < 2 hours.
- Social/outreach loops measurable end-to-end (discover → engage → reply → memory update).

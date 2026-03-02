# Changelog

All notable changes to AgentOps Forge are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Planned
- A2A / MCP bridge for interoperability with external agent networks
- KPI tracker integration (activation rate, failure rate, receipt coverage)
- Runtime guardrail hooks with configurable deny-lists
- Receipt verification CLI (`receipt verify <hash>`)
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

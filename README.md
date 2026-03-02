# AgentOps Forge

Professional TypeScript toolkit for autonomous multi-agent operations.

## Why
Most agent stacks degrade into isolated scripts. AgentOps Forge provides one typed CLI/API surface for discovery, outreach, social operations, guardrails, receipts, and handoffs.

## Install
```bash
npm i
npm run build
node dist/cli.js --help
```

## Commands
- `discover --query`
- `outreach --targets`
- `social --topic`
- `guard --kind`
- `receipt --intent --outcome`
- `handoff --task --goal`

## Docs
- `docs/architecture-subagent.md`
- `docs/cli-spec-subagent.md`
- `docs/adoption-loop-subagent.md`

## License
MIT

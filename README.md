# origin-v2

Minimal repo for implementing Origin with Super Ralph.

## What is in this repo

- `docs/design.spec.md` - product scope (features and views)
- `docs/engineering.choices.md` - stack and delivery guardrails
- `docs/references.md` - reference repositories contract (`repository-links` strategy)
- `docs/super-ralph.prompt.md` - single prompt for autonomous implementation
- `AGENTS.md` - instructions for coding agents in this repo

## Contracts

- `docs/contracts/workflow-api-schema-contract.md` - canonical workflow API + persisted schema contract
- `docs/contracts/workflow-api-routes.md` - compatibility pointer to the canonical workflow contract
- `docs/contracts/persisted-schema.md` - compatibility pointer to the canonical workflow contract
- `docs/contracts/api-006-tdd-audit.md` - review-fix audit trail with explicit RED/GREEN TDD evidence for API-006
- `docs/contracts/core-rev-arch-001-tdd-audit.md` - review-fix TDD evidence for CORE-REV-ARCH-001 architecture hardening

## Run Super Ralph

```bash
bun install
bunx super-ralph ./docs/super-ralph.prompt.md
```

Super Ralph may generate runtime artifacts such as `PROGRESS.md`; they are gitignored.

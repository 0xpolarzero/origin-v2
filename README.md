# origin-v2

Restart workspace for Origin v2.

## What is set up

- Minimal product/design baseline in `docs/`
- Mandatory engineering and process guardrails in `docs/engineering.choices.md`
- Super Ralph autonomous workflow scaffolding in `automation/super-ralph/`
- Local reference repositories in `references/`

## Directory map

- `docs/`: product spec, engineering choices, reference policy, Super Ralph autonomy model
- `automation/super-ralph/`: autonomous implementation workflow (prompt-driven)
- `references/`: cloned external source repos for implementation research
- `apps/core/`: reserved for core domain runtime (to be implemented)
- `apps/desktop/`: reserved for Electron + React app shell (to be implemented)

## Prerequisites

- Bun >= 1.3
- Codex CLI installed and authenticated
- JJ installed (`jj --version`)
- Optional: PI CLI for `pi-mono` path

## First run

1. Install workflow dependencies:

```bash
cd automation/super-ralph
bun install
```

2. Execute workflow:

```bash
bun run run -- ./input/campaign-01-core-foundation.md
```

3. Monitor in terminal UI:

```bash
bun run automation:monitor
```

## Core working rule

Do not integrate UI for a feature slice until the corresponding core logic and tests are fully implemented and passing.

## Bootstrap references (idempotent)

```bash
bash scripts/bootstrap-references.sh
```

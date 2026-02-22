# origin-v2

Restart workspace for Origin v2.

## What is set up

- Minimal product/design baseline in `docs/`
- Mandatory engineering and process guardrails in `docs/engineering.choices.md`
- Smithers autonomous workflow scaffolding in `automation/smithers/`
- Local reference repositories in `references/`

## Directory map

- `docs/`: product spec, engineering choices, reference policy, Smithers autonomy model
- `automation/smithers/`: autonomous implementation workflow (Codex-first, Pi optional)
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
cd automation/smithers
bun install
```

2. Execute workflow:

```bash
bun run run
```

3. Resume a run:

```bash
bun run resume -- <run-id>
```

## Core working rule

Do not integrate UI for a feature slice until the corresponding core logic and tests are fully implemented and passing.

## Bootstrap references (idempotent)

```bash
bash scripts/bootstrap-references.sh
```

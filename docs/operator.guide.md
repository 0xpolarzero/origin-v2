# Origin v2 Operator Guide

## 1. Day-to-day loop

1. Keep docs current in `docs/`.
2. Run Super Ralph campaign prompts.
3. Review outcomes and validation results.
4. Move to next campaign only when current campaign goals are satisfied.

## 2. Campaign order

1. `automation/super-ralph/input/campaign-01-core-foundation.md`
2. `automation/super-ralph/input/campaign-02-ui-integration.md`
3. `automation/super-ralph/input/campaign-03-hardening-and-fixes.md`
4. `automation/super-ralph/input/campaign-04-readiness.md`

## 3. Commands

Install dependencies:

```bash
cd automation/super-ralph
bun install
```

Run campaign:

```bash
cd automation/super-ralph
bun run run -- ./input/campaign-01-core-foundation.md
```

Typecheck automation runner:

```bash
cd automation/super-ralph
bun run typecheck
```

Run from repo root:

```bash
bun run automation:run -- ./input/campaign-01-core-foundation.md
```

Resume:

```bash
bun run automation:resume -- <run-id>
```

Monitor:

```bash
bun run automation:monitor
```

## 4. Core-first gate

- Campaign 01 is core-only.
- Do not integrate UI until targeted core features are complete and passing tests.

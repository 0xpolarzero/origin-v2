# Origin v2 Operator Guide

## 1. Day-to-day workflow

1. Keep docs current in `docs/`.
2. Run Smithers to execute autonomous feature slices.
3. Review generated reports and test outcomes.
4. Only after core completion + tests, integrate UI.

## 2. Smithers execution loop

- Entry point: `automation/smithers/workflow.tsx`
- Pipeline: Discover -> Plan -> CoreImplement -> CoreValidate -> Review -> ReviewFix -> Report
- Looping: Implement/Validate/Review/Fix repeats via Ralph until approval or max rounds.
- Skill policy: Plan/Implement/Report explicitly track relevant installed skill usage.
- Validation policy: required validation commands (including typecheck and relevant tests) must pass before approval.
- Chunking policy: work is delivered in logical chunks with JJ checkpoints per chunk.

## 3. Input contract

Input JSON is passed to the workflow runner:

```json
{
  "goal": "Implement the next core feature slice from docs",
  "scopeHint": "optional extra constraints",
  "allowUi": false
}
```

`allowUi` should stay `false` until all targeted core behavior is complete and passing tests.

## 4. Commands

Run with default input:

```bash
cd automation/smithers
bun run run
```

Run with a custom input file:

```bash
cd automation/smithers
bun run run -- ./input/my-input.json
```

Resume a run:

```bash
cd automation/smithers
bun run resume -- <run-id>
```

Typecheck workflow code:

```bash
cd automation/smithers
bun run typecheck
```

## 5. Campaign Inputs

Run these campaign inputs in sequence:

1. `automation/smithers/input/campaign-01-core-foundation.json`
2. `automation/smithers/input/campaign-02-ui-integration.json`
3. `automation/smithers/input/campaign-03-hardening-and-fixes.json`
4. `automation/smithers/input/campaign-04-readiness.json`

Example:

```bash
cd automation/smithers
bun run run -- ./input/campaign-01-core-foundation.json
```

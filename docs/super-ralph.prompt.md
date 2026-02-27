# Origin Autonomous Build Prompt

You are implementing Origin from scratch.

Use these files as authoritative:
- `docs/design.spec.md`
- `docs/engineering.choices.md`
- `docs/references.md`
- `AGENTS.md`

## Objective
Deliver a complete, usable Origin app aligned with the design spec and engineering guardrails.

## Non-negotiable constraints
- Core-first only: core/domain logic and tests must be complete before UI integration for each feature slice.
- Use latest stable versions at implementation time, pin exact resolved versions.
- Prefer Effect-based composition wherever practical.
- Use pi-mono for AI integrations.
- Use jj checkpoints and commit every atomic piece of work.
- No outbound actions without explicit user approval flows.

## Delivery behavior
- Work in small, independent slices.
- For each slice:
  1. plan,
  2. implement,
  3. run typecheck + relevant tests,
  4. review and fix,
  5. checkpoint + commit.
- Keep progressing autonomously unless requirements are ambiguous enough to risk incorrect behavior.

## References policy
- Treat repositories listed in `docs/references.md` as required reference inputs.
- Follow the `repository-links` strategy documented there; local submodule checkouts under `docs/references/*` are optional.
- Research relevant patterns before major implementation decisions.

## Acceptance bar
- All required features/views/workflows from `docs/design.spec.md` exist and are usable.
- Core behaviors are well tested.
- Typecheck and tests pass.
- Safety and auditability requirements are implemented.

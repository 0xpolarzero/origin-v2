# Origin v2 Agent Guide

## Mission
Build Origin v2 as a local-first, single-user command center that turns raw input into structured work and a reliable 3-21 day plan.

## Source of Truth (in order)
1. `docs/design.spec.md`
2. `docs/engineering.choices.md`
3. `docs/super-ralph.autonomy.md`
4. `docs/operator.guide.md`
5. This file

## Project Skills
Installed Codex skills to use in this project:

- `effect-best-practices`: Enforce Effect service/layer/error/atom patterns.
- `effect-testing`: Effect-focused testing strategies and patterns.
- `effect-ts`: Effect architecture, composition, and refactor guidance.
- `prd-authoring`: PRD writing/review quality for product docs.
- `react-best-practices`: React/Next performance and architecture patterns.
- `sdk-documentation`: SDK/public-doc writing and structure standards.
- `smithers`: Smithers workflow/pipeline design and troubleshooting.

Trigger rule: if a task matches one of these skills (or names it explicitly), use that skill.

## Hard Product Rules
- Local-first authored data.
- Single-writer model per workspace.
- Outbound external actions require explicit approval.
- AI changes must be auditable.

## Non-Goals
- No autonomous external posting/sending.
- No UI-first delivery.
- No team/cloud-first architecture requirements.

## Technology Baseline
- Use latest stable versions, pinned in lockfiles.
- Required stack: `bun`, `electron`, `typescript`, `vite`, `react`, `shadcn/ui`, `effect`, `pi-mono`, `super-ralph`, `jj`.
- `super-ralph` is the primary autonomous workflow path (it runs on `smithers-orchestrator`).
- Codex CLI is the default implementation agent path.

## Delivery Policy (Non-Negotiable)
- Core logic first.
- Thorough tests before UI integration.
- UI is blocked until all targeted core features and tests for that slice are complete and passing.

## Implementation Workflow
Use Super Ralph campaign prompts from `automation/super-ralph/input/`:
1. `campaign-01-core-foundation.md`
2. `campaign-02-ui-integration.md`
3. `campaign-03-hardening-and-fixes.md`
4. `campaign-04-readiness.md`

Keep work chunked, test-first for core, and commit each atomic piece immediately after validation.

## Super Ralph Preflight
Before implementation, confirm understanding of Super Ralph from local source:
- `references/super-ralph`
- Focus: prompt contract, generated workflow behavior, monitoring, JJ expectations.

## Reference Repos
Research relevant patterns before major implementation decisions:
- `references/effect`
- `references/cheffect`
- `references/accountability`
- `references/jj`
- `references/pi-mono`
- `references/super-ralph`

## Engineering Standards
- Prefer Effect primitives for async flow, retries, scheduling, and error handling.
- Keep side effects at boundaries; keep core deterministic and testable.
- Keep changes small, reviewable, and resumable.

## Commit Policy
- Commit every atomic piece of completed work.
- Use small logical commits, not one large commit.
- Use Conventional Commits without `origin-v2` scope prefixes.
- Subject format: `<type>(<area>): <imperative summary>`
- Allowed `type` values: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.
- Preferred body format:
  - `Why:` short rationale bullets
  - `What:` concrete change bullets
  - `Validation:` commands/results bullets
- Use JJ checkpoint flow for frequent progress:
  - `jj describe -m \"<commit subject>\"`
  - `jj new` to start the next logical change
- After an atomic piece is validated, commit immediately (do not batch unrelated completed work).
- If commit expectations are unclear, stop and ask before committing.

## Ambiguity Policy
If ambiguity risks incorrect behavior, policy violation, or unsafe automation: stop and ask for clarification.

# Origin v2 Agent Guide

## Mission
Build Origin v2 as a local-first, single-user command center that turns raw input into structured work and a reliable 3-21 day plan.

## Source of Truth (in order)
1. `docs/design.spec.md`
2. `docs/engineering.choices.md`
3. `docs/smithers.autonomy.md`
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
- Required stack: `bun`, `electron`, `typescript`, `vite`, `react`, `shadcn/ui`, `effect`, `pi-mono`, `smithers`, `jj`.
- Codex CLI is the default implementation agent path; PI is optional when available.

## Delivery Policy (Non-Negotiable)
- Core logic first.
- Thorough tests before UI integration.
- UI is blocked until all targeted core features and tests for that slice are complete and passing.

## Implementation Workflow
Use Smithers orchestration with this pipeline:
1. Discover
2. Plan
3. Core Implement
4. Core Validate
5. Review
6. Review Fix
7. Report

Loop `Core Implement -> Core Validate -> Review -> Review Fix` until objective approval or max iterations.

## Smithers Preflight
Before implementation, confirm understanding of Smithers from local source:
- `references/smithers`
- Focus: execution model, components, CLI agents, resumability, JJ integration.

## Reference Repos
Research relevant patterns before major implementation decisions:
- `references/effect`
- `references/cheffect`
- `references/accountability`
- `references/jj`
- `references/pi-mono`
- `references/smithers`

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

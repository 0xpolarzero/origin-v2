# CORE-REV-001 Research Context

## Ticket
- ID: `CORE-REV-001`
- Title: Implement core domain models/services required by spec
- Category: `spec-compliance`
- Goal: Implement Core Platform domain models and services for `Entry`, `Task`, `Event`, `Project`, `Note`, `Signal`, `Job`, `Notification`, `View`, `Memory`, and `Checkpoint`, including auditable state transitions.

## Relevant Files Field
- No explicit `relevantFiles` list was found for `CORE-REV-001` in this repository.
- Search evidence: only schema references to `relevantFiles` exist in `patches/super-ralph-codex-schema.patch`.

## Paths Reviewed

| Path | Summary | Relevance to CORE-REV-001 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Autonomous build prompt: authoritative docs, core-first gate, Effect + pi-mono preference, jj checkpointing, typecheck/tests per slice, explicit approval for outbound actions. (Path was listed twice in ticket input; same file.) | Defines required execution and implementation constraints for core domain delivery. |
| `README.md` | Repo overview and primary source-of-truth pointers to design/engineering/reference/prompt docs; run flow via Super Ralph. | Confirms which docs are canonical. |
| `docs/design.spec.md` | Product goals, required core domain objects, required views, required end-to-end workflows, and safety/auditability scope boundaries. | Primary functional source for domain model and state-transition requirements. |
| `docs/engineering.choices.md` | Normative stack and delivery guardrails: Bun/Electron/TS/Vite/React/shadcn, Effect usage, pi-mono, core-first rule, deterministic logic, side-effect boundaries, tests/typecheck each slice. | Architectural and process constraints for implementing core services. |
| `docs/references.md` | Required external reference repositories and expected `docs/references/*` paths. | Pattern/reference sources for Effect, pi-mono, and workflow orchestration decisions. |
| `docs/super-ralph.prompt.md` | Canonical prompt content matching generated prompt (objective, constraints, acceptance criteria). | Reinforces non-negotiable implementation and validation expectations. |
| `docs/test-suite-findings.md` | Current test status: integration suites scaffolded; real assertions blocked by missing core domain/services and composition root. | Documents current implementation gap and immediate test-driven slices. |
| `tests/integration/core-platform.integration.test.ts` | Smoke test exists; TODOs for Entry->Task promotion, planning/checkpoint transitions, and persistence/rehydration. | Direct executable target for this ticket’s initial domain slice. |
| `tests/integration/api-data.integration.test.ts` | Smoke test exists; TODOs for capture persistence, explicit outbound approval, restart durability. | Defines adjacent data/approval behavior dependencies of core domain. |
| `tests/integration/workflow-automation.integration.test.ts` | Smoke test exists; TODOs for planning transitions, approval gate, job inspect/retry, AI keep/recover flow. | Defines required workflow and audit transition behavior for core services. |
| `package.json` | Bun test scripts for core/api/workflow integration scaffolds only. | Confirms current validation entry points and missing implementation-backed tests. |
| `patches/super-ralph-codex-schema.patch` | Schema change includes `relevantFiles` field shape; no populated ticket data stored in repo. | Explains why ticket-level `relevantFiles` were not discoverable. |

## Spec Requirements Extracted

### Domain objects (explicit in spec section 3)
- `Entry` (raw capture)
- `Task`
- `Event`
- `Project`
- `Note`
- `Signal`
- `Job`
- `Notification`
- `View` (saved query/filter)
- `Memory`
- `Checkpoint`

### Mandatory workflow implications for domain services (spec section 5)
- Capture must persist raw input, produce AI suggestions, and support user accept/edit/reject into structured entities.
- Signals must support triage and conversion into task/event/note/project or outbound draft.
- Planning loop must support schedule adjustments and task lifecycle transitions (`complete`, `defer`, `reschedule`).
- Local event sync and outbound operations must be approval-gated before execution.
- Automation jobs must support inspect + retry/fix after runs.
- AI-applied updates must be inspectable with keep/recover (rollback-capable) behavior.

### Safety/auditability boundaries (spec sections 2 and 7)
- Local-first authored data is required.
- Outbound actions require explicit user approval.
- AI writes must be auditable and reversible.

## Existing Implementation Status
- No core/domain source implementation exists yet for the required models/services.
- No concrete state machine/service modules are present for task/event/project/checkpoint/job/notification flows.
- Current integration tests are scaffolds with `test.todo` placeholders and smoke assertions only.
- No app composition root exists beyond test scaffolding.

## Constraints for Implementation Tickets
- Core-first is mandatory: implement/test domain logic before UI.
- Prefer Effect-based services/layers and deterministic core logic.
- Keep side effects at explicit boundaries (storage, outbound adapters, integrations).
- Use pi-mono for AI integration paths.
- Run relevant tests and typecheck per atomic slice.
- Use jj checkpointing and conventional commit messages.

## Suggested Next Implementation Slices (Derived from Current Gaps)
1. Define core schemas/models + transition types for all required entities, with explicit audit metadata.
2. Implement persistence boundary and core services for `Entry -> Task` triage and lifecycle transitions.
3. Implement approval-gated outbound workflow primitives and auditable `Checkpoint`/activity log mechanics.
4. Replace integration `test.todo` cases with executable assertions incrementally as each slice lands.

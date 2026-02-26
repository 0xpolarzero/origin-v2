# plan-horizon-scheduling-engine Research Context

## Ticket
- ID: `plan-horizon-scheduling-engine`
- Title: `Plan Horizon Scheduling Engine (3-21 Days)`
- Category: `core`
- Type: `feature`
- Estimated complexity: `large`
- Dependencies: `CORE-REV-001`, `API-001`, `global-command-capture-entry-pipeline`
- Description: Implement deterministic core planning logic that merges tasks/events into a configurable 3-21 day timeline, supports defer/reschedule/complete transitions, and exposes query/filter semantics needed by the Plan workflow.
- Required test plan:
  - pure core tests for ordering/conflicts/time-zone boundaries
  - integration tests for plan mutation commands

## Hinted Relevant Files (From Ticket Input)
- Missing: `src/core/planning/planService.ts`
- Missing: `src/core/tasks/taskScheduling.ts`
- Missing: `src/core/events/eventTimeline.ts`
- Missing: `tests/core/planning/planService.test.ts`

Nearest existing equivalents:
- `src/core/services/task-service.ts`
- `src/core/services/event-service.ts`
- `src/core/domain/task.ts`
- `src/core/domain/event.ts`
- `tests/unit/core/services/task-service.test.ts`

## Ticket Metadata Availability
- `plan-horizon-scheduling-engine` was not found in `.super-ralph/workflow.db` `category_review.suggested_tickets` during this research pass.
- No repo-stored `relevantFiles` payload exists for this ticket ID at this time.

## Paths Reviewed

| Path | Summary | Relevance to Ticket |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated execution prompt; requires core-first delivery, deterministic tested core behavior, and per-slice typecheck/tests. | Governs implementation and validation constraints for this ticket. |
| `README.md` | Canonical pointers to design, engineering, references, and workflow/schema contracts. | Confirms source-of-truth docs and contract locations. |
| `docs/design.spec.md` | Defines near-term planning goal (3-21 days), Plan view as task+event timeline, planning loop (`complete/defer/reschedule`), and View as saved query/filter. | Primary product requirements for horizon planning and query semantics. |
| `docs/engineering.choices.md` | Requires deterministic core logic, core-first sequencing, Effect where practical, and test/typecheck gates on each slice. | Constrains implementation approach for scheduling engine core. |
| `docs/super-ralph.prompt.md` | Mirrors generated prompt constraints and delivery loop (plan -> implement -> test -> review -> checkpoint). | Reinforces process and acceptance requirements. |
| `PROGRESS.md` | Repo status snapshot (last updated 2026-02-23) showing feature delivery is still early-stage. | Confirms this ticket is still open implementation work. |
| `docs/context/CORE-REV-001.md` | Baseline research for core domain/services and workflow requirements; includes planning transitions and auditability constraints. | Dependency context for core entities and transitions this ticket builds on. |
| `docs/context/API-001.md` | Research mapping workflow API surfaces and planning route delegation (`complete/defer/reschedule`). | Dependency context for integration tests through plan mutation commands. |
| `docs/context/global-command-capture-entry-pipeline.md` | Query service pattern guidance (repository-native query with deterministic fallback) and workflow visibility expectations. | Relevant pattern source for Plan query/filter semantics. |
| `docs/contracts/workflow-api-schema-contract.md` | Canonical planning routes (`planning.completeTask`, `planning.deferTask`, `planning.rescheduleTask`), date-like timezone rules, and persisted `task` + `view` table contract fields. | Contract constraints for mutation integration and view/query/filter semantics. |
| `src/core/services/task-service.ts` | Implements existing planning mutations (`completeTask`, `deferTask`, `rescheduleTask`) with audit transitions and UTC ISO timestamp writes. | Current mutation primitives to integrate with new horizon scheduler. |
| `src/core/services/event-service.ts` | Handles event sync approval workflow (`requestEventSync`), not scheduling/horizon planning. | Shows event-side lifecycle support but highlights missing planning timeline merge logic. |
| `src/core/domain/task.ts` | Task model includes schedule/defer/complete fields (`scheduledFor`, `dueAt`, `completedAt`, `deferredUntil`) and lifecycle status. | Required input model for deterministic horizon ordering and filters. |
| `src/core/domain/event.ts` | Event model includes start/end timestamps and sync state. | Required input model for task+event timeline merge. |
| `tests/unit/core/services/task-service.test.ts` | Existing unit coverage for task transition happy paths and audit writes. | Base mutation behavior coverage; does not yet cover horizon ordering/conflicts/time-zone boundaries. |

## Extracted Requirements for This Ticket

### Product + workflow requirements
- Plan must provide reliable near-term scheduling for a configurable 3-21 day horizon.
- Plan view timeline must combine tasks and events.
- Planning loop must support schedule adjustment transitions: complete, defer, and reschedule.
- Query/filter semantics are first-class (View is a saved query/filter domain object).

### Contract requirements
- Planning command integration must align with route keys:
  - `planning.completeTask`
  - `planning.deferTask`
  - `planning.rescheduleTask`
- Date-like input contracts accept `Date` or ISO-8601 with timezone (`Z` or offset).
- Persisted task fields required by scheduling semantics: `scheduled_for`, `due_at`, `completed_at`, `deferred_until`, `status`.
- Persisted view fields for query semantics: `name`, `query`, `filters`.

### Engineering constraints
- Core-first implementation and tests are mandatory before UI integration.
- Determinism and boundary-contained side effects are required.
- Effect usage is preferred where practical for core/domain workflows.

## Existing Implementation Snapshot (Current Repo)

### What exists
- Task transitions are implemented in `task-service`:
  - `completeTask`
  - `deferTask`
  - `rescheduleTask`
- Mutation behavior is deterministic at call-site level (explicit `at` timestamps, serialized as ISO UTC strings) and writes audit transitions.
- Task/event domain models already include the basic time fields needed for a merged timeline.

### What is missing for this ticket
- No dedicated plan-horizon scheduling engine module exists yet.
- No task+event timeline merge service exists with deterministic ordering/conflict semantics.
- No explicit time-zone boundary handling logic beyond ISO timestamp serialization.
- No plan-specific pure core tests for horizon ordering/conflicts/time-zone boundaries.
- Ticket-hinted files are currently absent.

## Dependency Alignment Notes
- `CORE-REV-001` provides core entity/service primitives and lifecycle transition foundations.
- `API-001` provides route-level integration surface for planning mutation commands.
- `global-command-capture-entry-pipeline` provides useful query-service patterning for deterministic filter/query behavior and immediate visibility semantics.

## Suggested Implementation Focus (Low-Prescription)

Potential new modules:
- `src/core/planning/planService.ts` (horizon assembly/query surface)
- `src/core/tasks/taskScheduling.ts` (task ordering/conflict helpers)
- `src/core/events/eventTimeline.ts` (event projection/window helpers)
- `tests/core/planning/planService.test.ts` (pure horizon engine test suite)

Likely integration touchpoints:
- `src/core/services/task-service.ts` (reuse mutation transitions)
- `src/core/domain/task.ts`, `src/core/domain/event.ts` (shape alignment)
- API/workflow adapters that call planning mutation commands

## Test Planning Notes (Mapped to Ticket)

Pure core tests:
- Deterministic ordering across mixed task/event timelines with stable tie-breakers.
- Horizon-window inclusion/exclusion at day boundaries for 3, 7, 14, 21-day windows.
- Conflict semantics tests for overlaps and collision cases.
- Time-zone boundary cases (offset vs UTC input) to verify day bucketing behavior.
- Filter/query semantics tests for common plan slices (status, source, due windows, project linkage).

Integration tests:
- Plan mutation command path verifies timeline reflects `complete/defer/reschedule` outcomes.
- Ensure command integration remains consistent with workflow API contracts for planning routes.

## Risks / Open Questions to Resolve During Implementation
1. Conflict-resolution policy is not fully specified (e.g., overlap precedence and tie-breaking).
2. Horizon bucketing policy needs explicit definition in local time vs UTC for user-visible days.
3. Query/filter contract for Plan needs explicit scope boundaries vs existing generic `View` semantics.
4. Missing hinted files indicate this ticket likely creates new modules rather than patching existing ones only.

## Suggested Verification Commands for Implementation Slice
- `bun run typecheck`
- `bun run test:unit:core`
- `bun run test:integration:workflow`
- targeted tests for new planning modules once added

## Notes
- `.super-ralph/generated/PROMPT.md` was listed twice in the ticket input; both references point to the same file/content.
- Research relied on in-repo docs/contracts/context and current implementation files present in this workspace.

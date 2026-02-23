# WF-AUDIT-001 Research Context

## Ticket
- ID: `WF-AUDIT-001`
- Title: `Implement core workflow domain and persistence slice`
- Category: `spec-compliance`
- Description: Build the first workflow core slice (`Entry -> Task` plus `Job/Checkpoint` primitives) with Effect-based services and local persistence, then expose deterministic domain APIs for automation runs.

## Relevant Files Field
- No explicit `relevantFiles` payload is present for `WF-AUDIT-001` in repository ticket metadata.
- Evidence:
  - `.super-ralph/workflow.db` (`category_review.suggested_tickets`) includes `WF-AUDIT-001` with `id/title/description/category/priority` only.
  - `json_type(ticket, '$.relevantFiles')` for `WF-AUDIT-001` resolves to null/empty.
  - No `WF-AUDIT-001` entries exist yet in `.super-ralph/workflow.db` tables `research`, `plan`, or `report`.

## Paths Reviewed

| Path | Summary | Relevance to WF-AUDIT-001 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Autonomous build constraints (core-first, Effect preference, explicit approvals, jj checkpoints). Ticket input listed this path twice. | Governs implementation and quality gates for this slice. |
| `.super-ralph/generated/workflow.tsx` | Smithers/Super Ralph generated workflow wiring and fallback config (`referenceFiles`: generated prompt, `README.md`, `docs`). | Confirms research framing and ticket provenance path. |
| `.super-ralph/workflow.db` | Stores suggested workflow audit tickets and prior run outputs. | Source of truth for `WF-AUDIT-001` metadata and missing `relevantFiles` evidence. |
| `README.md` | Repo overview + canonical source-of-truth doc list. | Confirms which docs are normative. |
| `docs/design.spec.md` | Product goals, required workflows, scope boundaries (`local-first`, explicit approval, auditable/reversible AI writes). | Primary functional requirements for this ticket. |
| `docs/engineering.choices.md` | Normative stack/guardrails: Effect usage, deterministic core logic, side effects at boundaries, test/typecheck per slice. | Architecture and delivery constraints for implementation. |
| `docs/references.md` | Expected external reference repositories under `docs/references/*`. | Indicates reference policy before major implementation decisions. |
| `docs/super-ralph.prompt.md` | Canonical prompt (same constraints as generated prompt). | Reinforces non-negotiable execution behavior. |
| `docs/test-suite-findings.md` | Historical early-state integration findings before full workflow implementation. | Background context for why this ticket existed. |
| `docs/context/CORE-REV-001.md` | Earlier research for first core workflow/domain implementation wave. | Historical predecessor for this ticket scope. |
| `docs/plans/CORE-REV-001.md` | Detailed TDD plan that originally defined Entry/Task, Job, Checkpoint service primitives. | Direct implementation pattern reference for this ticket. |
| `docs/context/CORE-REV-002.md` | Follow-on workflow API coverage and explicit approval lifecycle analysis. | Shows slice expansion beyond first workflow core primitives. |
| `docs/plans/CORE-REV-002.md` | TDD plan for adding signal ingestion and outbound draft approval lifecycle. | Clarifies adjacent workflow behavior expectations. |
| `docs/context/CORE-REV-003.md` | Database/migration research and persistence baseline analysis. | Persistence continuity for local-first workflow state. |
| `docs/plans/CORE-REV-003.md` | TDD plan for SQLite schema/migrations and app-level storage integration. | Documents persistence hardening sequence after initial slice. |
| `docs/context/CORE-REV-003-review-fix-tdd.md` | Review-fix evidence for transaction boundary and migration safety fixes. | Confirms reliability hardening relevant to this ticket's persistence goals. |
| `docs/plans/api-002-review-fix-tdd.md` | Review-fix notes for relation integrity and entity-version audit consistency. | Additional persistence correctness context. |
| `src/core/domain/common.ts` | Shared entity types, actor refs, ID/timestamp helpers, validation utilities. | Foundation for deterministic domain primitives in this slice. |
| `src/core/domain/audit-transition.ts` | Audit transition constructor and shape. | Core auditable-state primitive used by Entry/Task/Job/Checkpoint flows. |
| `src/core/domain/entry.ts` | Entry model (`captured/suggested/rejected/accepted_as_task`) + constructor. | Entry side of Entry -> Task slice. |
| `src/core/domain/task.ts` | Task model (`planned/completed/deferred`) + constructor. | Task side of Entry -> Task and planning lifecycle. |
| `src/core/domain/job.ts` | Job run-state model (`idle/running/succeeded/failed/retrying`) + constructor. | Job primitive required by ticket. |
| `src/core/domain/checkpoint.ts` | Checkpoint model (`created/kept/recovered`) with snapshot refs/entities and rollback metadata. | Checkpoint primitive required by ticket. |
| `src/core/repositories/core-repository.ts` | Core persistence/audit contract + transaction boundary method. | Defines local persistence interface for workflow slice. |
| `src/core/repositories/in-memory-core-repository.ts` | Deterministic in-memory repository with cloned reads/writes and ordered audit list. | Default local persistence backend for deterministic tests. |
| `src/core/repositories/file-core-repository.ts` | File snapshot adapter for save/load restart durability. | Local persistence for restartable, local-first state. |
| `src/core/repositories/sqlite/migrations.ts` | Ordered migration manifest + checksums. | Persistent local DB migration source. |
| `src/core/repositories/sqlite/migration-runner.ts` | Migration ledger creation, idempotent apply, checksum guard, rollback on failure. | Persistence correctness + deterministic upgrades. |
| `src/core/repositories/sqlite/sqlite-core-repository.ts` | SQLite repository mapping, paged list, audit persistence, transaction wrapper (`BEGIN IMMEDIATE`). | Durable local persistence backend for workflow primitives. |
| `src/core/database/migrations/001_core_schema.sql` | Baseline tables for core entities + audit + auxiliary index table. | Structural persistence baseline. |
| `src/core/database/migrations/002_core_constraints_indexes.sql` | Lifecycle/state triggers + core indexes. | Enforces domain invariants at storage boundary. |
| `src/core/database/migrations/003_relation_integrity.sql` | Relation integrity triggers and relation-focused indexes. | Preserves cross-entity consistency for workflow writes. |
| `src/core/database/migrations/004_audit_entity_versions.sql` | Entity version table and audit-triggered monotonic version updates. | Hardens auditability guarantees required by scope. |
| `src/core/services/entry-service.ts` | Capture, suggest/edit/reject, accept as task; writes linked audit transitions. | Main Entry -> Task workflow service. |
| `src/core/services/task-service.ts` | Complete/defer/reschedule transitions with audit transitions. | Planning-loop primitive adjacent to Entry -> Task slice. |
| `src/core/services/job-service.ts` | Record run outcomes, inspect run state, retry transitions with audit metadata. | Job primitive workflow service. |
| `src/core/services/checkpoint-service.ts` | Create, keep, recover checkpoints; restores/deletes entities from snapshots. | Checkpoint primitive workflow service. |
| `src/core/app/core-platform.ts` | Deterministic core API facade wiring services + repositories; wraps mutating calls in transaction boundary. | Required API exposure target in ticket description. |
| `tests/unit/core/domain/entry.test.ts` | Verifies Entry defaults and captured metadata behavior. | Domain primitive validation for Entry. |
| `tests/unit/core/domain/task.test.ts` | Verifies Task defaults/schedule serialization. | Domain primitive validation for Task. |
| `tests/unit/core/domain/job.test.ts` | Verifies Job defaults (`idle`, retry metadata). | Domain primitive validation for Job. |
| `tests/unit/core/domain/checkpoint.test.ts` | Verifies Checkpoint snapshot and rollback metadata wiring. | Domain primitive validation for Checkpoint. |
| `tests/unit/core/services/entry-service.test.ts` | Validates capture + accept Entry->Task + suggestion edit/reject paths and audit linkage. | Core behavior proof for first workflow slice. |
| `tests/unit/core/services/task-service.test.ts` | Validates complete/defer/reschedule transitions and audit writes. | Planning transition proof. |
| `tests/unit/core/services/job-service.test.ts` | Validates run recording, inspection, retry/fix transitions. | Job automation behavior proof. |
| `tests/unit/core/services/checkpoint-service.test.ts` | Validates snapshot create/keep/recover and restore/delete semantics. | Checkpoint recovery behavior proof. |
| `tests/unit/core/repositories/in-memory-core-repository.test.ts` | Verifies repository CRUD + immutable ordered audit listing. | Deterministic local persistence contract proof. |
| `tests/unit/core/repositories/file-core-repository.test.ts` | Verifies snapshot directory creation and invalid snapshot handling. | File persistence reliability proof. |
| `tests/unit/core/repositories/sqlite-migrations.test.ts` | Verifies migration manifest ordering/idempotency/rollback/checksum mismatch handling. | DB migration safety proof. |
| `tests/unit/core/repositories/sqlite-schema.test.ts` | Verifies required tables, constraints, relation triggers, indexes, entity-version behavior. | DB schema integrity proof. |
| `tests/unit/core/repositories/sqlite-core-repository.test.ts` | Verifies SQLite repository CRUD, paging, rollback transaction behavior, audit persistence. | DB repository contract proof. |
| `tests/integration/core-platform.integration.test.ts` | End-to-end Entry->Task flow, planning+checkpoint flow, snapshot restart, transaction-boundary assertion. | Direct integration proof for this ticket scope. |
| `tests/integration/workflow-automation.integration.test.ts` | End-to-end planning transitions, job inspect/retry, checkpoint keep/recover flow. | Automation-run API proof in ticket scope. |
| `tests/integration/api-data.integration.test.ts` | End-to-end capture/signal/approval + restart durability coverage. | Confirms local-first persistence and approval boundaries interacting with this slice. |
| `tests/integration/database-core-platform.integration.test.ts` | End-to-end DB-backed workflow coverage including migrations, restart durability, approvals, checkpoints, snapshot import. | Durable local persistence proof for this slice. |
| `package.json` | Scripts for unit/integration slices and `typecheck`; pinned dependency versions (`effect@3.19.19`, `bun@1.3.7`). | Validation commands and version pinning context. |

## Spec Requirements Extracted for WF-AUDIT-001

### Required workflow subset (`docs/design.spec.md:41-48`)
- Capture -> persist -> AI suggestion -> accept/edit/reject -> structured entity (Entry -> Task for first slice).
- Planning loop support for schedule updates and transitions (`complete/defer/reschedule`).
- Automation run lifecycle (`inspect -> retry/fix`).
- AI-applied update workflow (`inspect -> keep/recover`).

### Scope boundaries (`docs/design.spec.md:60-65`)
- Local-first authored data must persist across restarts.
- Outbound actions require explicit approval (adjacent safety guard to this slice).
- AI writes must be auditable and reversible.

### Engineering constraints (`docs/engineering.choices.md`)
- Core-first workflow implementation (domain + tests before UI).
- Prefer deterministic, testable core logic.
- Keep side effects at repository/outbound boundaries.

## Current Coverage Snapshot (against WF-AUDIT-001)

| Ticket expectation | Current implementation status | Evidence |
| --- | --- | --- |
| Entry -> Task core domain primitives | Implemented | `src/core/domain/entry.ts`, `src/core/domain/task.ts`, `tests/unit/core/domain/entry.test.ts`, `tests/unit/core/domain/task.test.ts` |
| Entry -> Task service workflow + audit | Implemented | `src/core/services/entry-service.ts`, `tests/unit/core/services/entry-service.test.ts`, `tests/integration/core-platform.integration.test.ts` |
| Job primitive domain + service + inspect/retry API | Implemented | `src/core/domain/job.ts`, `src/core/services/job-service.ts`, `src/core/app/core-platform.ts`, `tests/unit/core/services/job-service.test.ts`, `tests/integration/workflow-automation.integration.test.ts` |
| Checkpoint primitive domain + create/keep/recover + restoration | Implemented | `src/core/domain/checkpoint.ts`, `src/core/services/checkpoint-service.ts`, `src/core/app/core-platform.ts`, `tests/unit/core/services/checkpoint-service.test.ts`, `tests/integration/workflow-automation.integration.test.ts` |
| Local persistence slice | Implemented across in-memory, file snapshot, and sqlite backends | `src/core/repositories/*`, `src/core/database/migrations/*.sql`, repository + DB integration tests |
| Deterministic domain API exposure for automation runs | Implemented in facade shape; mutation methods wrapped by repository transaction boundary | `src/core/app/core-platform.ts`, `tests/integration/core-platform.integration.test.ts` |

## Implementation Risks / Follow-ups
1. Effect usage is function-based (`Effect.gen` + explicit repository args) rather than `Effect.Service`/`Layer`-driven service modules; acceptable functionally, but may diverge from stricter service-layer conventions.
2. True runtime determinism still depends on callers passing explicit IDs/timestamps; default constructors and fallback ports use `crypto.randomUUID()` / `new Date()` in several paths.
3. `docs/references.md` expects local `docs/references/*` submodules, but these are not present in this workspace; external pattern references were unavailable locally.

## Proposed File Focus for WF-AUDIT-001 Implementation
(derived because `relevantFiles` is absent)
- `src/core/domain/entry.ts`
- `src/core/domain/task.ts`
- `src/core/domain/job.ts`
- `src/core/domain/checkpoint.ts`
- `src/core/domain/audit-transition.ts`
- `src/core/services/entry-service.ts`
- `src/core/services/job-service.ts`
- `src/core/services/checkpoint-service.ts`
- `src/core/repositories/core-repository.ts`
- `src/core/repositories/in-memory-core-repository.ts`
- `src/core/repositories/file-core-repository.ts`
- `src/core/repositories/sqlite/sqlite-core-repository.ts`
- `src/core/app/core-platform.ts`
- `tests/unit/core/services/entry-service.test.ts`
- `tests/unit/core/services/job-service.test.ts`
- `tests/unit/core/services/checkpoint-service.test.ts`
- `tests/integration/core-platform.integration.test.ts`
- `tests/integration/workflow-automation.integration.test.ts`
- `tests/integration/database-core-platform.integration.test.ts`

## Suggested Verification Commands
- `bun run test:unit:core`
- `bun run test:integration:core`
- `bun run test:integration:workflow`
- `bun run test:integration:db`
- `bun run typecheck`

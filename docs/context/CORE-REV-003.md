# CORE-REV-003 Research Context

## Ticket
- ID: `CORE-REV-003`
- Title: Add app-level database schema and migrations for core entities
- Category: `spec-compliance`
- Description: Introduce concrete storage schema/migrations aligned to core entities and local-first/audit requirements from `docs/design.spec.md:14` and `docs/design.spec.md:60`.

## Relevant Files Field
- No explicit `relevantFiles` payload is present for `CORE-REV-003` in repository-stored ticket metadata.
- Evidence:
  - `.super-ralph/workflow.db` stores ticket metadata under `category_review.suggested_tickets`.
  - The `CORE-REV-003` object includes `id`, `title`, `description`, `category`, and `priority`, but no `relevantFiles`.

## Paths Reviewed

| Path | Summary | Relevance to CORE-REV-003 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated autonomous prompt with hard constraints (core-first, Effect preference, explicit approval gates, testing/typecheck, jj flow). Ticket input listed this path twice; content is the same file. | Defines execution guardrails for schema/migration implementation work. |
| `README.md` | Repo overview and source-of-truth pointers. | Confirms canonical docs to use for schema requirements. |
| `docs/design.spec.md` | Declares required core domain objects and scope boundaries (`local-first authored data`, `auditable/reversible AI writes`). | Primary source for schema coverage and audit/storage guarantees. |
| `docs/engineering.choices.md` | Normative stack/quality constraints; requires deterministic core logic and side effects at boundaries. | Constrains repository/migration architecture and testing discipline. |
| `docs/references.md` | Lists required reference repositories under `docs/references/*`. | Indicates expected pattern sources before major implementation. |
| `docs/super-ralph.prompt.md` | Canonical prompt equivalent to generated prompt. | Reinforces same delivery constraints for this ticket. |
| `.super-ralph/generated/workflow.tsx` | Generated Smithers/Super Ralph workflow wiring and fallback config. | Confirms this phase is research for ticketed work and where prompt/ref paths come from. |
| `.super-ralph/workflow.db` | Contains suggested tickets and prior plan/research/report outputs. | Source of truth for `CORE-REV-003` metadata and missing `relevantFiles` evidence. |
| `docs/context/CORE-REV-001.md` | Prior research context format and requirement extraction style. | Template continuity for context quality and traceability. |
| `docs/context/CORE-REV-002.md` | Prior workflow API coverage/gap analysis. | Shows storage-related behavior now expected to persist reliably (including outbound draft lifecycle). |
| `src/core/domain/common.ts` | Canonical `EntityType` list (includes `outbound_draft`) and shared primitives (`ActorRef`, ID/timestamps). | Baseline for table inventory and common columns. |
| `src/core/domain/audit-transition.ts` | Audit transition record shape: entity ref, from/to state, actor, reason, metadata, timestamp. | Direct mapping target for audit table schema. |
| `src/core/domain/entry.ts` | Entry fields/status lifecycle (`captured`, `suggested`, `rejected`, `accepted_as_task`). | Defines entry table columns and state domain. |
| `src/core/domain/task.ts` | Task fields/status lifecycle (`planned`, `completed`, `deferred`) and scheduling fields. | Defines task table columns and indexes for planning queries. |
| `src/core/domain/event.ts` | Event fields/sync lifecycle (`local_only`, `pending_approval`, `synced`). | Defines event table columns and approval-gated sync state persistence. |
| `src/core/domain/project.ts` | Project identity and lifecycle (`active`, `paused`, `completed`). | Defines project table columns and lifecycle state values. |
| `src/core/domain/note.ts` | Note body and linked entity refs array. | Defines note storage and entity-link representation need. |
| `src/core/domain/signal.ts` | Signal ingestion/triage/conversion fields and states. | Defines signal table columns and conversion linkage fields. |
| `src/core/domain/job.ts` | Job run/retry status and diagnostics fields. | Defines job table columns for workflow automation history. |
| `src/core/domain/notification.ts` | Notification message/type/status and related entity refs. | Defines notification table columns for approval/failure surfaces. |
| `src/core/domain/view.ts` | Saved view query and filter object storage. | Defines view table columns and JSON filter persistence need. |
| `src/core/domain/memory.ts` | Memory key/value/provenance/confidence fields. | Defines memory table columns and key-based lookup needs. |
| `src/core/domain/checkpoint.ts` | Checkpoint status, entity refs, embedded snapshot entities, audit cursor, rollback target. | Defines checkpoint table and checkpoint snapshot payload requirements. |
| `src/core/domain/outbound-draft.ts` | Outbound draft lifecycle (`draft`, `pending_approval`, `executing`, `executed`) and executionId. | Required for workflow-complete schema, even though not listed in design spec section 3 names. |
| `src/core/repositories/core-repository.ts` | Generic persistence contract for entities + audit transitions + snapshot hooks. | Contract that DB-backed repository/migration implementation must satisfy or evolve. |
| `src/core/repositories/in-memory-core-repository.ts` | Current deterministic map-based repository with audit list storage. | Baseline behavior to preserve semantically in DB-backed implementation. |
| `src/core/repositories/file-core-repository.ts` | Current JSON snapshot persistence (`version: 1`) and strict shape parser. | Shows current storage mechanism and lack of migration framework. |
| `src/core/app/core-platform.ts` | Composition root selecting in-memory/file repositories and exposing workflow APIs. | Integration point for introducing app-level DB repository + migration init path. |
| `src/core/services/entry-service.ts` | Persists entry/task entities and audit transitions for capture/suggest/accept/edit/reject flows. | Confirms cross-entity writes and required transition durability. |
| `src/core/services/signal-service.ts` | Persists signals and conversion targets (`task/event/note/project/outbound_draft`) with audit transitions. | Confirms conversion relationships and required transactional consistency points. |
| `src/core/services/task-service.ts` | Persists task state transitions with audit entries. | Confirms update + audit append patterns to preserve. |
| `src/core/services/event-service.ts` | Moves event to `pending_approval` and creates related notification. | Confirms multi-entity persistence for approval workflows. |
| `src/core/services/outbound-draft-service.ts` | Moves outbound draft to `pending_approval`, creates notification, includes manual rollback on failure. | Identifies transaction-sensitive writes and rollback requirements. |
| `src/core/services/approval-service.ts` | Approval gate for `event_sync` and `outbound_draft`, with staged `executing` -> `executed` transitions and rollback path. | Confirms critical safety/audit semantics schema must support. |
| `src/core/services/job-service.ts` | Job run outcome + retry persistence and audit trail updates. | Confirms automation history persistence needs. |
| `src/core/services/checkpoint-service.ts` | Stores checkpoints with snapshots and recovers entity state via save/delete operations. | Confirms checkpoint payload fidelity and restore semantics. |
| `src/core/services/view-service.ts` | Upsert-style view persistence and audit writes. | Confirms upsert patterns and idempotent saved-view behavior. |
| `src/core/services/memory-service.ts` | Upserts memory plus auxiliary `memory_key_index` entity writes for key lookup. | Highlights extra index-like storage requirement beyond core entity list. |
| `tests/integration/api-data.integration.test.ts` | Verifies capture persistence, explicit approval gates, outbound draft lifecycle, and restart durability of pending states. | Defines acceptance-relevant persistence behavior for this ticket. |
| `tests/integration/core-platform.integration.test.ts` | Verifies task promotion, checkpointing, and restart rehydration. | Confirms baseline local durability behavior expected after DB migration work. |
| `tests/integration/workflow-automation.integration.test.ts` | Verifies planning transitions, job inspect/retry, checkpoint keep/recover audit behavior. | Confirms workflow state/audit persistence expectations. |
| `tests/unit/core/repositories/in-memory-core-repository.test.ts` | Verifies ordered immutable audit listing and basic entity persistence semantics. | Contract expectations for repository behavior that DB repo should match. |
| `tests/unit/core/repositories/file-core-repository.test.ts` | Verifies snapshot directory creation and invalid snapshot error handling. | Signals current serialization/versioning boundary that migrations will supersede or bridge. |
| `package.json` | Current scripts/gates and dependency set (app currently has no first-class DB dependency). | Confirms migration stack is not yet configured at app layer. |

## Spec Requirements Extracted (CORE-REV-003 Scope)

### Core entity coverage (`docs/design.spec.md:14-25`)
Schema must concretely store at least:
- `Entry`
- `Task`
- `Event`
- `Project`
- `Note`
- `Signal`
- `Job`
- `Notification`
- `View`
- `Memory`
- `Checkpoint`

### Local-first and audit boundaries (`docs/design.spec.md:60-65`)
Storage/migrations must enforce:
- local-first authored data durability,
- reliable support for required core workflows,
- explicit approval constraints for outbound operations,
- auditable and reversible AI-applied writes.

### Workflow-driven persistence implications (`docs/design.spec.md:41-48`)
Schema must persist lifecycle transitions for:
- capture/suggestion/accept-reject flows,
- signal triage/conversion targets,
- planning transitions,
- approval-gated event/outbound execution,
- job inspect/retry lifecycle,
- checkpoint keep/recover rollback.

## Current Storage Baseline (What Exists Today)

1. `CoreRepository` is generic and string-keyed by `entityType` + `entityId`; there is no concrete relational schema.
2. In-memory repository uses `Map` buckets and an append-only in-memory audit array.
3. File repository persists one JSON snapshot (`version: 1`) containing:
   - `entities: Record<string, unknown[]>`,
   - `auditTrail: AuditTransition[]`.
4. Snapshot loading validates shape but does not run schema migrations.
5. Service layer performs many multi-write operations (entity + notification + audit), currently without database transactions.
6. `memory-service` writes an auxiliary `memory_key_index` entity type not declared in `ENTITY_TYPES`.

## Gap Analysis for CORE-REV-003

1. No app-level database schema exists for required entities.
2. No migration runner/version ledger exists (only snapshot `version: 1` JSON parsing).
3. No DB-level constraints or indexes enforce lifecycle/state/query invariants.
4. No transactional persistence boundary for multi-entity workflow writes.
5. No formal DB contract yet for audit metadata JSON and checkpoint snapshot payloads.
6. No compatibility/migration strategy yet from existing JSON snapshot format to DB-backed storage.

## Derived Schema Requirements (From Current Domain + Services)

| Concern | Required persisted shape/constraint | Source evidence |
| --- | --- | --- |
| Entries | `id`, content/source/status, captured/suggestion/rejection/accept metadata, timestamps | `src/core/domain/entry.ts`, `src/core/services/entry-service.ts` |
| Tasks | `id`, title/status, schedule/due/project/source linkage, completion/defer fields, timestamps | `src/core/domain/task.ts`, `src/core/services/task-service.ts` |
| Events | `id`, title, start/end, `sync_state`, timestamps | `src/core/domain/event.ts`, `src/core/services/event-service.ts`, `src/core/services/approval-service.ts` |
| Projects | `id`, name/description, lifecycle, timestamps | `src/core/domain/project.ts`, `src/core/services/signal-service.ts` |
| Notes | `id`, body, linked entity refs collection, timestamps | `src/core/domain/note.ts`, `src/core/services/signal-service.ts` |
| Signals | `id`, source/payload, triage state/decision, conversion linkage, timestamps | `src/core/domain/signal.ts`, `src/core/services/signal-service.ts` |
| Outbound drafts | `id`, payload/sourceSignalId, status lifecycle, optional executionId, timestamps | `src/core/domain/outbound-draft.ts`, `src/core/services/outbound-draft-service.ts`, `src/core/services/approval-service.ts` |
| Jobs | `id`, name, run state/retry counters, run history fields, diagnostics, timestamps | `src/core/domain/job.ts`, `src/core/services/job-service.ts` |
| Notifications | `id`, type/message/status, related entity refs, timestamps | `src/core/domain/notification.ts`, `src/core/services/event-service.ts`, `src/core/services/outbound-draft-service.ts` |
| Views | `id`, name/query, filters object, timestamps | `src/core/domain/view.ts`, `src/core/services/view-service.ts` |
| Memories | `id`, key/value/source/confidence, timestamps; key-based lookup support | `src/core/domain/memory.ts`, `src/core/services/memory-service.ts` |
| Checkpoints | `id`, name/status, snapshot refs and embedded snapshots, audit cursor, rollback target, recoveredAt, timestamps | `src/core/domain/checkpoint.ts`, `src/core/services/checkpoint-service.ts` |
| Audit trail | append-only transitions with entity ref, from/to state, actor, reason, timestamp, metadata | `src/core/domain/audit-transition.ts`, all `src/core/services/*.ts` |
| Migration ledger | ordered migration tracking table required for deterministic upgrades | implied by ticket requirement + absence in `src/core/repositories/file-core-repository.ts` |

## Reference Material Availability Note

- `docs/references.md` expects submodules under `docs/references/*`, but `docs/references/` is not present in this workspace at research time.
- Result: no local external reference repos were available to inspect directly for migration patterns.

## Proposed File Focus for CORE-REV-003 Implementation

In absence of ticket-provided `relevantFiles`, these are the likely high-impact files:

- `src/core/repositories/core-repository.ts`
  - add/adjust repository contract for DB-backed implementation and migration bootstrap.
- `src/core/repositories/file-core-repository.ts`
  - either keep as compatibility adapter or deprecate once DB repository exists.
- `src/core/app/core-platform.ts`
  - wire app-level DB repository and migration execution at startup.
- New migration/runtime files (path to decide in implementation):
  - `src/core/repositories/migrations/*` or `src/core/database/migrations/*`
  - `src/core/repositories/<db>-core-repository.ts` (SQLite/local DB implementation)
  - `src/core/repositories/migration-runner.ts`
- Tests to add/update:
  - new unit tests for migration application ordering/idempotency,
  - integration tests for restart durability using DB backend,
  - regression coverage for audit ordering and approval-gated workflows after DB persistence swap.

## Suggested Implementation Sequencing (Research Output)

1. Define concrete DB schema for all currently persisted entity types (`ENTITY_TYPES` plus `memory_key_index` or equivalent unique index strategy).
2. Add migration ledger + first baseline migration creating entity/audit tables and essential indexes.
3. Implement DB-backed `CoreRepository` with transaction support for multi-write service flows.
4. Integrate migration/bootstrap into `buildCorePlatform` initialization path.
5. Add compatibility path for existing snapshot consumers or a one-time import migration.
6. Run and update repository + integration tests to validate local-first durability and audit/recovery guarantees remain intact.

# WF-AUDIT-002 Research Context

## Ticket
- ID: `WF-AUDIT-002`
- Title: `Add workflow API routes and product DB schema`
- Category: `spec-compliance`
- Priority: `critical`
- Description: Create explicit API route handlers and database schema/migrations for workflow operations (capture, triage, run history, retry/fix, recovery) so route/schema compliance can be validated.

## Relevant Files Field
- No explicit `relevantFiles` payload is present for `WF-AUDIT-002` in repository ticket metadata.
- Evidence:
  - `.super-ralph/workflow.db` (`category_review.suggested_tickets`) stores `WF-AUDIT-002` with `id/title/description/category/priority` only.
  - `json_type(value, '$.relevantFiles')` for `WF-AUDIT-002` resolves to null/empty.
  - No existing `WF-AUDIT-002` rows were found in `.super-ralph/workflow.db` tables `research`, `plan`, or `report`.

## Paths Reviewed

| Path | Summary | Relevance to WF-AUDIT-002 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated autonomous prompt with hard constraints (core-first, Effect preference, test/typecheck, jj checkpoints). Ticket input listed this path twice. | Governs implementation and validation workflow for this ticket. |
| `.super-ralph/generated/workflow.tsx` | Generated Smithers workflow config (`referenceFiles`: generated prompt, `README.md`, `docs`). | Confirms research scope inputs and category/ticket execution context. |
| `.super-ralph/workflow.db` | Stores suggested tickets and run outputs. | Source of truth for `WF-AUDIT-002` metadata and missing `relevantFiles`. |
| `README.md` | Repo overview and canonical source-of-truth file list. | Confirms required docs and operating context. |
| `docs/design.spec.md` | Required workflows and scope boundaries (`local-first`, explicit approval, auditable/reversible AI writes). | Primary functional requirements for capture/triage/run/retry/recovery compliance. |
| `docs/engineering.choices.md` | Normative guardrails: core-first, deterministic core behavior, test/typecheck discipline. | Constrains architecture and delivery quality for route/schema work. |
| `docs/references.md` | Lists external reference repositories expected under `docs/references/*`. | Reference policy baseline for implementation decisions. |
| `docs/super-ralph.prompt.md` | Canonical prompt matching generated prompt constraints. | Reinforces non-negotiable delivery behavior. |
| `docs/test-suite-findings.md` | Early-state workflow findings before route/schema implementation landed. | Historical background for why workflow audit tickets were generated. |
| `docs/context/WF-AUDIT-001.md` | Prior workflow audit research context. | Immediate predecessor format and scope continuity reference. |
| `docs/context/API-001.md` | Research for explicit workflow API route layer under `src/api/workflows/*`. | Direct predecessor for route-handler coverage. |
| `docs/context/API-002.md` | Research for canonical schema and migration hardening. | Direct predecessor for DB schema/migration coverage. |
| `docs/plans/API-001.md` | TDD plan for API route contracts, handlers, and workflow-api integration tests. | Route-level implementation pattern reference. |
| `docs/plans/API-002.md` | TDD plan for migration hardening, relation integrity triggers, and audit entity versions. | Schema/migration implementation pattern reference. |
| `docs/plans/WF-AUDIT-001.md` | Workflow domain + persistence TDD sequencing across services/repositories/platform. | Workflow audit continuity reference. |
| `src/api/workflows/contracts.ts` | Declares `WorkflowRouteKey`, workflow API handler interface, and route definition shape. | Canonical contract for explicit workflow routes. |
| `src/api/workflows/routes.ts` | Defines stable route paths, per-route payload validators, and explicit route handlers for capture/signal/planning/approval/job/checkpoint operations. | Primary route compliance artifact for this ticket. |
| `src/api/workflows/workflow-api.ts` | Adapter from route handlers to `CorePlatform` methods with unified `WorkflowApiError` mapping. | Connects explicit routes to core workflow behavior. |
| `src/api/workflows/errors.ts` | Route-tagged API error type and normalization helper. | Required for consistent route-level failure semantics. |
| `src/core/app/core-platform.ts` | Core workflow facade exposing capture, triage, job run/inspect/retry, and checkpoint create/keep/recover methods behind transaction boundaries. | Execution backend for route handlers and compliance verification. |
| `src/core/services/entry-service.ts` | Capture/suggest/edit/reject/accept flow with audit transitions. | Capture workflow semantics used by route handlers and schema writes. |
| `src/core/services/signal-service.ts` | Signal ingest/triage/convert flow with audit transitions and converted entity links. | Triage workflow semantics used by route handlers and schema writes. |
| `src/core/services/job-service.ts` | Job run recording, inspection snapshot, and retry transition logic. | Run-history and retry/fix workflow semantics. |
| `src/core/services/checkpoint-service.ts` | Checkpoint create/keep/recover, snapshot restoration/deletion, recovery audit metadata. | Recovery workflow semantics. |
| `src/core/repositories/core-repository.ts` | Persistence and append-only audit contract with transaction boundary. | Shared contract route-driven workflows depend on. |
| `src/core/repositories/sqlite/migrations.ts` | Ordered migration manifest and checksums. | Canonical migration list for schema compliance. |
| `src/core/repositories/sqlite/migration-runner.ts` | `schema_migrations` ledger creation, sorted/idempotent apply, rollback and checksum mismatch protection. | Migration compliance/safety mechanism. |
| `src/core/repositories/sqlite/sqlite-core-repository.ts` | Entity table mappings, JSON column handling, audit append/list, transactional writes. | Runtime persistence implementation over product schema. |
| `src/core/database/migrations/001_core_schema.sql` | Baseline tables for core entities and workflow-support entities (`outbound_draft`, `audit_transitions`, `memory_key_index`). | Base product schema contract. |
| `src/core/database/migrations/002_core_constraints_indexes.sql` | Lifecycle/state validation triggers and core indexes. | Enforces state correctness for capture/triage/run/recovery entities. |
| `src/core/database/migrations/003_relation_integrity.sql` | Relation integrity triggers and relation-focused indexes across linked entities and polymorphic refs. | Ensures cross-entity schema compliance for workflow writes. |
| `src/core/database/migrations/004_audit_entity_versions.sql` | `entity_versions` table, backfill from audit trail, and trigger for monotonic version increments. | Audit/version compliance for run and recovery workflows. |
| `tests/unit/api/workflows/errors.test.ts` | Verifies error mapping behavior for route-tagged API failures. | Unit proof of route error contract. |
| `tests/unit/api/workflows/routes.test.ts` | Verifies all required route keys/paths/methods, handler invocation mapping, and payload validation failures. | Unit proof of explicit route manifest and validation behavior. |
| `tests/unit/api/workflows/workflow-api.test.ts` | Verifies handler delegation to platform methods and failure normalization across all routes. | Unit proof that route layer is wired correctly to core behavior. |
| `tests/integration/workflow-api.integration.test.ts` | End-to-end workflow coverage through API handlers (capture, triage, planning, approvals, job run/retry, checkpoint recovery). | Primary integration proof for route-level workflow compliance. |
| `tests/unit/core/repositories/sqlite-migrations.test.ts` | Verifies migration ordering, idempotency, rollback behavior, and checksum mismatch protection. | Unit proof of migration contract and upgrade safety. |
| `tests/unit/core/repositories/sqlite-schema.test.ts` | Verifies required tables, lifecycle constraints, relation triggers, and entity-version synchronization. | Unit proof of schema compliance coverage. |
| `tests/unit/core/repositories/sqlite-core-repository.test.ts` | Verifies persistence mapping, transaction rollback/savepoint behavior, and audit append/list semantics. | Unit proof of repository behavior on top of schema. |
| `tests/integration/database-core-platform.integration.test.ts` | Verifies DB bootstrap with migrations, workflow persistence, approval states across restart, and audit/version relation invariants. | Integration proof for schema behavior under workflow operations. |
| `tests/integration/workflow-automation.integration.test.ts` | Verifies planning transitions, job inspect/retry flow, and checkpoint keep/recover flow through platform. | Additional workflow compliance signal for run/retry/recovery paths. |
| `tests/integration/api-data.integration.test.ts` | Verifies capture/signal/approval flows and restart durability in non-route platform flows. | Corroborating evidence for workflow semantics persisted by schema. |
| `package.json` | Contains relevant scripts: `test:integration:api`, `test:integration:db`, `test:integration:workflow`, `typecheck`. | Verification command reference for this ticket slice. |
| `docs/references/` | Directory is not present in this workspace. | Indicates listed external references are unavailable locally during research. |

## Spec Requirements Extracted for WF-AUDIT-002
- `docs/design.spec.md` requires explicit support for:
  - capture -> suggest -> accept/edit/reject workflow,
  - signal ingestion/triage/conversion workflow,
  - automation run -> inspect -> retry/fix workflow,
  - AI-applied update -> inspect -> keep/recover workflow.
- `docs/design.spec.md` scope boundaries require:
  - local-first authored data persistence,
  - explicit approval for outbound actions,
  - auditable and reversible AI-applied writes.
- Ticket-specific compliance target:
  - explicit workflow API route handlers,
  - concrete product schema + migrations for capture/triage/run-history/retry/recovery operations,
  - testable route/schema compliance.

## Route and Schema Compliance Matrix (Current Snapshot)

| Ticket workflow operation | Explicit API routes | Core service/backend path | Schema and migration coverage | Validation coverage |
| --- | --- | --- | --- | --- |
| Capture | `capture.entry`, `capture.suggest`, `capture.editSuggestion`, `capture.rejectSuggestion`, `capture.acceptAsTask` | `core-platform` -> `entry-service` | `entry`, `task`, `audit_transitions`; relation checks on `task.source_entry_id` and `entry.accepted_task_id` | `tests/unit/api/workflows/routes.test.ts`, `tests/unit/api/workflows/workflow-api.test.ts`, `tests/integration/workflow-api.integration.test.ts`, `tests/unit/core/repositories/sqlite-schema.test.ts` |
| Triage | `signal.ingest`, `signal.triage`, `signal.convert` | `core-platform` -> `signal-service` | `signal`, target entities, `outbound_draft`, `audit_transitions`; converted-entity pair/type/target integrity triggers | `tests/unit/api/workflows/routes.test.ts`, `tests/integration/workflow-api.integration.test.ts`, `tests/unit/core/repositories/sqlite-schema.test.ts`, `tests/integration/database-core-platform.integration.test.ts` |
| Run history | `job.create`, `job.recordRun`, `job.inspectRun` | `core-platform` -> `job-service` | `job` table stores latest run snapshot fields (`run_state`, `retry_count`, timestamps/diagnostics); append-only `audit_transitions` + `entity_versions` provide historical versioning | `tests/unit/api/workflows/workflow-api.test.ts`, `tests/integration/workflow-api.integration.test.ts`, `tests/unit/core/services/job-service.test.ts`, `tests/unit/core/repositories/sqlite-schema.test.ts` |
| Retry/fix | `job.retry` (typically followed by `job.recordRun`) | `core-platform` -> `job-service.retryJobRun` | `job.retry_count` + `run_state` updates; retry audit transition persisted in `audit_transitions` and versioned via `entity_versions` trigger | `tests/unit/api/workflows/workflow-api.test.ts`, `tests/integration/workflow-api.integration.test.ts`, `tests/unit/core/services/job-service.test.ts`, `tests/integration/workflow-automation.integration.test.ts` |
| Recovery | `checkpoint.create`, `checkpoint.keep`, `checkpoint.recover` | `core-platform` -> `checkpoint-service` | `checkpoint` snapshot/audit cursor/rollback fields, status triggers, `audit_transitions`, `entity_versions` | `tests/unit/api/workflows/workflow-api.test.ts`, `tests/integration/workflow-api.integration.test.ts`, `tests/unit/core/services/checkpoint-service.test.ts`, `tests/integration/database-core-platform.integration.test.ts` |

## Notable Ambiguities and Potential Gaps for Implementation
1. Route handlers are explicit and validated, but are transport-agnostic route definitions under `src/api/workflows/*`; there is no framework-bound HTTP/IPC adapter file in this repo yet.
2. Route validators currently require `Date` objects for time fields; direct HTTP JSON payloads would typically send ISO strings and would need a boundary parser.
3. Run history is represented as current `job` state plus append-only audit transitions, not a dedicated `job_run_history` table; confirm whether ticket intent requires a separate normalized run-history table.
4. External reference submodules listed in `docs/references.md` are not present locally, so research relied on in-repo implementation and tests.

## Proposed File Focus for WF-AUDIT-002 Implementation
(derived because `relevantFiles` is absent)
- `src/api/workflows/contracts.ts`
- `src/api/workflows/routes.ts`
- `src/api/workflows/workflow-api.ts`
- `src/api/workflows/errors.ts`
- `src/core/app/core-platform.ts`
- `src/core/services/entry-service.ts`
- `src/core/services/signal-service.ts`
- `src/core/services/job-service.ts`
- `src/core/services/checkpoint-service.ts`
- `src/core/repositories/sqlite/migrations.ts`
- `src/core/repositories/sqlite/migration-runner.ts`
- `src/core/repositories/sqlite/sqlite-core-repository.ts`
- `src/core/database/migrations/001_core_schema.sql`
- `src/core/database/migrations/002_core_constraints_indexes.sql`
- `src/core/database/migrations/003_relation_integrity.sql`
- `src/core/database/migrations/004_audit_entity_versions.sql`
- `tests/unit/api/workflows/errors.test.ts`
- `tests/unit/api/workflows/routes.test.ts`
- `tests/unit/api/workflows/workflow-api.test.ts`
- `tests/integration/workflow-api.integration.test.ts`
- `tests/unit/core/repositories/sqlite-migrations.test.ts`
- `tests/unit/core/repositories/sqlite-schema.test.ts`
- `tests/unit/core/repositories/sqlite-core-repository.test.ts`
- `tests/integration/database-core-platform.integration.test.ts`
- `tests/integration/workflow-automation.integration.test.ts`

## Suggested Verification Commands
- `bun test tests/unit/api/workflows/errors.test.ts`
- `bun test tests/unit/api/workflows/routes.test.ts`
- `bun test tests/unit/api/workflows/workflow-api.test.ts`
- `bun test tests/integration/workflow-api.integration.test.ts`
- `bun test tests/unit/core/repositories/sqlite-migrations.test.ts`
- `bun test tests/unit/core/repositories/sqlite-schema.test.ts`
- `bun test tests/unit/core/repositories/sqlite-core-repository.test.ts`
- `bun test tests/integration/database-core-platform.integration.test.ts`
- `bun test tests/integration/workflow-automation.integration.test.ts`
- `bun run typecheck`

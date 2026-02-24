# global-command-capture-entry-pipeline Research Context

## Ticket
- ID: `global-command-capture-entry-pipeline`
- Title: `Global Command Capture and Entry Pipeline`
- Category: `workflow`
- Type: `feature`
- Estimated complexity: `medium`
- Dependencies: `CORE-REV-001`, `API-002`
- Description: Build an always-available keyboard-first command capture flow that persists raw `Entry` records immediately, records capture metadata, and feeds Inbox triage without UI-specific coupling.
- Required test plan:
  - unit tests for parser/persistence
  - integration test for capture -> persisted Entry -> Inbox visibility
  - failure-path test for draft recovery on write errors

## Hinted Relevant Files (From Ticket Input)
- Missing: `src/workflow/capture/commandCapture.ts`
- Missing: `src/core/entry/entryService.ts`
- Missing: `src/api/inbox/inboxQueries.ts`
- Missing: `tests/integration/capture-to-inbox.test.ts`

Nearest existing equivalents:
- `src/core/services/entry-service.ts` (current Entry capture/service implementation)
- `src/api/workflows/routes.ts` + `src/api/workflows/workflow-api.ts` (current capture API pipeline)
- `tests/unit/core/services/entry-service.test.ts` and `tests/integration/workflow-api.integration.test.ts` (current capture test patterns)

## Ticket Metadata Availability
- `global-command-capture-entry-pipeline` was not found in `.super-ralph/workflow.db` `category_review.suggested_tickets` during this research pass.
- No repo-stored `relevantFiles` payload exists for this ticket ID at this time.

## Paths Reviewed

| Path | Summary | Relevance to Ticket |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Global execution constraints: core-first, Effect-first where practical, jj checkpoints, test/typecheck discipline, no autonomous outbound actions. | Governs implementation process and acceptance expectations. |
| `README.md` | Canonical source-of-truth pointers (`docs/design.spec.md`, `docs/engineering.choices.md`, `docs/references.md`, `docs/super-ralph.prompt.md`). | Confirms required inputs for this research ticket. |
| `docs/design.spec.md` | Requires keyboard-first UX, always-available command-style quick capture, Inbox for untriaged entries/signals, and capture -> persist -> suggestion workflow. | Primary product requirements for command capture and Inbox feed behavior. |
| `docs/engineering.choices.md` | Core-first rule, deterministic core logic, side effects at boundaries, Effect usage, tests/typecheck per slice. | Constrains architecture and testing approach for this feature. |
| `docs/references.md` | Required external references list. | Reference policy baseline; `docs/references/` is currently absent locally. |
| `docs/super-ralph.prompt.md` | Matches generated prompt constraints. | Reinforces delivery rules for this ticket. |
| `PROGRESS.md` | Project progress snapshot indicates early product feature implementation status and core/api slices in progress. | Confirms this feature is still open work. |
| `docs/plans/CORE-REV-001.md` | Original TDD plan for domain/services including `captureEntry` and audit transitions. | Dependency context for capture behavior now in code. |
| `docs/context/CORE-REV-001.md` | Prior research for core domain/services. | Dependency context for current Entry model/service contracts. |
| `docs/plans/API-002.md` | TDD plan for schema/migration integrity and audit-driven versioning. | Dependency context for persistence guarantees and relation integrity. |
| `docs/context/API-002.md` | API-002 research with current schema coverage and remaining risk framing. | Dependency context for storage constraints relevant to capture metadata changes. |
| `docs/contracts/workflow-api-schema-contract.md` | Canonical route and persisted schema contract; includes capture routes and current `entry` column contract. | Must be updated if this ticket introduces Inbox API routes or new Entry capture metadata fields. |
| `docs/contracts/workflow-api-routes.md` | Compatibility pointer to canonical contract. | Follow-up doc update requirement if canonical contract changes. |
| `docs/contracts/persisted-schema.md` | Compatibility pointer to canonical contract. | Follow-up doc update requirement if canonical contract changes. |
| `docs/context/API-001.md` | Route-layer and workflow wiring research for capture/signal/planning flows. | Pattern reference for adding new non-UI workflow surfaces. |
| `docs/context/CORE-REV-002.md` | Workflow API surface research and gap patterns. | Useful precedent for documenting surface-level workflow gaps. |
| `src/core/domain/entry.ts` | `Entry` type + `createEntry` constructor; current source enum: `manual | import | api`; no dedicated capture metadata object. | Primary domain location likely impacted by capture metadata requirements. |
| `src/core/services/entry-service.ts` | `captureEntry`, suggestion/edit/reject, accept-as-task; capture persists entry then appends audit transition. | Current core capture pipeline entry point. |
| `src/core/app/core-platform.ts` | Exposes `captureEntry` and wraps mutating calls in repository transaction boundaries via `withTransaction`. | Existing non-UI orchestration boundary for new capture flow wiring. |
| `src/core/repositories/core-repository.ts` | Repository contract with `saveEntity/getEntity/listEntities/listAuditTrail/withTransaction` and optional query interfaces. | Defines persistence/query abstractions available for Inbox feed implementation. |
| `src/core/repositories/in-memory-core-repository.ts` | Baseline in-memory persistence implementation; `withTransaction` is passthrough, `listEntities` is bucket insertion-order. | Relevant for unit/integration test semantics and ordering behavior differences. |
| `src/core/repositories/file-core-repository.ts` | Snapshot-backed repository wrapper around in-memory repository. | Useful for restart/draft-recovery scenarios in tests. |
| `src/core/repositories/sqlite/sqlite-core-repository.ts` | SQLite persistence, migration bootstrap, paged list reads, activity/job query helpers, transaction/savepoint semantics. | Important for durable capture writes, rollback behavior, and query performance/ordering. |
| `src/core/database/migrations/001_core_schema.sql` | Base `entry` table columns include `content/source/status/captured_at/...`; no explicit command-capture metadata fields. | Schema baseline for any metadata additions. |
| `src/core/database/migrations/002_core_constraints_indexes.sql` | Entry status triggers and core indexes. | Integrity implications for new capture states/fields. |
| `src/core/database/migrations/003_relation_integrity.sql` | Relation indexes and triggers (`task.source_entry_id`, `entry.accepted_task_id`, audit target checks, etc.). | Ensures capture-linked relations remain valid with future inbox/triage flows. |
| `src/core/database/migrations/004_audit_entity_versions.sql` | `entity_versions` table + trigger from `audit_transitions`. | Relevant for auditable version tracking after capture writes. |
| `src/api/workflows/contracts.ts` | Workflow route-key union and typed API contracts; no Inbox route keys currently. | Shows missing API contract surface for Inbox-specific querying. |
| `src/api/workflows/routes.ts` | Capture route paths + payload validators (non-empty content, date parsing, actor parsing). | Parser/validator reference for command-input parsing and transport validation patterns. |
| `src/api/workflows/workflow-api.ts` | Route-to-platform adapter with error normalization. | Pattern for adding new route/service adapters without UI coupling. |
| `src/api/workflows/http-dispatch.ts` | Transport dispatch contract and sanitized error behavior. | Pattern for integration tests that validate capture flow over route boundaries. |
| `src/api/workflows/errors.ts` | Error-code mapping (`invalid_request` -> `validation`, etc.). | Needed if new inbox/capture parser failures need explicit API mapping. |
| `src/core/services/activity-service.ts` | Query service pattern: optional repository-native query path + in-memory fallback filtering/sorting/limit validation. | Strong model for implementing Inbox query service without UI coupling. |
| `src/core/services/job-service.ts` | Additional query-service pattern (`listJobs`, `listJobRunHistory`) with optional repository query interfaces + fallback behavior. | Another pattern for Inbox list/query API design. |
| `src/core/services/outbound-draft-service.ts` | Multi-write workflow with explicit rollback on partial failures. | Best existing pattern for failure-path draft recovery behavior on write errors. |
| `tests/unit/core/domain/entry.test.ts` | Validates `createEntry` defaults and whitespace rejection. | Baseline unit-test style for entry-constructor extensions (metadata/source variants). |
| `tests/unit/core/services/entry-service.test.ts` | Validates capture persistence + audit transitions + suggestion lifecycle. | Baseline unit-test style for capture persistence semantics. |
| `tests/unit/api/workflows/routes.test.ts` | Validator tests for whitespace rejection, ISO date coercion, timezone rules. | Best parser-test pattern for command parser and route parser additions. |
| `tests/unit/core/services/activity-service.test.ts` | Query/filter/pagination tests + repository-query fallback behavior. | Best test pattern for Inbox query service behavior and fallback path. |
| `tests/unit/core/services/outbound-draft-service.test.ts` | Rollback-focused unit tests on save/audit failures. | Direct pattern for failure-path "draft recovery on write errors" tests. |
| `tests/integration/api-data.integration.test.ts` | Integration pattern for capture persistence before downstream actions. | Useful template for capture -> persisted Entry assertions. |
| `tests/integration/workflow-api.integration.test.ts` | Integration pattern for capture -> suggestion lifecycle through API handlers. | Useful template for end-to-end capture pipeline tests. |
| `tests/integration/workflow-api-http.integration.test.ts` | Integration pattern for JSON route dispatch and sanitized failures. | Useful for transport-level capture/inbox visibility checks. |
| `tests/integration/core-platform.integration.test.ts` | Verifies capture/accept flow and mutation transaction boundary wrappers. | Useful for platform-level integration path and transaction assumptions. |
| `tests/integration/database-core-platform.integration.test.ts` | Includes forced write-failure rollback tests for job and checkpoint workflows. | Strong integration pattern for transaction rollback assertions under write errors. |
| `tests/integration/workflow-automation-edge-cases.integration.test.ts` | Failure-path coverage and post-failure recovery expectations. | Pattern for asserting state remains consistent after failed operations. |
| `src/ui/workflows/workflow-surface-client.ts` | Route-client adapter pattern independent of view components. | Useful precedent for maintaining non-UI coupling when exposing Inbox/capture surfaces. |

## Requirement Extraction for This Ticket

### Product requirements from spec
- `docs/design.spec.md` requires:
  - keyboard-first interaction (`UX requirements`)
  - command-style quick capture always available
  - Inbox view containing untriaged entries/signals and AI suggestions
  - capture -> persist -> AI suggestion -> user decision workflow

### Dependency carry-over
- `CORE-REV-001` dependency contributes:
  - working `Entry` model and capture/suggestion service operations
  - audit transition write semantics for capture lifecycle
- `API-002` dependency contributes:
  - durable schema/migration baseline with relation integrity and entity versioning
  - stronger DB-level guarantees for linked entity writes and audit consistency

## Current Capture Pipeline (What Exists)
1. Capture entry route path exists: `capture.entry` (`/api/workflows/capture/entry`).
2. Route validation enforces non-empty `content`, typed `actor`, and date coercion.
3. API layer delegates to `platform.captureEntry`.
4. Core platform wraps the mutation in `repository.withTransaction`.
5. Entry service builds an `Entry` via `createEntry`, saves it, then appends an `audit_transition`.
6. Persistence layer stores entry row + audit row; SQLite also updates `entity_versions` via trigger.

## Gaps Relative to `global-command-capture-entry-pipeline`
1. No always-available global command capture module exists (`src/workflow/capture/*` absent).
2. No dedicated command parser exists for keyboard command capture syntax.
3. No Inbox query module/API exists (`src/api/inbox/*` absent; no inbox route keys in workflow contracts).
4. No integration test exists for capture -> Inbox visibility (`tests/integration/capture-to-inbox.test.ts` absent).
5. `Entry` schema/domain do not currently model capture metadata beyond `source` and timestamps.
6. `EntrySource` currently supports `manual | import | api`; no explicit command-capture source variant.
7. `listEntities("entry")` ordering differs by backend (in-memory insertion order vs SQLite `ORDER BY id`), so Inbox ordering/visibility semantics are not yet formalized.
8. No explicit draft-recovery behavior exists for command-capture-specific write failures (only generic transaction rollback and outbound-draft rollback patterns exist today).

## Reusable Implementation/Test Patterns
- Parser and payload validation:
  - Reuse `routes.ts` parser helpers and `routes.test.ts` style (whitespace validation, ISO datetime coercion, timezone enforcement).
- Query service without UI coupling:
  - Reuse `activity-service` and `job-service` pattern: optional repository-native query + deterministic in-service fallback.
- Failure-path rollback and recovery:
  - Reuse rollback approach from `outbound-draft-service.ts` unit tests.
  - Reuse forced-failure integration style from `database-core-platform.integration.test.ts` (inject failing repository behavior and assert no partial writes).
- End-to-end non-UI pipeline:
  - Reuse workflow API + HTTP dispatcher integration style from `workflow-api.integration.test.ts` and `workflow-api-http.integration.test.ts`.

## Low-Prescription File Focus for Implementation

Potential new files (minimal additions):
- `src/workflow/capture/command-capture.ts` (or equivalent core capture adapter)
- `src/api/inbox/inbox-queries.ts` (or equivalent service/route adapter)
- `tests/unit/workflow/capture/command-capture.test.ts`
- `tests/integration/capture-to-inbox.test.ts`

Likely modified existing files:
- `src/core/domain/entry.ts` (if capture metadata and/or source enum expansion is required)
- `src/core/services/entry-service.ts` (if capture metadata propagation is needed)
- `src/core/repositories/core-repository.ts` (if new Inbox query contract is added)
- `src/core/repositories/sqlite/sqlite-core-repository.ts` (if repository-native Inbox queries are added)
- `src/core/database/migrations/*.sql` (only additive migration if new persisted capture metadata fields are required)
- `src/api/workflows/contracts.ts` + `src/api/workflows/routes.ts` + `src/api/workflows/workflow-api.ts` (if Inbox is exposed through workflow routes)
- `docs/contracts/workflow-api-schema-contract.md` (if route/schema contracts change)

## Test Planning Notes (Mapped to Ticket Requirements)
- Unit tests for parser/persistence:
  - parser validation should mirror existing route parser strictness (non-empty, timestamp coercion rules)
  - persistence tests should assert immediate raw Entry write + capture metadata write + audit append
- Integration test for capture -> persisted Entry -> Inbox visibility:
  - assert command capture writes are visible through an Inbox query surface without UI-layer dependency
  - include both in-memory and SQLite-backed behavior if ordering/filter semantics matter
- Failure-path test for draft recovery on write errors:
  - inject controlled repository write failure in the capture pipeline
  - assert no partial entry/inbox state leaks (or draft fallback is preserved, depending on final design)

## Constraints and Risks to Resolve During Implementation
1. If capture metadata requires new Entry columns, schema changes must be additive migrations and contract docs/tests must be updated.
2. Inbox visibility semantics (ordering/filtering) must be explicitly defined to avoid backend divergence.
3. Keep command-capture entry points independent from UI component code to satisfy ticket intent.
4. If adding routes, preserve sanitized error contract and route-doc traceability tests.

## Suggested Verification Commands for This Slice
- `bun test tests/unit/core/services/entry-service.test.ts`
- `bun test tests/unit/api/workflows/routes.test.ts`
- `bun test tests/unit/core/services/activity-service.test.ts`
- `bun test tests/unit/core/services/outbound-draft-service.test.ts`
- `bun test tests/integration/workflow-api.integration.test.ts`
- `bun test tests/integration/workflow-api-http.integration.test.ts`
- `bun test tests/integration/core-platform.integration.test.ts`
- `bun test tests/integration/database-core-platform.integration.test.ts`
- `bun run typecheck`

## Notes
- `docs/references/` submodules are not present in this workspace, so local research relied on in-repo implementation/tests/contracts.
- Ticket-provided hinted files appear to target a future module layout; current repo uses `src/core/services/*` and `src/api/workflows/*` for equivalent behavior.

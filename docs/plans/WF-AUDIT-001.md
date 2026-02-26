# WF-AUDIT-001 Plan: Core Workflow Domain + Persistence Slice (TDD First)

## Overview of the approach
Implement the first workflow core slice in strict core-first order:
1. Domain primitives for `Entry -> Task`, `Job`, `Checkpoint`, and `AuditTransition`.
2. Effect-based services for deterministic state transitions and audit writes.
3. Local persistence adapters (in-memory, file snapshot, SQLite + migrations).
4. Core platform API routes that expose deterministic automation-run workflows behind transaction boundaries.

The implementation sequence is intentionally atomic: one failing test, one implementation function/route, then green.

## TDD step order (tests before implementation)

1. **Test:** `tests/unit/core/domain/entry.test.ts` -> `createEntry` sets `captured` defaults, validates non-empty content, and uses provided timestamps deterministically.
   **Implement:** `src/core/domain/entry.ts` -> `createEntry(input: CreateEntryInput): Effect.Effect<Entry, DomainValidationError>`.

2. **Test:** `tests/unit/core/domain/task.test.ts` -> `createTask` sets `planned` defaults and serializes schedule fields.
   **Implement:** `src/core/domain/task.ts` -> `createTask(input: CreateTaskInput): Effect.Effect<Task, DomainValidationError>`.

3. **Test:** `tests/unit/core/domain/job.test.ts` -> `createJob` sets `runState=idle`, `retryCount=0`, and deterministic timestamps.
   **Implement:** `src/core/domain/job.ts` -> `createJob(input: CreateJobInput): Effect.Effect<Job, DomainValidationError>`.

4. **Test:** `tests/unit/core/domain/checkpoint.test.ts` -> `createCheckpoint` captures snapshot refs/entities, rollback target, and default status.
   **Implement:** `src/core/domain/checkpoint.ts` -> `createCheckpoint(input: CreateCheckpointInput): Effect.Effect<Checkpoint, DomainValidationError>`.

5. **Test:** `tests/unit/core/domain/audit-transition.test.ts` -> `createAuditTransition` validates required fields and stores actor/reason/from/to metadata.
   **Implement:** `src/core/domain/audit-transition.ts` -> `createAuditTransition(input: CreateAuditTransitionInput): Effect.Effect<AuditTransition, DomainValidationError>`.

6. **Test:** `tests/unit/core/services/entry-service.test.ts` -> `captureEntry` persists entry and appends one audit transition.
   **Implement:** `src/core/services/entry-service.ts` -> `captureEntry(repository: CoreRepository, input: CaptureEntryInput): Effect.Effect<Entry, EntryServiceError>`.

7. **Test:** `tests/unit/core/services/entry-service.test.ts` -> `suggestEntryAsTask` transitions `captured -> suggested` with deterministic metadata.
   **Implement:** `src/core/services/entry-service.ts` -> `suggestEntryAsTask(repository: CoreRepository, input: SuggestEntryAsTaskInput): Effect.Effect<Entry, EntryServiceError>`.

8. **Test:** `tests/unit/core/services/entry-service.test.ts` -> `editEntrySuggestion` updates suggestion text and audit reason/metadata.
   **Implement:** `src/core/services/entry-service.ts` -> `editEntrySuggestion(repository: CoreRepository, input: EditEntrySuggestionInput): Effect.Effect<Entry, EntryServiceError>`.

9. **Test:** `tests/unit/core/services/entry-service.test.ts` -> `rejectEntrySuggestion` transitions to `rejected` and stores rejection reason.
   **Implement:** `src/core/services/entry-service.ts` -> `rejectEntrySuggestion(repository: CoreRepository, input: RejectEntrySuggestionInput): Effect.Effect<Entry, EntryServiceError>`.

10. **Test:** `tests/unit/core/services/entry-service.test.ts` -> `acceptEntryAsTask` creates task, updates entry linkage, appends linked entry/task audit transitions.
    **Implement:** `src/core/services/entry-service.ts` -> `acceptEntryAsTask(repository: CoreRepository, input: AcceptEntryAsTaskInput): Effect.Effect<Task, EntryServiceError>`.

11. **Test:** `tests/unit/core/services/task-service.test.ts` -> `completeTask` transitions task to `completed` and appends audit.
    **Implement:** `src/core/services/task-service.ts` -> `completeTask(repository: CoreRepository, taskId: string, actor: ActorRef, at?: Date): Effect.Effect<Task, TaskTransitionError>`.

12. **Test:** `tests/unit/core/services/task-service.test.ts` -> `deferTask` transitions task to `deferred` with `deferredUntil`.
    **Implement:** `src/core/services/task-service.ts` -> `deferTask(repository: CoreRepository, taskId: string, until: Date, actor: ActorRef, at?: Date): Effect.Effect<Task, TaskTransitionError>`.

13. **Test:** `tests/unit/core/services/task-service.test.ts` -> `rescheduleTask` transitions back to `planned` and updates `scheduledFor`.
    **Implement:** `src/core/services/task-service.ts` -> `rescheduleTask(repository: CoreRepository, taskId: string, nextAt: Date, actor: ActorRef, at?: Date): Effect.Effect<Task, TaskTransitionError>`.

14. **Test:** `tests/unit/core/services/job-service.test.ts` -> `recordJobRun` persists succeeded/failed outcomes and diagnostics.
    **Implement:** `src/core/services/job-service.ts` -> `recordJobRun(repository: CoreRepository, input: RecordJobRunInput): Effect.Effect<Job, JobServiceError>`.

15. **Test:** `tests/unit/core/services/job-service.test.ts` -> `inspectJobRun` returns deterministic inspection snapshot.
    **Implement:** `src/core/services/job-service.ts` -> `inspectJobRun(repository: CoreRepository, jobId: string): Effect.Effect<JobRunInspection, JobServiceError>`.

16. **Test:** `tests/unit/core/services/job-service.test.ts` -> `retryJobRun` increments retry count and records previous failure in audit metadata.
    **Implement:** `src/core/services/job-service.ts` -> `retryJobRun(repository: CoreRepository, jobId: string, actor: ActorRef, at?: Date): Effect.Effect<Job, JobServiceError>`.

17. **Test:** `tests/unit/core/services/checkpoint-service.test.ts` -> `createWorkflowCheckpoint` snapshots referenced entities and appends create audit transition.
    **Implement:** `src/core/services/checkpoint-service.ts` -> `createWorkflowCheckpoint(repository: CoreRepository, input: CreateWorkflowCheckpointInput): Effect.Effect<Checkpoint, CheckpointServiceError>`.

18. **Test:** `tests/unit/core/services/checkpoint-service.test.ts` -> `keepCheckpoint` transitions `created -> kept`.
    **Implement:** `src/core/services/checkpoint-service.ts` -> `keepCheckpoint(repository: CoreRepository, checkpointId: string, actor: ActorRef, at?: Date): Effect.Effect<Checkpoint, CheckpointServiceError>`.

19. **Test:** `tests/unit/core/services/checkpoint-service.test.ts` -> `recoverCheckpoint` restores/deletes entities from snapshot and transitions `kept|created -> recovered`.
    **Implement:** `src/core/services/checkpoint-service.ts` -> `recoverCheckpoint(repository: CoreRepository, checkpointId: string, actor: ActorRef, at?: Date): Effect.Effect<RecoveryResult, CheckpointServiceError>`.

20. **Test:** `tests/unit/core/repositories/in-memory-core-repository.test.ts` -> entity CRUD contract and immutable ordered audit listing.
    **Implement:** `src/core/repositories/in-memory-core-repository.ts` -> `makeInMemoryCoreRepository(): CoreRepository` (`saveEntity/getEntity/listEntities/appendAuditTransition/listAuditTrail/withTransaction`).

21. **Test:** `tests/unit/core/repositories/file-core-repository.test.ts` -> snapshot persistence creates parent directories and load rejects invalid shape.
    **Implement:** `src/core/repositories/file-core-repository.ts` -> `makeFileCoreRepository(snapshotPath: string): Effect.Effect<CoreRepository, FileRepositoryError>` plus `persistSnapshot`/`loadSnapshot` behavior.

22. **Test:** `tests/unit/core/repositories/sqlite-migrations.test.ts` + `tests/unit/core/repositories/sqlite-schema.test.ts` -> deterministic migration ordering, idempotency, and required schema/constraints.
    **Implement:**
    - `src/core/repositories/sqlite/migrations.ts` -> `CORE_DB_MIGRATIONS`.
    - `src/core/repositories/sqlite/migration-runner.ts` -> `runSqliteMigrations(...)`.
    - `src/core/database/migrations/001_core_schema.sql` through `004_audit_entity_versions.sql`.

23. **Test:** `tests/unit/core/repositories/sqlite-core-repository.test.ts` -> SQLite CRUD, audit persistence/filtering, transaction rollback, relation-integrity errors.
    **Implement:** `src/core/repositories/sqlite/sqlite-core-repository.ts` -> `makeSqliteCoreRepository(options: SqliteCoreRepositoryOptions): Effect.Effect<CoreRepository & { close: () => Effect.Effect<void, SqliteCoreRepositoryError> }, SqliteCoreRepositoryError>`.

24. **Integration test:** `tests/integration/core-platform.integration.test.ts` -> Entry capture/accept flow and planning+checkpoint transitions via platform routes.
    **Implement:** `src/core/app/core-platform.ts` -> route wiring for `captureEntry`, `acceptEntryAsTask`, `completeTask`, `deferTask`, `rescheduleTask`, `createWorkflowCheckpoint`, and mutation transaction boundary wrapper.

25. **Integration test:** `tests/integration/workflow-automation.integration.test.ts` -> automation-run API for `createJob`, `recordJobRun`, `inspectJobRun`, `retryJob`, `keepCheckpoint`, `recoverCheckpoint`.
    **Implement:** `src/core/app/core-platform.ts` -> deterministic facade methods for job/checkpoint workflows.

26. **Integration test:** `tests/integration/core-platform.integration.test.ts` + `tests/integration/database-core-platform.integration.test.ts` -> restart durability (file snapshot + SQLite) and migration bootstrapping.
    **Implement:**
    - `src/core/app/core-platform.ts` -> `buildCorePlatform(options: BuildCorePlatformOptions)` repository selection, optional snapshot load/import, `persistSnapshot`, `loadSnapshot`, optional `close`.
    - `src/core/repositories/core-repository.ts` -> optional persistence lifecycle hooks (`persistSnapshot`, `loadSnapshot`, `close`).

## Files to create/modify (with specific function signatures)

### Create (if absent in target branch)
- `src/core/domain/audit-transition.ts`
  - `createAuditTransition(input: CreateAuditTransitionInput): Effect.Effect<AuditTransition, DomainValidationError>`
- `src/core/domain/entry.ts`
  - `createEntry(input: CreateEntryInput): Effect.Effect<Entry, DomainValidationError>`
- `src/core/domain/task.ts`
  - `createTask(input: CreateTaskInput): Effect.Effect<Task, DomainValidationError>`
- `src/core/domain/job.ts`
  - `createJob(input: CreateJobInput): Effect.Effect<Job, DomainValidationError>`
- `src/core/domain/checkpoint.ts`
  - `createCheckpoint(input: CreateCheckpointInput): Effect.Effect<Checkpoint, DomainValidationError>`
- `src/core/services/entry-service.ts`
  - `captureEntry(...)`, `suggestEntryAsTask(...)`, `editEntrySuggestion(...)`, `rejectEntrySuggestion(...)`, `acceptEntryAsTask(...)`
- `src/core/services/task-service.ts`
  - `completeTask(...)`, `deferTask(...)`, `rescheduleTask(...)`
- `src/core/services/job-service.ts`
  - `recordJobRun(...)`, `inspectJobRun(...)`, `retryJobRun(...)`
- `src/core/services/checkpoint-service.ts`
  - `createWorkflowCheckpoint(...)`, `keepCheckpoint(...)`, `recoverCheckpoint(...)`
- `src/core/repositories/core-repository.ts`
  - `interface CoreRepository` contract with transaction and optional persistence hooks
- `src/core/repositories/in-memory-core-repository.ts`
  - `makeInMemoryCoreRepository(): CoreRepository`
- `src/core/repositories/file-core-repository.ts`
  - `makeFileCoreRepository(snapshotPath: string): Effect.Effect<CoreRepository, FileRepositoryError>`
- `src/core/repositories/sqlite/migrations.ts`
  - `CORE_DB_MIGRATIONS`
- `src/core/repositories/sqlite/migration-runner.ts`
  - `runSqliteMigrations(...)`
- `src/core/repositories/sqlite/sqlite-core-repository.ts`
  - `makeSqliteCoreRepository(options: SqliteCoreRepositoryOptions): Effect.Effect<CoreRepository & { close: () => Effect.Effect<void, SqliteCoreRepositoryError> }, SqliteCoreRepositoryError>`
- `src/core/app/core-platform.ts`
  - `buildCorePlatform(options?: BuildCorePlatformOptions): Effect.Effect<CorePlatform, Error>`
- Unit tests under `tests/unit/core/domain/*`, `tests/unit/core/services/*`, `tests/unit/core/repositories/*`
- Integration tests:
  - `tests/integration/core-platform.integration.test.ts`
  - `tests/integration/workflow-automation.integration.test.ts`
  - `tests/integration/database-core-platform.integration.test.ts`

### Modify (current repository expectation)
- `src/core/app/core-platform.ts` (route wiring + transaction boundary + deterministic options)
- `src/core/repositories/core-repository.ts` (shared contract evolution)
- `src/core/repositories/sqlite/sqlite-core-repository.ts` (error mapping, transaction semantics, cleanup)
- `tests/integration/core-platform.integration.test.ts` (end-to-end Entry/Task + checkpoint expectations)
- `tests/integration/workflow-automation.integration.test.ts` (job/checkpoint automation route assertions)
- `tests/integration/database-core-platform.integration.test.ts` (SQLite durability + migration proofs)

## Tests to write (unit + integration)

### Unit tests
- Domain constructors and validation:
  - `tests/unit/core/domain/entry.test.ts`
  - `tests/unit/core/domain/task.test.ts`
  - `tests/unit/core/domain/job.test.ts`
  - `tests/unit/core/domain/checkpoint.test.ts`
  - `tests/unit/core/domain/audit-transition.test.ts`
- Service behavior and audit linkage:
  - `tests/unit/core/services/entry-service.test.ts`
  - `tests/unit/core/services/task-service.test.ts`
  - `tests/unit/core/services/job-service.test.ts`
  - `tests/unit/core/services/checkpoint-service.test.ts`
- Persistence contracts:
  - `tests/unit/core/repositories/in-memory-core-repository.test.ts`
  - `tests/unit/core/repositories/file-core-repository.test.ts`
  - `tests/unit/core/repositories/sqlite-migrations.test.ts`
  - `tests/unit/core/repositories/sqlite-schema.test.ts`
  - `tests/unit/core/repositories/sqlite-core-repository.test.ts`

### Integration tests
- `tests/integration/core-platform.integration.test.ts`
  - Entry capture -> accept as task
  - planning transitions + checkpoint create
  - transaction boundary wrapping for mutating routes
  - file snapshot restart durability
- `tests/integration/workflow-automation.integration.test.ts`
  - task complete/defer/reschedule through platform routes
  - job inspect/retry/fix through platform routes
  - checkpoint keep/recover audit workflow
- `tests/integration/database-core-platform.integration.test.ts`
  - migration bootstrap on first startup
  - workflow routes on SQLite backend
  - restart durability + auditable/reversible checkpoint behavior

## Risks and mitigations

1. **Risk:** Non-determinism from implicit `new Date()` / `crypto.randomUUID()` defaults causes flaky tests and automation drift.
   **Mitigation:** require explicit `at`/`id` in tests and route-level inputs for deterministic assertions; keep defaults only as fallback.

2. **Risk:** Multi-entity mutations can partially persist without transaction boundaries.
   **Mitigation:** wrap all mutating platform routes with `repository.withTransaction` and test rollback behavior in SQLite repository tests.

3. **Risk:** Checkpoint recovery can violate relation constraints when restoring/deleting linked entities.
   **Mitigation:** cover relation-integrity errors in SQLite repository tests and add recovery tests that restore existing + remove newly-created entities.

4. **Risk:** JSON persistence drift for checkpoint snapshots/audit metadata between file and SQLite backends.
   **Mitigation:** add round-trip assertions in repository tests and database integration tests for structured fields.

5. **Risk:** Error normalization differs across backends, making automation handling inconsistent.
   **Mitigation:** standardize service/repository tagged errors and assert message/shape in unit tests.

## How to verify against acceptance criteria

Derived acceptance criteria for this ticket:
1. Entry -> Task workflow is implemented and auditable.
2. Job and Checkpoint primitives are implemented with inspect/retry and keep/recover flows.
3. Local persistence exists (in-memory + file snapshot + SQLite) and survives restart.
4. Core platform exposes deterministic domain APIs for automation runs.

Verification commands:
- `bun run test:unit:core`
- `bun run test:integration:core`
- `bun run test:integration:workflow`
- `bun run test:integration:db`
- `bun run typecheck`

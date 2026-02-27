# WF-REV-003 Plan: Unify Transaction Ownership for Mutating Workflow Operations (TDD First)

## Overview of the approach
Adopt a single transaction owner at the platform boundary: `CorePlatform` remains the only owner of mutation transaction wrapping, and service functions stop opening their own `repository.withTransaction(...)` scopes.

This is the lowest-churn path because `buildCorePlatform` already centralizes mutation wrappers for most write routes, while preserving existing sequencing where AI work must run outside any open transaction (notably `suggestEntryAsTask` and `retryJob`).

Primary goal: remove overlapping platform+service ownership for the same operation while keeping rollback behavior and API-visible behavior unchanged.

## TDD step order (tests before implementation)

### Phase 1: RED - update ownership expectations in tests first
1. Update `tests/unit/core/services/job-service.test.ts`:
   change test `recordJobRun and retryJobRun execute within repository transaction boundaries` to assert service methods do not open transactions directly.
   - Replace with test name: `recordJobRun and retryJobRun do not open repository transaction boundaries directly`
   - Expected calls: `[]`.

2. Update `tests/unit/core/services/checkpoint-service.test.ts`:
   replace direct-transaction tests with no-direct-transaction expectations.
   - `createWorkflowCheckpoint does not open repository transaction boundary directly`
   - `keepCheckpoint does not open repository transaction boundary directly`
   - `recoverCheckpoint does not open repository transaction boundary directly`
   - Each expected call count: `0`.

3. Add/adjust coverage in `tests/integration/core-platform.integration.test.ts`:
   keep platform ownership assertion and expand to service-backed mutation routes that previously double-wrapped.
   - Add one assertion for `recordJobRun` through platform => exactly one transaction call.
   - Add one assertion for `createWorkflowCheckpoint` through platform => exactly one transaction call.
   - Add one assertion for `recoverCheckpoint` through platform => exactly one transaction call.

4. Keep and run AI boundary guard tests unchanged to lock sequencing invariant:
   - `tests/unit/core/app/core-platform.ai-transaction-boundary.test.ts`

5. Run focused tests (expect failure before implementation):
   - `bun test tests/unit/core/services/job-service.test.ts`
   - `bun test tests/unit/core/services/checkpoint-service.test.ts`
   - `bun test tests/integration/core-platform.integration.test.ts`
   - `bun test tests/unit/core/app/core-platform.ai-transaction-boundary.test.ts`

### Phase 2: GREEN - remove service-level transaction ownership
6. Refactor `src/core/services/job-service.ts`:
   - `recordJobRun(repository: CoreRepository, input: RecordJobRunInput): Effect.Effect<Job, JobServiceError>`
   - `retryJobRun(repository: CoreRepository, jobId: string, actor: ActorRef, at?: Date, fixSummary?: string, aiRuntime?: WorkflowAiRuntime): Effect.Effect<Job, JobServiceError>`
   Remove outer `repository.withTransaction(...)` usage and keep core mutation logic intact.

7. Refactor `src/core/services/checkpoint-service.ts`:
   - `createWorkflowCheckpoint(repository: CoreRepository, input: CreateWorkflowCheckpointInput): Effect.Effect<Checkpoint, CheckpointServiceError>`
   - `keepCheckpoint(repository: CoreRepository, checkpointId: string, actor: ActorRef, at?: Date): Effect.Effect<Checkpoint, CheckpointServiceError>`
   - `recoverCheckpoint(repository: CoreRepository, checkpointId: string, actor: ActorRef, at?: Date): Effect.Effect<RecoveryResult, CheckpointServiceError>`
   Remove outer `repository.withTransaction(...)` wrappers and keep write ordering/error mapping unchanged.

8. Refactor `src/core/services/entry-service.ts`:
   - `suggestEntryAsTask(repository: CoreRepository, input: SuggestEntryAsTaskInput, aiRuntime?: WorkflowAiRuntime): Effect.Effect<Entry, EntryServiceError>`
   Remove service-owned `repository.withTransaction(...)` around persistence block.

9. Refactor `src/core/app/core-platform.ts`:
   ensure `suggestEntryAsTask` and `retryJob` are platform-owned mutation boundaries while preserving AI-before-transaction behavior.
   - `suggestEntryAsTask: (input: SuggestEntryAsTaskInput) => ReturnType<typeof suggestEntryAsTask>` should call `withMutationBoundary(...)`.
   - `retryJob: (jobId: string, actor: ActorRef, at?: Date, fixSummary?: string) => ReturnType<typeof retryJobRun>` should call `withMutationBoundary(...)` around `retryJobRun(...)`.

10. Run focused suites until green:
   - `bun test tests/unit/core/services/job-service.test.ts`
   - `bun test tests/unit/core/services/checkpoint-service.test.ts`
   - `bun test tests/integration/core-platform.integration.test.ts`
   - `bun test tests/unit/core/app/core-platform.ai-transaction-boundary.test.ts`

### Phase 3: VERIFY - required integration gates
11. Run workflow integration suite:
   - `bun run test:integration:workflow`
12. Run API integration suite:
   - `bun run test:integration:api`
13. Run DB integration suite:
   - `bun run test:integration:db`
14. Run static/type verification:
   - `bun run typecheck`

15. Confirm rollback invariants explicitly remain green in DB integration output:
   - `forced recordJobRun write failure rolls back partial sqlite mutations`
   - `forced recoverCheckpoint write failure rolls back partial sqlite restore`

## Files to create/modify (with specific function signatures)

### Create
- `docs/plans/WF-REV-003.md`

### Modify (tests first)
- `tests/unit/core/services/job-service.test.ts`
  - Transaction ownership expectation test for:
    - `recordJobRun(repository, input)`
    - `retryJobRun(repository, jobId, actor, at?, fixSummary?, aiRuntime?)`

- `tests/unit/core/services/checkpoint-service.test.ts`
  - Transaction ownership expectation tests for:
    - `createWorkflowCheckpoint(repository, input)`
    - `keepCheckpoint(repository, checkpointId, actor, at?)`
    - `recoverCheckpoint(repository, checkpointId, actor, at?)`

- `tests/integration/core-platform.integration.test.ts`
  - Platform transaction ownership assertions for:
    - `platform.recordJobRun(input)`
    - `platform.createWorkflowCheckpoint(input)`
    - `platform.recoverCheckpoint(checkpointId, actor, at?)`

- `tests/unit/core/app/core-platform.ai-transaction-boundary.test.ts`
  - Keep existing AI sequencing tests to guard boundary behavior:
    - `suggestEntryAsTask runs ai runtime outside transaction scope`
    - `retryJob runs ai runtime outside transaction scope when fixSummary is omitted`

### Modify (implementation)
- `src/core/services/job-service.ts`
  - `recordJobRun(...)`
  - `retryJobRun(...)`

- `src/core/services/checkpoint-service.ts`
  - `createWorkflowCheckpoint(...)`
  - `keepCheckpoint(...)`
  - `recoverCheckpoint(...)`

- `src/core/services/entry-service.ts`
  - `suggestEntryAsTask(...)`

- `src/core/app/core-platform.ts`
  - `withMutationBoundary<A, E>(effect: Effect.Effect<A, E>): Effect.Effect<A, E>` usage for `suggestEntryAsTask` and `retryJob`

## Tests to write (unit + integration)

### Unit tests
1. `tests/unit/core/services/job-service.test.ts`
   - Assert direct service invocation does not call `repository.withTransaction` for `recordJobRun` and `retryJobRun`.

2. `tests/unit/core/services/checkpoint-service.test.ts`
   - Assert direct service invocation does not call `repository.withTransaction` for `createWorkflowCheckpoint`, `keepCheckpoint`, and `recoverCheckpoint`.

3. `tests/unit/core/app/core-platform.ai-transaction-boundary.test.ts`
   - No new tests required; retain as invariant gate and rerun.

### Integration tests
1. `tests/integration/core-platform.integration.test.ts`
   - Expand transaction-call assertions so each service-backed mutation route executes under exactly one platform-owned transaction boundary.

2. `tests/integration/database-core-platform.integration.test.ts`
   - No new test cases required; rerun to validate rollback semantics unchanged.

3. `tests/integration/workflow-api.integration.test.ts`
   - Regression run only; no new tests planned unless behavior drift appears.

4. `tests/integration/workflow-api-http.integration.test.ts`
   - Regression run only; no new tests planned unless behavior drift appears.

## Risks and mitigations
1. Risk: `suggestEntryAsTask` and `retryJob` may accidentally execute AI calls inside transaction after boundary movement.
   Mitigation: keep AI resolution logic in services before mutation writes and retain `core-platform.ai-transaction-boundary` tests as required gate.

2. Risk: changing ownership could alter rollback behavior if transaction wrapping is removed without equivalent platform wrapping.
   Mitigation: explicitly wrap `suggestEntryAsTask` and `retryJob` at platform layer and run DB rollback integration suite.

3. Risk: in-memory tests can mask nested transaction differences.
   Mitigation: require `test:integration:db` and sqlite transaction tests in verification flow.

4. Risk: accidental behavioral drift in API routes due to refactor side effects.
   Mitigation: run both `test:integration:workflow` and `test:integration:api` suites as acceptance gates.

## How to verify against acceptance criteria
1. Transaction ownership is singular for mutating workflow paths:
   - Service unit tests verify no direct service-owned `withTransaction` for targeted methods.
   - Core platform integration tests verify exactly one platform-owned transaction per targeted mutation call.

2. Rollback semantics are unchanged:
   - `bun run test:integration:db` passes, including forced-failure rollback tests for `recordJobRun` and `recoverCheckpoint`.

3. Workflow and API behavior is unchanged:
   - `bun run test:integration:workflow` passes.
   - `bun run test:integration:api` passes.

4. Type safety remains valid:
   - `bun run typecheck` passes.

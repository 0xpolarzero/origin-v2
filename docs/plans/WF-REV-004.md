# WF-REV-004 Plan: Add Atomic Rollback Failure Tests for Signal/Outbound Approval Workflow Chain (TDD First)

## Overview of the approach
Add deterministic sqlite integration rollback tests in `tests/integration/database-core-platform.integration.test.ts` using the same repository failure-injection pattern already used for `recordJobRun` and `recoverCheckpoint`.

Scope is test-first and integration-focused: prove each workflow mutation boundary is atomic under injected repository write failures for:
- signal ingest
- signal triage
- signal convert
- outbound approval execution (`outbound_draft`)

No production implementation changes are expected unless tests expose a real transaction-boundary gap.

## TDD step order (tests before implementation)

### Phase 1: RED - add failing integration tests first
1. Add helper type in `tests/integration/database-core-platform.integration.test.ts`:
   `type ForcedFailureConfig = { enabled: boolean; mode: "ingestAudit" | "triageAudit" | "convertSignalSave" | "outboundExecutedSave" }`
2. Add helper function in `tests/integration/database-core-platform.integration.test.ts`:
   `const buildFailureInjectedRepository = (databasePath: string, config: ForcedFailureConfig) => Effect.Effect<ReturnType<typeof makeSqliteCoreRepository> extends Effect.Effect<infer R, any, any> ? R : never>`
3. Add test: `forced ingestSignal audit write failure rolls back signal insert`
4. Add test: `forced triageSignal audit write failure rolls back signal triage update`
5. Add test: `forced convertSignal signal-write failure rolls back target+signal conversion mutations`
6. Add test: `forced outbound_draft approval executed-write failure rolls back staged execution mutations`
7. Run: `bun test tests/integration/database-core-platform.integration.test.ts` and confirm new tests fail for the expected reason before any implementation changes.

### Phase 2: GREEN - keep changes test-only unless a real gap is exposed
8. Implement only the repository-wrapper injection logic and test assertions needed for determinism in the same integration file.
9. Re-run: `bun test tests/integration/database-core-platform.integration.test.ts` until green.
10. If any test reveals non-atomic behavior, apply the smallest production fix at transaction boundary only:
    - `src/core/app/core-platform.ts`: ensure the affected route remains wrapped in `withMutationBoundary(...)`.
    - No service-level behavior changes unless strictly required.

### Phase 3: VERIFY - regression checks for adjacent workflow behavior
11. Run signal service unit regression: `bun test tests/unit/core/services/signal-service.test.ts`
12. Run approval service unit regression: `bun test tests/unit/core/services/approval-service.test.ts`
13. Run focused db integration regression: `bun run test:integration:db`
14. Run `bun run typecheck` only if any production file changed.

## Files to create/modify (with specific function signatures)

### Create
- `docs/plans/WF-REV-004.md`

### Modify
- `tests/integration/database-core-platform.integration.test.ts`
  - `type ForcedFailureConfig = { enabled: boolean; mode: "ingestAudit" | "triageAudit" | "convertSignalSave" | "outboundExecutedSave" }`
  - `const buildFailureInjectedRepository(databasePath: string, config: ForcedFailureConfig): Effect.Effect<CoreRepository>`
  - `test("forced ingestSignal audit write failure rolls back signal insert", async () => Promise<void>)`
  - `test("forced triageSignal audit write failure rolls back signal triage update", async () => Promise<void>)`
  - `test("forced convertSignal signal-write failure rolls back target+signal conversion mutations", async () => Promise<void>)`
  - `test("forced outbound_draft approval executed-write failure rolls back staged execution mutations", async () => Promise<void>)`

### Conditional modify (only if RED reveals a real bug)
- `src/core/app/core-platform.ts`
  - `ingestSignal(input: IngestSignalInput): ReturnType<typeof ingestSignal>`
  - `triageSignal(signalId: string, decision: string, actor: ActorRef, at?: Date): ReturnType<typeof triageSignal>`
  - `convertSignal(input: ConvertSignalInput): ReturnType<typeof convertSignal>`
  - `approveOutboundAction(input: ApproveOutboundActionInput): ReturnType<typeof approveOutboundAction>`

## Tests to write (unit + integration)

### Unit tests
- No new unit tests required for ticket acceptance (integration is the proof layer for sqlite transaction atomicity).
- Unit suites to run as regression guard:
  - `tests/unit/core/services/signal-service.test.ts`
  - `tests/unit/core/services/approval-service.test.ts`

### Integration tests (new)
1. `forced ingestSignal audit write failure rolls back signal insert`
   - Inject failure on `appendAuditTransition` when `entityType === "signal"` and `reason === "Signal ingested"`.
   - Assert call fails with injected error.
   - Assert `getEntity("signal", signalId)` is `undefined`.
   - Assert audit trail for that signal does not contain `toState: "untriaged"`.

2. `forced triageSignal audit write failure rolls back signal triage update`
   - Seed signal via successful ingest.
   - Inject failure on triage transition append (`reason` starts with `Signal triaged:`).
   - Assert call fails with injected error.
   - Assert signal remains `triageState: "untriaged"` and has no `triageDecision`.
   - Assert no `toState: "triaged"` transition exists.

3. `forced convertSignal signal-write failure rolls back target+signal conversion mutations`
   - Seed signal + successful triage.
   - Inject failure on `saveEntity("signal", signalId, entity)` when entity is being updated to `triageState: "converted"`.
   - Run conversion to a deterministic target type (`task` recommended).
   - Assert call fails with injected error.
   - Assert target entity was not persisted.
   - Assert signal still `triageState: "triaged"` with no `convertedEntityType/convertedEntityId`.
   - Assert no conversion transitions persisted for signal or created target.

4. `forced outbound_draft approval executed-write failure rolls back staged execution mutations`
   - Seed outbound_draft to `pending_approval` through ingest/triage/convert/request flow.
   - Mock outbound action port `execute` to return stable execution id.
   - Inject failure on `saveEntity("outbound_draft", draftId, entity)` when `status === "executed"`.
   - Assert approval call fails with injected error.
   - Assert `execute` called exactly once.
   - Assert draft persisted state is rolled back to `pending_approval` with no `executionId`.
   - Assert audit has no terminal `toState: "executed"` transition.

## Risks and mitigations
1. Risk: false positives if failure toggle matches unrelated writes.
   Mitigation: gate failures by entity type + reason/status + concrete entity id.

2. Risk: cross-test interference from shared ids or toggles.
   Mitigation: unique ids per test and per-test local toggle/config objects.

3. Risk: over-asserting exact error text causes brittle tests.
   Mitigation: assert injected message substring and rollback state, not full message equality.

4. Risk: convert/outbound tests become flaky due to broad setup chains.
   Mitigation: fixed timestamps, deterministic ids, and minimal assertions scoped to atomicity outcome.

5. Risk: existing rollback helper in `approveOutboundAction` can add rollback transitions that alter audit expectations.
   Mitigation: assert absence of forbidden partial terminal states (`triaged` for failed triage, `converted` for failed convert, `executed` for failed approval), not an exact full audit list.

## How to verify against acceptance criteria
1. `tests/integration/database-core-platform.integration.test.ts` contains all four forced-failure scenarios covering ingest/triage/convert + outbound approval execution.
2. Each test injects a write failure through repository seam (`saveEntity` or `appendAuditTransition`) and confirms effect failure.
3. Each test asserts no partial multi-entity persistence remains after failure.
4. `bun test tests/integration/database-core-platform.integration.test.ts` passes.
5. Adjacent regressions remain green:
   - `bun test tests/unit/core/services/signal-service.test.ts`
   - `bun test tests/unit/core/services/approval-service.test.ts`

# API-DATA-005 Plan: Add Missing Status-Mapping Regression Suite for Entry/Task/Signal Routes (TDD First)

## Overview of the approach
This ticket should be delivered as a regression-first slice that proves API behavior at two seams:
- `makeWorkflowApi` error mapping (unit)
- HTTP dispatcher responses (integration, sanitized payload shape preserved)

The expected statuses are already defined by contract (`not_found -> 404`, `conflict -> 409`), so the minimal implementation should focus on tagging the relevant core service failures with explicit error `code` values. The dispatcher response shape (`{ error, route, message }`) remains unchanged.

## TDD step order (tests before implementation)

### Phase 1: RED (write failing tests first)
1. Add a core unit test in `tests/unit/core/services/entry-service.test.ts`:
   `suggestEntryAsTask(...)` with missing `entryId` fails with `EntryServiceError` and `code: "not_found"`.

2. Add a core unit test in `tests/unit/core/services/task-service.test.ts`:
   `completeTask(...)` with missing `taskId` fails with `TaskTransitionError` and `code: "not_found"`.

3. Add a core unit test in `tests/unit/core/services/signal-service.test.ts`:
   `triageSignal(...)` with missing `signalId` fails with `SignalServiceError` and `code: "not_found"`.

4. Update/add a core unit test in `tests/unit/core/services/signal-service.test.ts`:
   `convertSignal(...)` on an existing untriaged signal fails with `SignalServiceError` and `code: "conflict"`.

5. Add a route-level mapping unit test in `tests/unit/api/workflows/workflow-api.test.ts`:
   `capture.suggest` preserves `not_found` and maps to `statusCode: 404`.

6. Add a route-level mapping unit test in `tests/unit/api/workflows/workflow-api.test.ts`:
   `planning.completeTask` preserves `not_found` and maps to `statusCode: 404`.

7. Add a route-level mapping unit test in `tests/unit/api/workflows/workflow-api.test.ts`:
   `signal.triage` preserves `not_found` and maps to `statusCode: 404`.

8. Add a route-level mapping unit test in `tests/unit/api/workflows/workflow-api.test.ts`:
   `signal.convert` precondition failure preserves `conflict` and maps to `statusCode: 409`.

9. Add an HTTP integration test in `tests/integration/workflow-api-http.integration.test.ts`:
   `capture.suggest` with missing entry returns sanitized `404` (`{ error, route, message }`) and route `capture.suggest`.

10. Add an HTTP integration test in `tests/integration/workflow-api-http.integration.test.ts`:
    `planning.completeTask` with missing task returns sanitized `404` and route `planning.completeTask`.

11. Add an HTTP integration test in `tests/integration/workflow-api-http.integration.test.ts`:
    `signal.triage` with missing signal returns sanitized `404` and route `signal.triage`.

12. Add an HTTP integration test in `tests/integration/workflow-api-http.integration.test.ts`:
    `signal.convert` against an untriaged existing signal returns sanitized `409` and route `signal.convert`.

### Phase 2: GREEN (minimal implementation to satisfy tests)
13. Update `src/core/services/entry-service.ts`:
    extend `EntryServiceError` with optional `code?: "not_found"` and set `code: "not_found"` in `loadEntry(...)` when the resource is missing.

14. Update `src/core/services/task-service.ts`:
    extend `TaskTransitionError` with optional `code?: "not_found"` and set `code: "not_found"` in `loadTask(...)` when the resource is missing.

15. Update `src/core/services/signal-service.ts`:
    extend `SignalServiceError` with optional `code?: "not_found" | "conflict"`;
    set `code: "not_found"` in `loadSignal(...)`;
    set `code: "conflict"` in `convertSignal(...)` when triage precondition fails.

16. Confirm `src/api/workflows/errors.ts` and `src/api/workflows/http-dispatch.ts` need no behavior change:
    existing mapper/dispatcher should pass once upstream service codes are present.

### Phase 3: VERIFY
17. Run focused core + API unit tests:
    - `bun test tests/unit/core/services/entry-service.test.ts`
    - `bun test tests/unit/core/services/task-service.test.ts`
    - `bun test tests/unit/core/services/signal-service.test.ts`
    - `bun test tests/unit/api/workflows/workflow-api.test.ts`

18. Run integration + contract gate commands:
    - `bun test tests/integration/workflow-api-http.integration.test.ts`
    - `bun run test:integration:api`
    - `bun run typecheck`

## Files to create/modify (with specific function signatures)

### Create
- `docs/plans/API-DATA-005.md`

### Modify: core implementation
- `src/core/services/entry-service.ts`
  - `export class EntryServiceError extends Data.TaggedError("EntryServiceError")<{ message: string; code?: "not_found" }>`
  - `const loadEntry(repository: CoreRepository, entryId: string): Effect.Effect<Entry, EntryServiceError>`

- `src/core/services/task-service.ts`
  - `export class TaskTransitionError extends Data.TaggedError("TaskTransitionError")<{ message: string; code?: "not_found" }>`
  - `const loadTask(repository: CoreRepository, taskId: string): Effect.Effect<Task, TaskTransitionError>`

- `src/core/services/signal-service.ts`
  - `export class SignalServiceError extends Data.TaggedError("SignalServiceError")<{ message: string; code?: "not_found" | "conflict" }>`
  - `const loadSignal(repository: CoreRepository, signalId: string): Effect.Effect<Signal, SignalServiceError>`
  - `export const convertSignal(repository: CoreRepository, input: ConvertSignalInput): Effect.Effect<ConvertedEntityRef, SignalServiceError>`

### Modify: unit tests
- `tests/unit/core/services/entry-service.test.ts`
- `tests/unit/core/services/task-service.test.ts`
- `tests/unit/core/services/signal-service.test.ts`
- `tests/unit/api/workflows/workflow-api.test.ts`

### Modify: integration tests
- `tests/integration/workflow-api-http.integration.test.ts`

## Tests to write (unit + integration)

### Unit tests
- Core error-code emission:
  - `suggestEntryAsTask` missing entry emits `EntryServiceError.code = "not_found"`.
  - `completeTask` missing task emits `TaskTransitionError.code = "not_found"`.
  - `triageSignal` missing signal emits `SignalServiceError.code = "not_found"`.
  - `convertSignal` untriaged precondition emits `SignalServiceError.code = "conflict"`.

- API mapping via `makeWorkflowApi`:
  - `capture.suggest` maps not-found failure to `WorkflowApiError { code: "not_found", statusCode: 404 }`.
  - `planning.completeTask` maps not-found failure to `404`.
  - `signal.triage` maps not-found failure to `404`.
  - `signal.convert` maps conversion precondition failure to `409`.

### Integration tests
- HTTP dispatcher sanitized regression checks:
  - missing entry route (`capture.suggest`) returns `404` with sanitized body only.
  - missing task route (`planning.completeTask`) returns `404` with sanitized body only.
  - missing signal route (`signal.triage`) returns `404` with sanitized body only.
  - signal conversion precondition route (`signal.convert`) returns `409` with sanitized body only.

## Risks and mitigations
1. Risk: tests accidentally hit validation branches (`400`) instead of missing-resource branches.
   Mitigation: provide syntactically valid payloads with non-existent IDs for 404 cases.

2. Risk: signal conflict test returns `404` if signal is not seeded.
   Mitigation: explicitly ingest signal first, skip triage, then call `signal.convert`.

3. Risk: brittle assertions on full message text create false negatives.
   Mitigation: assert stable fields (`status`, `route`, `code`) and only minimal message fragments.

4. Risk: broad code-tagging can unintentionally alter unrelated status behavior.
   Mitigation: limit implementation changes to `loadEntry`, `loadTask`, `loadSignal`, and convert precondition guard only.

## How to verify against acceptance criteria
Acceptance criteria requires:
- sanitized `404` for missing entry/task/signal resources
- sanitized `409` for signal conversion precondition conflicts
- coverage at both `makeWorkflowApi` and HTTP dispatcher levels

Verification checklist:
- Unit tests prove `makeWorkflowApi` route mapping for entry/task/signal (`404/409`) now preserves coded service failures.
- Integration tests prove dispatcher returns sanitized payloads with expected `status` and `route`.
- `bun run test:integration:api` and `bun run typecheck` pass for the changed slice.

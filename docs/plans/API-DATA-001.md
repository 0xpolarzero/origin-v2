# API-DATA-001 Plan: Map Entry/Task/Signal Service Failures to Explicit API Codes (TDD First)

## Overview of the approach
This slice should keep the API error mapping logic centralized in `src/api/workflows/errors.ts` and fix the real source of bad status codes: uncoded service failures in Entry/Task/Signal services.

Scope for this ticket:
- Add structured optional `code` fields to:
  - `EntryServiceError`
  - `TaskTransitionError`
  - `SignalServiceError`
- Tag known domain failures so `toWorkflowApiError(...)` can map them deterministically:
  - missing entity -> `not_found` -> `404`
  - invalid state transition (signal conversion before triage) -> `conflict` -> `409`

Out of scope:
- Broad remapping of all existing uncoded failures to `invalid_request`
- Changes to HTTP response shape

## TDD step order (tests before implementation)

### Phase 1: Add failing tests first (RED)
1. **Unit API mapping test (`errors.ts`)**
   - File: `tests/unit/api/workflows/errors.test.ts`
   - Add test case: `EntryServiceError` with `code: "not_found"` maps to `WorkflowApiError { code: "not_found", statusCode: 404 }`.

2. **Unit API mapping test (`errors.ts`)**
   - File: `tests/unit/api/workflows/errors.test.ts`
   - Add test case: `TaskTransitionError` with `code: "not_found"` maps to `404`.

3. **Unit API mapping test (`errors.ts`)**
   - File: `tests/unit/api/workflows/errors.test.ts`
   - Add test cases: `SignalServiceError` with:
     - `code: "not_found"` -> `404`
     - `code: "conflict"` -> `409`

4. **Unit core service test (Entry not found)**
   - File: `tests/unit/core/services/entry-service.test.ts`
   - Add one route-level test (single function path): `suggestEntryAsTask(...)` missing `entryId` fails with `EntryServiceError` and `code: "not_found"`.

5. **Unit core service test (Task not found)**
   - File: `tests/unit/core/services/task-service.test.ts`
   - Add test: `completeTask(...)` missing `taskId` fails with `TaskTransitionError` and `code: "not_found"`.

6. **Unit core service test (Signal not found)**
   - File: `tests/unit/core/services/signal-service.test.ts`
   - Add test: `triageSignal(...)` missing `signalId` fails with `SignalServiceError` and `code: "not_found"`.

7. **Unit core service test (Signal conflict)**
   - File: `tests/unit/core/services/signal-service.test.ts`
   - Strengthen existing precondition test: `convertSignal(...)` on untriaged signal fails with `SignalServiceError` and `code: "conflict"`.

8. **Unit workflow-api wrapper test (Entry metadata preservation)**
   - File: `tests/unit/api/workflows/workflow-api.test.ts`
   - Add test: `capture.acceptAsTask` preserves `not_found` + `404` from `EntryServiceError`.

9. **Unit workflow-api wrapper test (Task metadata preservation)**
   - File: `tests/unit/api/workflows/workflow-api.test.ts`
   - Add test: `planning.completeTask` preserves `not_found` + `404` from `TaskTransitionError`.

10. **Unit workflow-api wrapper test (Signal metadata preservation)**
    - File: `tests/unit/api/workflows/workflow-api.test.ts`
    - Add test: `signal.convert` preserves `conflict` + `409` from `SignalServiceError`.

11. **HTTP integration test (Entry route status)**
    - File: `tests/integration/workflow-api-http.integration.test.ts`
    - Add test: `capture.acceptAsTask` with missing entry returns sanitized `404` and route key `capture.acceptAsTask`.

12. **HTTP integration test (Task route status)**
    - File: `tests/integration/workflow-api-http.integration.test.ts`
    - Add test: `planning.completeTask` with missing task returns sanitized `404` and route key `planning.completeTask`.

13. **HTTP integration test (Signal not_found route status)**
    - File: `tests/integration/workflow-api-http.integration.test.ts`
    - Add test: `signal.triage` with missing signal returns sanitized `404` and route key `signal.triage`.

14. **HTTP integration test (Signal conflict route status)**
    - File: `tests/integration/workflow-api-http.integration.test.ts`
    - Add test: `signal.convert` on untriaged signal returns sanitized `409` and route key `signal.convert`.

### Phase 2: Implement minimal production changes (GREEN)
15. **Entry error shape**
    - File: `src/core/services/entry-service.ts`
    - Add optional `code` field to `EntryServiceError` type.

16. **Entry not-found tagging**
    - File: `src/core/services/entry-service.ts`
    - In `loadEntry(...)`, set `code: "not_found"` when entity is missing.

17. **Task error shape**
    - File: `src/core/services/task-service.ts`
    - Add optional `code` field to `TaskTransitionError` type.

18. **Task not-found tagging**
    - File: `src/core/services/task-service.ts`
    - In `loadTask(...)`, set `code: "not_found"` when entity is missing.

19. **Signal error shape**
    - File: `src/core/services/signal-service.ts`
    - Add optional `code` field to `SignalServiceError` type.

20. **Signal not-found tagging**
    - File: `src/core/services/signal-service.ts`
    - In `loadSignal(...)`, set `code: "not_found"` when entity is missing.

21. **Signal conflict tagging**
    - File: `src/core/services/signal-service.ts`
    - In `convertSignal(...)`, set `code: "conflict"` when triage precondition fails.

22. **Mapper confirmation (no-op expected)**
    - File: `src/api/workflows/errors.ts`
    - Confirm no mapping logic change is required (already supports `not_found`/`conflict`).

23. **Run full targeted verification**
    - Run unit + integration tests for touched slices, then `typecheck`.

## Files to create/modify (with specific function signatures)

### Create
- `docs/plans/API-DATA-001.md` (this plan file)

### Modify: Implementation
- `src/core/services/entry-service.ts`
  - `export class EntryServiceError extends Data.TaggedError("EntryServiceError")<{ message: string; code?: "not_found"; }>`
  - `const loadEntry(repository: CoreRepository, entryId: string): Effect.Effect<Entry, EntryServiceError>`

- `src/core/services/task-service.ts`
  - `export class TaskTransitionError extends Data.TaggedError("TaskTransitionError")<{ message: string; code?: "not_found"; }>`
  - `const loadTask(repository: CoreRepository, taskId: string): Effect.Effect<Task, TaskTransitionError>`

- `src/core/services/signal-service.ts`
  - `export class SignalServiceError extends Data.TaggedError("SignalServiceError")<{ message: string; code?: "not_found" | "conflict"; }>`
  - `const loadSignal(repository: CoreRepository, signalId: string): Effect.Effect<Signal, SignalServiceError>`
  - `export const convertSignal(repository: CoreRepository, input: ConvertSignalInput): Effect.Effect<ConvertedEntityRef, SignalServiceError>`

- `src/api/workflows/errors.ts`
  - `export const toWorkflowApiError(route: WorkflowRouteKey, error: unknown): WorkflowApiError`
  - Expected outcome: no functional change required.

### Modify: Tests
- `tests/unit/api/workflows/errors.test.ts`
- `tests/unit/api/workflows/workflow-api.test.ts`
- `tests/unit/core/services/entry-service.test.ts`
- `tests/unit/core/services/task-service.test.ts`
- `tests/unit/core/services/signal-service.test.ts`
- `tests/integration/workflow-api-http.integration.test.ts`

## Tests to write (unit + integration)

### Unit tests
- `toWorkflowApiError` mapping coverage additions:
  - `EntryServiceError.code=not_found -> 404`
  - `TaskTransitionError.code=not_found -> 404`
  - `SignalServiceError.code=not_found -> 404`
  - `SignalServiceError.code=conflict -> 409`

- Core service error metadata coverage:
  - `suggestEntryAsTask(...)` missing entry returns `EntryServiceError` with `code: "not_found"`
  - `completeTask(...)` missing task returns `TaskTransitionError` with `code: "not_found"`
  - `triageSignal(...)` missing signal returns `SignalServiceError` with `code: "not_found"`
  - `convertSignal(...)` untriaged signal returns `SignalServiceError` with `code: "conflict"`

- Workflow API wrapper propagation coverage:
  - `capture.acceptAsTask` preserves service `code/statusCode`
  - `planning.completeTask` preserves service `code/statusCode`
  - `signal.convert` preserves service `code/statusCode`

### Integration tests
- HTTP status propagation and sanitization for new service-code paths:
  - `capture.acceptAsTask` missing entry -> `404`
  - `planning.completeTask` missing task -> `404`
  - `signal.triage` missing signal -> `404`
  - `signal.convert` untriaged signal -> `409`

## Risks and mitigations
1. **Risk:** Some failing paths remain uncoded and still map to `unknown` (`400`), causing partial behavior change.
   **Mitigation:** Keep assertions focused on explicitly scoped failure paths only (`load*` not found + signal conversion precondition).

2. **Risk:** Tests become brittle if they assert exact full error payloads including message wording.
   **Mitigation:** Assert stable fields (`route`, `code`, `statusCode`) and minimal message fragments when needed.

3. **Risk:** Integration conflict scenario can accidentally become `404` if setup does not persist an untriaged signal first.
   **Mitigation:** Explicitly seed `signal.ingest` without triage before `signal.convert` call in integration test.

4. **Risk:** Type drift between service error unions and tests.
   **Mitigation:** Keep union values minimal and aligned with current mapper (`not_found`, `conflict`), avoiding speculative codes.

## How to verify against acceptance criteria
Acceptance criteria: explicit service codes for Entry/Task/Signal failures must allow `toWorkflowApiError` to emit `404/409` instead of `400 unknown`.

Verification sequence:
- Unit mapping and service tests:
  - `bun test tests/unit/api/workflows/errors.test.ts`
  - `bun test tests/unit/api/workflows/workflow-api.test.ts`
  - `bun test tests/unit/core/services/entry-service.test.ts`
  - `bun test tests/unit/core/services/task-service.test.ts`
  - `bun test tests/unit/core/services/signal-service.test.ts`

- Integration regression:
  - `bun test tests/integration/workflow-api-http.integration.test.ts`
  - `bun run test:integration:api`

- Type safety:
  - `bun run typecheck`

Done criteria:
- Entry/Task missing-resource flows produce `WorkflowApiError.code=not_found` with `statusCode=404`.
- Signal missing-resource flow produces `not_found/404`.
- Signal precondition flow (`convert` before triage) produces `conflict/409`.
- HTTP dispatcher returns sanitized payloads with matching route keys and statuses.

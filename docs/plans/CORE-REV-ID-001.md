# CORE-REV-ID-001 Plan: Implement runtime pi-mono integration for AI workflows (TDD First)

## Overview of the approach
Add a small core AI runtime boundary that wraps concrete `@mariozechner/pi-ai` calls, then thread it into two workflow paths:

1. `capture.suggest` (AI-generated task title when caller omits `suggestedTitle`)
2. `job.retry` automation (AI-generated `fixSummary` when caller omits it)

The plan keeps side effects at the boundary, keeps core behavior deterministic via explicit runtime options, maps runtime failures into existing API error semantics, and records AI trace metadata in audit transitions.

## TDD step order (tests before implementation)

### Phase 1: RED (write failing tests first)
1. Add unit test: `tests/unit/core/services/ai/pi-ai-runtime.test.ts`
   - `test("suggestTaskTitleFromEntry calls pi-ai complete with deterministic options", ...)`

2. Add unit test: `tests/unit/core/services/ai/pi-ai-runtime.test.ts`
   - `test("suggestTaskTitleFromEntry maps pi-ai runtime failure into AiRuntimeError", ...)`

3. Add unit test: `tests/unit/core/services/ai/pi-ai-runtime.test.ts`
   - `test("suggestRetryFixSummary returns normalized trace metadata (provider/model/usage/stopReason)", ...)`

4. Add unit test: `tests/unit/core/services/entry-service.test.ts`
   - `test("suggestEntryAsTask generates suggestedTitle via ai runtime when payload title is omitted", ...)`

5. Add unit test: `tests/unit/core/services/entry-service.test.ts`
   - `test("suggestEntryAsTask maps ai runtime errors deterministically and writes no entry/audit mutation", ...)`

6. Add unit test: `tests/unit/core/services/job-service.test.ts`
   - `test("retryJobRun generates fixSummary via ai runtime when fixSummary is omitted", ...)`

7. Add unit test: `tests/unit/core/services/job-service.test.ts`
   - `test("retryJobRun maps ai runtime failure and keeps job state + audit history unchanged", ...)`

8. Add unit test: `tests/unit/api/workflows/routes.test.ts`
   - `test("capture.suggest validator accepts omitted suggestedTitle and still requires entryId+actor", ...)`

9. Add unit test: `tests/unit/api/workflows/errors.test.ts`
   - `test("toWorkflowApiError maps ai runtime invalid_request and unknown codes to stable API metadata", ...)`

10. Add integration test: `tests/integration/workflow-api.integration.test.ts`
    - `test("capture.suggest without suggestedTitle calls ai runtime and persists suggested state + ai trace", ...)`

11. Add integration test: `tests/integration/workflow-automation.integration.test.ts`
    - `test("job.retry without fixSummary calls ai runtime and persists retry audit metadata", ...)`

12. Add integration test: `tests/integration/workflow-api-http.integration.test.ts`
    - `test("capture.suggest ai runtime failures return sanitized mapped workflow errors", ...)`

13. Add integration test: `tests/integration/database-core-platform.integration.test.ts`
    - `test("sqlite-backed audit trail preserves ai trace metadata for capture.suggest and job.retry", ...)`

### Phase 2: GREEN (minimal implementation after RED)
14. Create `src/core/services/ai/ai-runtime.ts`
    - Add AI boundary types/errors:
      - `export interface AiTraceMetadata { provider: string; model: string; stopReason?: string; promptTokens?: number; completionTokens?: number; totalTokens?: number; costUsd?: number }`
      - `export class AiRuntimeError extends Data.TaggedError("AiRuntimeError")<{ message: string; code: "invalid_request" | "unknown"; target: "capture.suggest" | "job.retry"; cause?: unknown }>`
      - `export interface WorkflowAiRuntime { suggestTaskTitleFromEntry: (...) => Effect.Effect<{ text: string; trace: AiTraceMetadata }, AiRuntimeError>; suggestRetryFixSummary: (...) => Effect.Effect<{ text: string; trace: AiTraceMetadata }, AiRuntimeError> }`

15. Create `src/core/services/ai/pi-ai-runtime.ts`
    - Add concrete `@mariozechner/pi-ai` callsites (`getModel`, `complete`) with deterministic defaults.
    - Add helpers:
      - `const makeDeterministicOptions = (...) => ...`
      - `const toAiTraceMetadata = (...) => AiTraceMetadata`
    - Export:
      - `export const makePiAiRuntime = (options?: MakePiAiRuntimeOptions): WorkflowAiRuntime`

16. Modify `src/core/services/entry-service.ts`
    - Update input:
      - `export interface SuggestEntryAsTaskInput { entryId: string; suggestedTitle?: string; actor: ActorRef; at?: Date }`
    - Update function signature:
      - `export const suggestEntryAsTask = (repository: CoreRepository, input: SuggestEntryAsTaskInput, aiRuntime?: WorkflowAiRuntime): Effect.Effect<Entry, EntryServiceError>`
    - Add helper:
      - `const resolveSuggestedTitle = (...) => Effect.Effect<{ suggestedTitle: string; trace?: AiTraceMetadata }, EntryServiceError>`
    - Persist audit metadata including generated title and AI trace fields when runtime path is used.

17. Modify `src/core/services/job-service.ts`
    - Update signature:
      - `export const retryJobRun = (repository: CoreRepository, jobId: string, actor: ActorRef, at?: Date, fixSummary?: string, aiRuntime?: WorkflowAiRuntime): Effect.Effect<Job, JobServiceError>`
    - Add helper:
      - `const resolveRetryFixSummary = (...) => Effect.Effect<{ fixSummary?: string; trace?: AiTraceMetadata }, JobServiceError>`
    - Persist retry transition metadata with `fixSummary` + AI trace when runtime path is used.

18. Modify `src/core/app/core-platform.ts`
    - Extend options:
      - `export interface BuildCorePlatformOptions { ...; aiRuntime?: WorkflowAiRuntime }`
    - Wire default runtime:
      - `const aiRuntime = options.aiRuntime ?? makePiAiRuntime()`
    - Thread runtime into:
      - `suggestEntryAsTask(repository, input, aiRuntime)`
      - `retryJobRun(repository, jobId, actor, at, fixSummary, aiRuntime)`

19. Modify API request validation and contract docs
    - `src/api/workflows/routes.ts`
      - `validateSuggestEntryAsTaskRequest` makes `suggestedTitle` optional/non-empty when provided.
    - `docs/contracts/workflow-api-schema-contract.md`
      - `capture.suggest` request matrix updated to `suggestedTitle` optional (runtime-generated fallback).

20. Modify API error mapping only if RED requires it
    - `src/api/workflows/errors.ts`
      - Ensure AI runtime service errors map to stable `validation`/`unknown` + `400` without leaking provider internals.

### Phase 3: VERIFY
21. Run focused unit tests:
   - `bun test tests/unit/core/services/ai/pi-ai-runtime.test.ts`
   - `bun test tests/unit/core/services/entry-service.test.ts`
   - `bun test tests/unit/core/services/job-service.test.ts`
   - `bun test tests/unit/api/workflows/routes.test.ts`
   - `bun test tests/unit/api/workflows/errors.test.ts`

22. Run focused integration tests:
   - `bun test tests/integration/workflow-api.integration.test.ts`
   - `bun test tests/integration/workflow-api-http.integration.test.ts`
   - `bun test tests/integration/workflow-automation.integration.test.ts`
   - `bun test tests/integration/database-core-platform.integration.test.ts`

23. Run changed-slice gate:
   - `bun run typecheck`

## Files to create/modify (with specific function signatures)

### Create
- `src/core/services/ai/ai-runtime.ts`
  - `export class AiRuntimeError extends Data.TaggedError("AiRuntimeError")<...> {}`
  - `export interface WorkflowAiRuntime { suggestTaskTitleFromEntry: ...; suggestRetryFixSummary: ... }`

- `src/core/services/ai/pi-ai-runtime.ts`
  - `export interface MakePiAiRuntimeOptions { modelId?: string; temperature?: number; maxTokens?: number }`
  - `export const makePiAiRuntime = (options?: MakePiAiRuntimeOptions): WorkflowAiRuntime`

- `tests/unit/core/services/ai/pi-ai-runtime.test.ts`
  - Deterministic option, error mapping, and trace normalization tests.

- `docs/plans/CORE-REV-ID-001.md`

### Modify
- `src/core/services/entry-service.ts`
  - `suggestEntryAsTask(repository, input, aiRuntime?)`
  - `resolveSuggestedTitle(...)`

- `src/core/services/job-service.ts`
  - `retryJobRun(repository, jobId, actor, at?, fixSummary?, aiRuntime?)`
  - `resolveRetryFixSummary(...)`

- `src/core/app/core-platform.ts`
  - `BuildCorePlatformOptions.aiRuntime?`
  - runtime wiring for suggestion/retry paths

- `src/api/workflows/routes.ts`
  - `validateSuggestEntryAsTaskRequest(...)`

- `src/api/workflows/errors.ts` (conditional)
  - `toCode(...)` / `toWorkflowApiError(...)` adjustments if AI-specific code handling is required by RED

- `docs/contracts/workflow-api-schema-contract.md`
  - `capture.suggest` request schema row

- `tests/unit/core/services/entry-service.test.ts`
- `tests/unit/core/services/job-service.test.ts`
- `tests/unit/api/workflows/routes.test.ts`
- `tests/unit/api/workflows/errors.test.ts`
- `tests/integration/workflow-api.integration.test.ts`
- `tests/integration/workflow-api-http.integration.test.ts`
- `tests/integration/workflow-automation.integration.test.ts`
- `tests/integration/database-core-platform.integration.test.ts`

## Tests to write (unit + integration)

### Unit tests
- `pi-ai-runtime` deterministic completion options are pinned (temperature/max tokens/model selection).
- `pi-ai-runtime` errors map to `AiRuntimeError` with stable `code` and no raw provider object leaks.
- `pi-ai-runtime` trace metadata extraction is deterministic and normalized.
- `entry-service` AI fallback path generates `suggestedTaskTitle` when omitted and appends AI trace metadata in audit.
- `entry-service` AI failure path is side-effect free (no new entry transition persisted).
- `job-service` retry AI fallback path generates `fixSummary` and appends AI trace metadata.
- `job-service` retry AI failure path is side-effect free (no state transition/history mutation).
- `routes` accepts optional `suggestedTitle` in `capture.suggest`, but rejects empty-string if present.
- `errors` maps AI-runtime-originating failures to stable API error semantics.

### Integration tests
- `workflow-api` validates runtime AI title generation in `capture.suggest`.
- `workflow-automation` validates runtime AI fix-summary generation in `job.retry`.
- `workflow-api-http` validates sanitized mapped error body on runtime AI failure (`{ error, route, message }` only).
- `database-core-platform` validates AI trace metadata persistence in sqlite-backed audit transitions.

## Risks and mitigations
1. Risk: nondeterministic model output causes flaky tests.
   Mitigation: enforce deterministic runtime options and test against stubbed runtime boundary, not live providers.

2. Risk: changing `capture.suggest` request shape breaks clients/contracts.
   Mitigation: keep backward compatibility (`suggestedTitle` still accepted), update contract docs, and add route validation tests.

3. Risk: AI runtime errors leak provider internals in API responses.
   Mitigation: map errors to existing workflow codes and assert sanitized HTTP response shape in unit/integration tests.

4. Risk: audit metadata drift between in-memory and sqlite repositories.
   Mitigation: add sqlite integration assertion for trace metadata persistence and retrieval.

5. Risk: retry automation unexpectedly incurs runtime cost even when explicit fix exists.
   Mitigation: call AI runtime only when `fixSummary` is omitted; add explicit bypass unit test.

## How to verify against acceptance criteria
1. **Concrete pi-mono runtime callsites in AI suggestion/automation paths**
   - Confirm `src/core/services/ai/pi-ai-runtime.ts` uses `@mariozechner/pi-ai`.
   - Confirm capture and retry paths are wired through `buildCorePlatform`.

2. **Deterministic handling**
   - Unit tests enforce deterministic runtime options and side-effect-free failure behavior.

3. **Error mapping**
   - Unit + HTTP integration tests assert stable mapped codes/statuses and sanitized response bodies.

4. **Audit traces**
   - Unit + sqlite integration tests assert audit metadata includes AI trace fields for generated suggestion/fix flows.

5. **Regression gate**
   - Run targeted tests and `bun run typecheck` from Phase 3.

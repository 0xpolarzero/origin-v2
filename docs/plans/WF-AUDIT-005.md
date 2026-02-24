# WF-AUDIT-005 Plan: Create Workflow Automation Edge-Case Test Suite (TDD First)

## Overview of the approach
This ticket is a coverage-hardening slice focused on workflow automation failure modes. The plan is to add missing edge-case tests at the core/domain level first, then add workflow integration tests in the `test:integration:workflow` slice so required failures are verified by the workflow gate itself.

The highest-risk gap is conflict/retry semantics for repeated retries on the same job state. The plan intentionally writes that failing test first, then tightens `retryJobRun(...)` behavior only if red tests confirm the gap.

## TDD step order (tests before implementation)
1. **Test:** `tests/unit/core/domain/entry.test.ts` adds `createEntry` empty-content rejection (`"content is required"`).
   **Implement:** no production change expected; keep `src/core/domain/entry.ts` as-is unless failure exposes a regression in `validateNonEmpty(...)` wiring.

2. **Test:** `tests/unit/core/domain/signal.test.ts` adds `createSignal` empty-source rejection (`"source is required"`).
   **Implement:** no production change expected in `src/core/domain/signal.ts`.

3. **Test:** `tests/unit/core/domain/signal.test.ts` adds `createSignal` empty-payload rejection (`"payload is required"`).
   **Implement:** no production change expected in `src/core/domain/signal.ts`.

4. **Test:** `tests/unit/core/services/entry-service.test.ts` adds `captureEntry` whitespace-only content failure and asserts no `entry` entity/audit transition is persisted.
   **Implement:** if needed, tighten `captureEntry(...)` error mapping in `src/core/services/entry-service.ts` so domain validation errors stay deterministic and side-effect free.

5. **Test:** `tests/unit/core/services/approval-service.test.ts` adds explicit denial regression (`approved: false`) for both `event_sync` and `outbound_draft` paths, asserting state remains `pending_approval` and outbound execution count stays `0`.
   **Implement:** if needed, ensure `approveOutboundAction(...)` in `src/core/services/approval-service.ts` returns before any persistence/execution when `approved` is `false`.

6. **Test:** `tests/unit/core/services/approval-service.test.ts` adds actor-auth regression for `outbound_draft` approvals (non-user actor), asserting `code: "forbidden"`, unchanged draft status, and no outbound execute call.
   **Implement:** if needed, route all approval paths through `assertApprovalActorAuthorized(...)` before state mutation.

7. **Test:** `tests/unit/core/services/job-service.test.ts` adds repeated-retry conflict case: retrying a job already in `runState: "retrying"` must fail with `JobServiceError { code: "conflict" }` and append no extra retry transition.
   **Implement:** add retry eligibility guard in `src/core/services/job-service.ts`:
   - `const ensureRetryable = (job: Job): Effect.Effect<void, JobServiceError>`
   - enforce `retryJobRun(...)` only from retry-eligible states.

8. **Test:** `tests/unit/core/services/job-service.test.ts` adds non-failed retry guard case (for example `runState: "idle"`), asserting deterministic conflict/invalid-request semantics.
   **Implement:** finalize `ensureRetryable(...)` code path and error code/message mapping in `retryJobRun(...)`.

9. **Integration Test:** create `tests/integration/workflow-automation-edge-cases.integration.test.ts` with HTTP-dispatch integration for empty capture/signal payloads, asserting sanitized `400` responses.
   **Implement:** if needed, adjust route validation/coercion in `src/api/workflows/routes.ts` and error mapping in `src/api/workflows/http-dispatch.ts` to preserve sanitized payloads.

10. **Integration Test:** `tests/integration/workflow-automation-edge-cases.integration.test.ts` adds approval denial and auth-failure flows (`approval.approveOutboundAction`) with assertions for status codes (`400/403`) and no execution side effects.
    **Implement:** if needed, align `src/api/workflows/errors.ts` status/code mapping for `invalid_request` and `forbidden` service errors.

11. **Integration Test:** `tests/integration/workflow-automation-edge-cases.integration.test.ts` adds repeated `job.retry` conflict flow and verifies retry count/history remain stable after rejected duplicate retry.
    **Implement:** if needed, wire new `JobServiceError` retry guard semantics through `src/api/workflows/workflow-api.ts` + `src/api/workflows/errors.ts`.

12. **Integration Test:** `tests/integration/workflow-automation-edge-cases.integration.test.ts` adds recovery correctness after adjacent workflow failure (denied approval or retry conflict) and verifies checkpoint/entity/audit consistency.
    **Implement:** if needed, tighten transactional boundaries in `src/core/services/checkpoint-service.ts` and/or `src/core/services/approval-service.ts`.

13. **Test wiring:** update `package.json` `test:integration:workflow` to include `tests/integration/workflow-automation-edge-cases.integration.test.ts`.
    **Implement:** ensure workflow-gate script runs the new suite in CI/local verification.

## Files to create/modify (with specific function signatures)

### Create
- `tests/integration/workflow-automation-edge-cases.integration.test.ts`
  - `const expectSanitizedError = (response: { status: number; body: unknown }, expected: { status: number; route: WorkflowRouteKey; messageIncludes?: string }) => void`
  - `const expectOk = async (dispatch: ReturnType<typeof makeWorkflowHttpDispatcher>, route: WorkflowRouteKey, body: unknown): Promise<unknown>`

### Modify
- `tests/unit/core/domain/entry.test.ts`
  - add empty-content negative test for `createEntry(input: CreateEntryInput): Effect.Effect<Entry, DomainValidationError>`

- `tests/unit/core/domain/signal.test.ts`
  - add empty-source and empty-payload negative tests for `createSignal(input: CreateSignalInput): Effect.Effect<Signal, DomainValidationError>`

- `tests/unit/core/services/entry-service.test.ts`
  - add side-effect-free failure test for `captureEntry(repository: CoreRepository, input: CaptureEntryInput): Effect.Effect<Entry, EntryServiceError>`

- `tests/unit/core/services/approval-service.test.ts`
  - add denial/auth edge tests for:
    - `approveOutboundAction(repository: CoreRepository, outboundActionPort: OutboundActionPort, input: ApproveOutboundActionInput): Effect.Effect<ApprovalResult, ApprovalServiceError>`
    - `assertApprovalActorAuthorized(actor: ActorRef): Effect.Effect<void, ApprovalServiceError>`

- `tests/unit/core/services/job-service.test.ts`
  - add retry-conflict tests for:
    - `retryJobRun(repository: CoreRepository, jobId: string, actor: ActorRef, at?: Date, fixSummary?: string): Effect.Effect<Job, JobServiceError>`

- `tests/integration/workflow-automation.integration.test.ts`
  - keep existing happy-path/recovery tests; optionally move duplicated edge helpers to new suite

- `src/core/services/job-service.ts` (only if red tests fail)
  - add `const ensureRetryable = (job: Job): Effect.Effect<void, JobServiceError>`
  - update `retryJobRun(...)` to reject non-retryable states with stable `code` + message

- `src/core/services/approval-service.ts` (only if red tests fail)
  - keep early-return denial/auth checks side-effect free across both action types

- `src/api/workflows/errors.ts` (only if red tests fail)
  - ensure service error codes map to expected HTTP statuses for edge-path assertions

- `src/api/workflows/routes.ts` (only if red tests fail)
  - preserve non-empty string validation/coercion for empty-input integration cases

- `package.json`
  - `"test:integration:workflow"` includes new edge-case integration file

## Tests to write (unit + integration)

### Unit tests
- `tests/unit/core/domain/entry.test.ts`
  - rejects whitespace-only entry content

- `tests/unit/core/domain/signal.test.ts`
  - rejects whitespace-only source
  - rejects whitespace-only payload

- `tests/unit/core/services/entry-service.test.ts`
  - capture failure for empty content does not persist entity or audit

- `tests/unit/core/services/approval-service.test.ts`
  - denial (`approved: false`) is deterministic and side-effect free
  - non-user approver returns forbidden and no execution/state mutation

- `tests/unit/core/services/job-service.test.ts`
  - duplicate retry request conflicts while already retrying
  - retry from non-failed state is rejected deterministically

### Integration tests
- `tests/integration/workflow-automation-edge-cases.integration.test.ts`
  - empty input HTTP workflow route failures are sanitized (`400`)
  - approval denial/auth failures are sanitized (`400/403`) and side-effect free
  - conflict/retry behavior rejects duplicate retries and keeps history stable
  - checkpoint recovery remains correct after adjacent workflow failures

- `tests/integration/workflow-automation.integration.test.ts`
  - keep existing happy-path and failure-consistency regression coverage

## Risks and mitigations
1. **Risk:** Tightening retry semantics may break current callers that assume repeated retry is always allowed.
   **Mitigation:** codify expected behavior first in unit + integration tests, then update `retryJobRun(...)` with explicit conflict messaging.

2. **Risk:** Edge-case coverage can drift across scripts (`test:integration:workflow` vs `test:integration:api`).
   **Mitigation:** place new edge-case suite directly in workflow integration script and keep route-level assertions local to that suite.

3. **Risk:** Error assertions become brittle if they depend on full message text.
   **Mitigation:** assert stable fields (`status`, `route`, error `code` where available) and use `messageIncludes` for minimal substring checks.

4. **Risk:** Side-effect assertions can miss hidden writes if setup is incomplete.
   **Mitigation:** assert repository state using entity + audit queries before and after each failure path.

## How to verify against acceptance criteria
1. **Empty inputs covered**
   - `bun test tests/unit/core/domain/entry.test.ts`
   - `bun test tests/unit/core/domain/signal.test.ts`
   - `bun test tests/unit/core/services/entry-service.test.ts`
   - `bun test tests/integration/workflow-automation-edge-cases.integration.test.ts`

2. **Approval denial/auth failures covered**
   - `bun test tests/unit/core/services/approval-service.test.ts`
   - `bun test tests/integration/workflow-automation-edge-cases.integration.test.ts`

3. **Conflict/retry behavior covered**
   - `bun test tests/unit/core/services/job-service.test.ts`
   - `bun test tests/integration/workflow-automation-edge-cases.integration.test.ts`

4. **Recovery correctness covered**
   - `bun test tests/unit/core/services/checkpoint-service.test.ts`
   - `bun test tests/integration/workflow-automation.integration.test.ts`
   - `bun test tests/integration/workflow-automation-edge-cases.integration.test.ts`

5. **Workflow slice gate + type safety**
   - `bun run test:integration:workflow`
   - `bun run test:integration:api`
   - `bun run typecheck`

# CORE-REV-006 Plan: Baseline Core Tests for Correctness Edge Cases (TDD First)

## Overview of the approach
Add missing baseline coverage for the review-scope gaps in this order:
1. Core/domain and service edge cases first (empty inputs, auth failures, conflict semantics, rejection behavior).
2. API normalization next (map core failures into structured `WorkflowApiError` metadata).
3. HTTP and integration assertions last (400/403/409 behavior and end-to-end approval/rejection regressions).

This keeps implementation low-prescription while making failures explicit enough for deterministic API+HTTP assertions.

## TDD step order (tests before implementation)

1. **Test:** `tests/unit/api/workflows/routes.test.ts` -> `approval.approveOutboundAction` rejects whitespace-only `entityId`.
   **Implement:** `src/api/workflows/routes.ts` -> add `parseNonEmptyStringField(route, source, field, optional?)` and use it in `validateApproveOutboundActionRequest`.

2. **Test:** `tests/unit/api/workflows/routes.test.ts` -> route validation rejects whitespace-only `actor.id` for approval routes.
   **Implement:** `src/api/workflows/routes.ts` -> update `parseActorField(...)` to require non-empty `id`.

3. **Test:** `tests/unit/api/workflows/routes.test.ts` -> `approval.requestEventSync` and `approval.requestOutboundDraftExecution` reject blank `eventId` / `draftId`.
   **Implement:** `src/api/workflows/routes.ts` -> switch those validators to non-empty parsing.

4. **Test:** `tests/unit/core/services/approval-service.test.ts` -> `approveOutboundAction` rejects non-user approvers and never calls `outboundActionPort.execute`.
   **Implement:** `src/core/services/approval-service.ts` -> add `assertApprovalActorAuthorized(actor: ActorRef)` guard; extend `ApprovalServiceError` with `code: "forbidden"` for this path.

5. **Test:** `tests/unit/core/services/event-service.test.ts` -> second `requestEventSync` on an already `pending_approval`/`synced` event fails as conflict.
   **Implement:** `src/core/services/event-service.ts` -> add sync-state precondition (`local_only` only) and emit `EventServiceError` with `code: "conflict"`.

6. **Test:** `tests/unit/core/services/outbound-draft-service.test.ts` -> `requestOutboundDraftExecution` non-`draft` states are classified as conflict.
   **Implement:** `src/core/services/outbound-draft-service.ts` -> tag existing invalid-status error with `code: "conflict"`.

7. **Test:** `tests/unit/core/services/approval-service.test.ts` -> duplicate approval attempt (`event` already `synced` or `outbound_draft` already `executed`) returns conflict and does not re-execute side effects.
   **Implement:** `src/core/services/approval-service.ts` -> classify non-`pending_approval` precondition failures as `code: "conflict"`.

8. **Test:** `tests/unit/api/workflows/errors.test.ts` -> `toWorkflowApiError` maps forbidden/conflict service errors to structured workflow errors with status metadata.
   **Implement:** `src/api/workflows/errors.ts` -> extend `WorkflowApiError` with `code` + `statusCode`; add mapping logic in `toWorkflowApiError(route, error)`.

9. **Test:** `tests/unit/api/workflows/workflow-api.test.ts` -> wrapper preserves mapped `WorkflowApiError` metadata from core errors (`route`, `code`, `statusCode`).
   **Implement:** `src/api/workflows/workflow-api.ts` -> keep `wrapHandler` behavior but ensure new metadata survives both thrown and failed paths.

10. **Test:** `tests/unit/api/workflows/http-dispatch.test.ts` -> dispatcher returns `403` for forbidden errors and `409` for conflict errors.
    **Implement:** `src/api/workflows/http-dispatch.ts` -> add `toHttpStatus(error: WorkflowApiError)` mapping (fallback stays `400`).

11. **Test:** `tests/integration/workflow-api.integration.test.ts` -> rejection keeps entity in `pending_approval` and leaves execution count unchanged (event + outbound draft flows).
    **Implement:** `src/core/services/approval-service.ts` -> adjust only if test reveals unintended writes during reject path.

12. **Test:** `tests/integration/workflow-api.integration.test.ts` -> after one successful approval, a second approval attempt fails with conflict and no second execution.
    **Implement:** `src/core/services/approval-service.ts` -> ensure duplicate-approval guard remains before execution call.

13. **Test:** `tests/integration/workflow-api-http.integration.test.ts` -> HTTP approval endpoints return `400` (empty IDs), `403` (unauthorized actor), and `409` (duplicate/conflict) with sanitized body shape.
    **Implement:** `src/api/workflows/routes.ts`, `src/api/workflows/errors.ts`, `src/api/workflows/http-dispatch.ts` -> complete end-to-end status plumbing.

14. **Test:** `tests/integration/api-data.integration.test.ts` -> conflict regression: repeated `requestEventSync` and repeated `requestOutboundDraftExecution` do not create duplicate pending transitions.
    **Implement:** `src/core/services/event-service.ts`, `src/core/services/outbound-draft-service.ts` -> refine guard logic only if duplicate transitions are observed.

## Files to create/modify (with specific function signatures)

### Modify
- `src/api/workflows/routes.ts`
  - `function parseNonEmptyStringField(route: WorkflowRouteKey, source: Record<string, unknown>, field: string): RouteValidation<string>`
  - `function parseNonEmptyStringField(route: WorkflowRouteKey, source: Record<string, unknown>, field: string, optional: true): RouteValidation<string | undefined>`
  - Update `parseActorField(...)`, `validateRequestEventSyncRequest(...)`, `validateRequestOutboundDraftExecutionRequest(...)`, `validateApproveOutboundActionRequest(...)`.

- `src/core/services/approval-service.ts`
  - `export class ApprovalServiceError extends Data.TaggedError("ApprovalServiceError")<{ message: string; code?: "forbidden" | "conflict" | "not_found" | "invalid_request" }>`
  - `const assertApprovalActorAuthorized(actor: ActorRef): Effect.Effect<void, ApprovalServiceError>`
  - `export const approveOutboundAction(repository: CoreRepository, outboundActionPort: OutboundActionPort, input: ApproveOutboundActionInput): Effect.Effect<ApprovalResult, ApprovalServiceError>`

- `src/core/services/event-service.ts`
  - `export class EventServiceError extends Data.TaggedError("EventServiceError")<{ message: string; code?: "conflict" | "not_found" | "invalid_request" }>`
  - `export const requestEventSync(repository: CoreRepository, eventId: string, actor: ActorRef, at?: Date): Effect.Effect<{ event: Event; notification: Notification }, EventServiceError>`

- `src/core/services/outbound-draft-service.ts`
  - `export class OutboundDraftServiceError extends Data.TaggedError("OutboundDraftServiceError")<{ message: string; code?: "conflict" | "not_found" | "invalid_request" }>`
  - `export const requestOutboundDraftExecution(repository: CoreRepository, draftId: string, actor: ActorRef, at?: Date): Effect.Effect<{ draft: OutboundDraft; notification: Notification }, OutboundDraftServiceError>`

- `src/api/workflows/errors.ts`
  - `export type WorkflowApiErrorCode = "validation" | "forbidden" | "conflict" | "not_found" | "unknown"`
  - `export class WorkflowApiError extends Data.TaggedError("WorkflowApiError")<{ route: WorkflowRouteKey; message: string; code: WorkflowApiErrorCode; statusCode: number; cause?: unknown }>`
  - `export const toWorkflowApiError(route: WorkflowRouteKey, error: unknown): WorkflowApiError`

- `src/api/workflows/http-dispatch.ts`
  - `const toHttpStatus(error: WorkflowApiError): number`
  - `export const makeWorkflowHttpDispatcher(routes: ReadonlyArray<WorkflowRouteDefinition>): (request: WorkflowHttpRequest) => Effect.Effect<WorkflowHttpResponse, never>`

- `src/api/workflows/workflow-api.ts`
  - `export const wrapHandler = <Input, Output>(route: WorkflowRouteKey, handler: (input: Input) => Effect.Effect<Output, unknown>) => (input: Input) => Effect.Effect<Output, WorkflowApiError>`
  - keep wrapper behavior, assert metadata propagation.

### Tests to modify
- `tests/unit/api/workflows/routes.test.ts`
- `tests/unit/core/services/approval-service.test.ts`
- `tests/unit/core/services/event-service.test.ts`
- `tests/unit/core/services/outbound-draft-service.test.ts`
- `tests/unit/api/workflows/errors.test.ts`
- `tests/unit/api/workflows/workflow-api.test.ts`
- `tests/unit/api/workflows/http-dispatch.test.ts`
- `tests/integration/workflow-api.integration.test.ts`
- `tests/integration/workflow-api-http.integration.test.ts`
- `tests/integration/api-data.integration.test.ts`

## Tests to write (unit + integration)

### Unit tests
- `routes.test.ts`
  - whitespace-only IDs are invalid for approval-related routes.
  - whitespace-only `actor.id` is invalid.
- `approval-service.test.ts`
  - forbidden approver (`actor.kind !== "user"`) fails with `code: "forbidden"`.
  - duplicate approval attempts fail with `code: "conflict"` and `execute` call count remains stable.
  - rejection path confirms no transition to executed states.
- `event-service.test.ts`
  - requesting sync when already pending/synced is conflict (`code: "conflict"`).
- `outbound-draft-service.test.ts`
  - requesting execution for non-draft statuses is conflict (`code: "conflict"`).
- `errors.test.ts`
  - maps forbidden/conflict/not-found errors to deterministic `WorkflowApiError.code` + `statusCode`.
- `workflow-api.test.ts`
  - wrapper preserves `WorkflowApiError` metadata across fail/throw/defect paths.
- `http-dispatch.test.ts`
  - HTTP status mapping: validation=400, forbidden=403, conflict=409.

### Integration tests
- `workflow-api.integration.test.ts`
  - event/outbound rejection leaves pending state unchanged and execute count unchanged.
  - second approval attempt after success returns conflict and no second side effect.
- `workflow-api-http.integration.test.ts`
  - approval routes return 400 (empty), 403 (forbidden), 409 (conflict) with sanitized response body.
- `api-data.integration.test.ts`
  - repeated approval-request operations do not generate duplicate pending transitions/notifications.

## Risks and mitigations

1. **Risk:** Auth semantics are not fully specified (who can approve).
   **Mitigation:** Start with the minimal explicit rule (`approveOutboundAction` requires human user actor); document as baseline and keep extension points in error-code mapping.

2. **Risk:** Existing tests assert only message strings and may become brittle with metadata changes.
   **Mitigation:** Assert on structured fields (`code`, `statusCode`, `route`) first; keep message checks narrow.

3. **Risk:** Conflict classification could be inconsistent across services.
   **Mitigation:** Use one conflict rule: invalid transition from current lifecycle state -> `code: "conflict"`.

4. **Risk:** API status mapping regression can unintentionally change existing clients.
   **Mitigation:** Preserve current fallback (`400`) for unclassified errors; only classify explicit forbidden/conflict/not-found paths.

5. **Risk:** Integration tests could become flaky due to ordering/timestamps.
   **Mitigation:** Use fixed IDs/timestamps and assert deterministic audit transitions.

## How to verify against acceptance criteria

1. Run targeted unit slice while implementing:
   - `bun test tests/unit/core/services/approval-service.test.ts`
   - `bun test tests/unit/core/services/event-service.test.ts`
   - `bun test tests/unit/core/services/outbound-draft-service.test.ts`
   - `bun test tests/unit/api/workflows/routes.test.ts`
   - `bun test tests/unit/api/workflows/errors.test.ts`
   - `bun test tests/unit/api/workflows/workflow-api.test.ts`
   - `bun test tests/unit/api/workflows/http-dispatch.test.ts`

2. Run integration coverage for the ticket scope:
   - `bun test tests/integration/workflow-api.integration.test.ts`
   - `bun test tests/integration/workflow-api-http.integration.test.ts`
   - `bun test tests/integration/api-data.integration.test.ts`

3. Run project slice gates:
   - `bun run test:integration:api`
   - `bun run test:unit:core`
   - `bun run typecheck`

4. Acceptance criteria pass condition:
   - Empty inputs fail at domain/API boundaries.
   - Auth failures are explicit and observable (forbidden).
   - Conflict transitions are explicit and observable (conflict).
   - Approval/rejection flows are covered for both positive and negative edge paths.

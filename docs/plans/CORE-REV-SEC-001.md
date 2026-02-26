# CORE-REV-SEC-001 Plan: Bind Workflow Actor Identity to Trusted Context (TDD First)

## Overview of the approach
This ticket hardens the workflow HTTP trust boundary by making outbound approval actor identity come from trusted request context, not from request payload. The implementation keeps core authorization checks in place (`actor.kind === "user"` in approval service) but prevents payload spoofing from reaching that layer as authoritative identity.

Scope for this ticket is the highest-risk route: `approval.approveOutboundAction`. The dispatcher will:
- derive trusted actor from authenticated session context or verified signed internal context,
- reject requests that lack trusted actor context for trusted routes,
- reject payload actor mismatches as spoof attempts,
- inject trusted actor into the routed body before validation/handler execution.

This preserves existing core service behavior while closing the HTTP-layer spoof vector and adding regression coverage proving non-user spoofing cannot approve outbound actions.

## TDD step order (tests before implementation)
1. **Test (RED):** `tests/unit/api/workflows/routes.test.ts`
   Add assertion that `approval.approveOutboundAction` route metadata declares trusted actor binding (for dispatcher enforcement).
   **Implement (GREEN):** `src/api/workflows/contracts.ts`, `src/api/workflows/routes.ts`
   Add route metadata type and mark only `approval.approveOutboundAction` as trusted-actor-bound.

2. **Test (RED):** `tests/unit/api/workflows/http-dispatch.test.ts`
   Add case: trusted-actor route request without auth/internal context returns sanitized `403` and does not execute handler.
   **Implement (GREEN):** `src/api/workflows/http-dispatch.ts`
   Add trusted-route precheck in dispatcher and fail before `route.handle(...)` when trusted actor cannot be established.

3. **Test (RED):** `tests/unit/api/workflows/http-dispatch.test.ts`
   Add case: trusted session actor is injected into routed payload actor for trusted route.
   **Implement (GREEN):** `src/api/workflows/http-dispatch.ts`
   Add helper to merge trusted actor into request body before route handler invocation.

4. **Test (RED):** `tests/unit/api/workflows/http-dispatch.test.ts`
   Add case: trusted non-user context + spoofed payload user actor is rejected as `403` spoof attempt (sanitized body).
   **Implement (GREEN):** `src/api/workflows/http-dispatch.ts`
   Add payload/trusted actor equality check and forbidden failure path for mismatches.

5. **Test (RED):** `tests/unit/api/workflows/http-dispatch.test.ts`
   Add case: trusted user context + mismatched payload actor id is rejected as `403` spoof attempt.
   **Implement (GREEN):** `src/api/workflows/http-dispatch.ts`
   Reuse spoof-check helper to enforce strict `id` + `kind` equality when payload actor is present.

6. **Test (RED):** `tests/unit/api/workflows/http-dispatch.test.ts`
   Add signed internal context cases:
   - accepted when verifier passes,
   - rejected when verifier fails,
   - rejected when signed internal context is present but verifier not configured.
   **Implement (GREEN):** `src/api/workflows/http-dispatch.ts`
   Add signed-context verification option and trusted actor derivation branch.

7. **Test (RED):** `tests/integration/workflow-api-http.integration.test.ts`
   Add regression: trusted non-user context + payload user spoof for outbound approval returns `403`, outbound port does not execute, entity remains `pending_approval`.
   **Implement (GREEN):** `src/api/workflows/http-dispatch.ts` and test fixture call-sites
   Pass auth context through dispatcher requests for approval calls and ensure spoof rejection is pre-handler.

8. **Test (RED):** `tests/integration/workflow-automation-edge-cases.integration.test.ts`
   Add regression: spoofed approval attempts (context/payload mismatch and non-user context spoofing user payload) leave audit/entity state unchanged (no `synced`/`executed` transition).
   **Implement (GREEN):** `src/api/workflows/http-dispatch.ts` (if needed)
   Ensure rejection occurs before mutation side effects.

9. **Test (RED):** `tests/integration/workflow-api-http.integration.test.ts`
   Add positive path for signed internal context where verification succeeds and trusted user context can approve.
   **Implement (GREEN):** `src/api/workflows/http-dispatch.ts`
   Ensure verified signed context participates in trusted actor derivation equivalently to session context.

10. **Test (RED):** `tests/integration/api-contract-docs.integration.test.ts`
    Add contract assertions for trusted actor semantics in canonical doc (trusted actor requirement + spoof rejection behavior in dispatcher contract text).
    **Implement (GREEN):** `docs/contracts/workflow-api-schema-contract.md`
    Update route payload/validation/dispatcher sections to document trusted actor binding and spoof rejection semantics for `approval.approveOutboundAction`.

11. **Test (RED):** `tests/integration/api-contract-docs.integration.test.ts` (legacy pointer section remains current)
    Keep pointer docs aligned with updated canonical contract timestamp/update guidance.
    **Implement (GREEN):**
    `docs/contracts/workflow-api-routes.md`, `docs/contracts/persisted-schema.md`
    Refresh pointer verification date and keep compatibility guidance intact.

## Files to create/modify (with specific function signatures)

### Modify (implementation)
- `src/api/workflows/contracts.ts`
  - `export type WorkflowRouteActorSource = "payload" | "trusted"`
  - `export interface WorkflowRouteDefinition { key: WorkflowRouteKey; method: "POST"; path: string; actorSource?: WorkflowRouteActorSource; handle: (input: unknown) => Effect.Effect<unknown, WorkflowApiError>; }`

- `src/api/workflows/http-dispatch.ts`
  - `export interface WorkflowSignedInternalActorContext { actor: ActorRef; issuedAt: string; signature: string }`
  - `export interface WorkflowHttpAuthContext { sessionActor?: ActorRef; signedInternalActor?: WorkflowSignedInternalActorContext }`
  - `export interface WorkflowHttpRequest { method: string; path: string; body?: unknown; auth?: WorkflowHttpAuthContext }`
  - `export interface MakeWorkflowHttpDispatcherOptions { verifySignedInternalActorContext?: (context: WorkflowSignedInternalActorContext) => Effect.Effect<ActorRef, WorkflowApiError> }`
  - `const resolveTrustedActor = (request: WorkflowHttpRequest, route: WorkflowRouteDefinition, options: MakeWorkflowHttpDispatcherOptions) => Effect.Effect<ActorRef | undefined, WorkflowApiError>`
  - `const assertPayloadActorNotSpoofed = (route: WorkflowRouteDefinition, body: unknown, trustedActor: ActorRef) => Effect.Effect<void, WorkflowApiError>`
  - `const withTrustedActor = (body: unknown, trustedActor: ActorRef) => unknown`
  - `export const makeWorkflowHttpDispatcher = (routes: ReadonlyArray<WorkflowRouteDefinition>, options?: MakeWorkflowHttpDispatcherOptions) => (request: WorkflowHttpRequest) => Effect.Effect<WorkflowHttpResponse, never>`

- `src/api/workflows/routes.ts`
  - Approval route definition metadata update:
    - `approval.approveOutboundAction` route includes `actorSource: "trusted"`.

### Modify (tests)
- `tests/unit/api/workflows/routes.test.ts`
- `tests/unit/api/workflows/http-dispatch.test.ts`
- `tests/integration/workflow-api-http.integration.test.ts`
- `tests/integration/workflow-automation-edge-cases.integration.test.ts`
- `tests/integration/api-contract-docs.integration.test.ts`

### Modify (docs/contracts)
- `docs/contracts/workflow-api-schema-contract.md`
- `docs/contracts/workflow-api-routes.md`
- `docs/contracts/persisted-schema.md`

## Tests to write (unit + integration)

### Unit tests
- `tests/unit/api/workflows/routes.test.ts`
  - `approval.approveOutboundAction` route declares trusted actor binding metadata.

- `tests/unit/api/workflows/http-dispatch.test.ts`
  - trusted route rejects missing trusted context (`403`, sanitized body, handler not called).
  - trusted session actor is injected into body actor before route handle.
  - trusted non-user + payload user spoof is rejected (`403`).
  - trusted user + mismatched payload actor id/kind is rejected (`403`).
  - signed internal context accepted only with configured verifier and valid verification result.
  - verifier failures return sanitized `403` without invoking route handler.

### Integration tests
- `tests/integration/workflow-api-http.integration.test.ts`
  - non-user trusted context spoofing payload user cannot approve outbound action (`403`).
  - spoof rejection does not execute outbound action and keeps entity state in `pending_approval`.
  - verified signed internal context positive-path approval works when trusted actor is user.

- `tests/integration/workflow-automation-edge-cases.integration.test.ts`
  - spoof attempts across outbound approval flows produce sanitized errors and no approval/execution state transition.

- `tests/integration/api-contract-docs.integration.test.ts`
  - canonical contract includes trusted actor + spoof rejection semantics in validation/dispatcher sections.
  - compatibility pointer docs remain aligned with canonical contract update guidance.

## Risks and mitigations
1. **Risk:** Backward compatibility break for approval callers that only provide payload actor.
   **Mitigation:** Keep change scoped to `approval.approveOutboundAction`; update all in-repo dispatcher call-sites/tests in same slice and document requirement in contract.

2. **Risk:** Signed internal context verification details are underspecified (key management, clock skew).
   **Mitigation:** Inject verifier via dispatcher options in this ticket; avoid hardcoding crypto policy. Add explicit verifier-pass/fail tests.

3. **Risk:** Confusing status code split (`400` validation vs `403` spoof/auth).
   **Mitigation:** Treat actor mismatch/missing trusted context as `forbidden` and assert status/message shape in unit + integration tests.

4. **Risk:** Route tests can bypass dispatcher and hide trust-boundary assumptions.
   **Mitigation:** Keep trust-boundary assertions centered in `http-dispatch` tests and integration tests, while route tests only assert metadata contract.

5. **Risk:** Contract docs drift from runtime semantics.
   **Mitigation:** Extend `api-contract-docs.integration.test.ts` with explicit trusted-actor wording assertions and keep pointer docs updated in the same change.

## How to verify against acceptance criteria
Acceptance Criteria mapping:
- **Derive actor from trusted context:** Unit dispatcher tests verify trusted actor is resolved from `request.auth` (session or verified internal context) and injected into approval handler input.
- **Reject spoofed payload actor identities:** Unit and integration tests verify context/payload mismatch returns sanitized `403`.
- **Non-user spoofing cannot approve outbound actions:** Integration tests verify trusted non-user context cannot be bypassed by payload user actor and no outbound execution occurs.
- **Signed internal context is constrained by verification:** Unit/integration tests cover verifier pass/fail behavior.

Verification commands:
- `bun test tests/unit/api/workflows/routes.test.ts`
- `bun test tests/unit/api/workflows/http-dispatch.test.ts`
- `bun test tests/integration/workflow-api-http.integration.test.ts`
- `bun test tests/integration/workflow-automation-edge-cases.integration.test.ts`
- `bun test tests/integration/api-contract-docs.integration.test.ts`
- `bun run typecheck`

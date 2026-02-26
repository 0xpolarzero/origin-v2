# CORE-REV-TEST-002 Plan: HTTP invalid `actor.kind` integration coverage (TDD first)

## Overview of the approach
Close the integration-coverage gap by adding explicit invalid `actor.kind` HTTP tests for every route that validates payload `actor` directly, and assert sanitized `400` responses (`{ error, route, message }`, no `_tag`, no `cause`).

Because `approval.approveOutboundAction` is a trusted-actor route with dispatcher actor injection, this plan scopes invalid payload `actor.kind` coverage to direct payload-actor routes (plus `job.create` where `actor` is optional but validated when present).

## TDD step order (tests before implementation)

### Phase 1: RED (write failing tests first)
1. Add unit test in `tests/unit/api/workflows/routes.test.ts`: `capture.entry` rejects `actor.kind: "robot"` with `WorkflowApiError` and message including `actor.kind`.
2. Add unit test in `tests/unit/api/workflows/routes.test.ts`: `job.create` rejects invalid provided optional actor (`actor.kind: "robot"`).

3. Add integration test in `tests/integration/workflow-api-http.integration.test.ts`: `capture.entry` invalid `actor.kind` returns sanitized `400`.
4. Add integration test: `capture.suggest` invalid `actor.kind` returns sanitized `400`.
5. Add integration test: `capture.editSuggestion` invalid `actor.kind` returns sanitized `400`.
6. Add integration test: `capture.rejectSuggestion` invalid `actor.kind` returns sanitized `400`.
7. Add integration test: `capture.acceptAsTask` invalid `actor.kind` returns sanitized `400`.

8. Add integration test: `signal.ingest` invalid `actor.kind` returns sanitized `400`.
9. Add integration test: `signal.triage` invalid `actor.kind` returns sanitized `400`.
10. Add integration test: `signal.convert` invalid `actor.kind` returns sanitized `400`.

11. Add integration test: `planning.completeTask` invalid `actor.kind` returns sanitized `400`.
12. Add integration test: `planning.deferTask` invalid `actor.kind` returns sanitized `400`.
13. Add integration test: `planning.rescheduleTask` invalid `actor.kind` returns sanitized `400`.

14. Add integration test: `approval.requestEventSync` invalid `actor.kind` returns sanitized `400`.
15. Add integration test: `approval.requestOutboundDraftExecution` invalid `actor.kind` returns sanitized `400`.

16. Add integration test: `job.create` (actor provided) invalid `actor.kind` returns sanitized `400`.
17. Add integration test: `job.recordRun` invalid `actor.kind` returns sanitized `400`.
18. Add integration test: `job.retry` invalid `actor.kind` returns sanitized `400`.

19. Add integration test: `checkpoint.create` invalid `actor.kind` returns sanitized `400`.
20. Add integration test: `checkpoint.keep` invalid `actor.kind` returns sanitized `400`.
21. Add integration test: `checkpoint.recover` invalid `actor.kind` returns sanitized `400`.

### Phase 2: GREEN (minimal implementation after failures)
22. In `tests/integration/workflow-api-http.integration.test.ts`, add a small helper to avoid duplication and keep assertions uniform:
    `const expectInvalidActorKind400 = async (dispatch, route, body) => Promise<void>`
23. Add a typed case table for invalid actor-kind route fixtures so each route has one independent assertion and test title.
24. If any route returns non-`400`, patch only the corresponding validator in `src/api/workflows/routes.ts` (specific `validate*Request` function) to ensure it still invokes `parseActorField(...)`.
25. Keep dispatcher trusted-route semantics unchanged for this ticket; do not force `approval.approveOutboundAction` into payload-actor validation assertions.

### Phase 3: VERIFY
26. Run focused route-validator unit coverage:
    - `bun test tests/unit/api/workflows/routes.test.ts`
27. Run focused HTTP integration coverage:
    - `bun test tests/integration/workflow-api-http.integration.test.ts`
28. Run API integration gate:
    - `bun run test:integration:api`
29. Run type safety gate:
    - `bun run typecheck`

## Files to create/modify (with specific function signatures)

### Create
- `docs/plans/CORE-REV-TEST-002.md`

### Modify (tests)
- `tests/unit/api/workflows/routes.test.ts`
  - Add route-level tests that execute `route.handle(...)` and assert `Effect.either(...)` left-side `WorkflowApiError` for invalid `actor.kind`.

- `tests/integration/workflow-api-http.integration.test.ts`
  - Reuse existing:
    - `const expectSanitizedError(response, expected): void`
  - Add:
    - `const expectInvalidActorKind400 = async (dispatch: ReturnType<typeof makeWorkflowHttpDispatcher>, route: WorkflowRouteKey, body: unknown): Promise<void>`
    - `const INVALID_ACTOR_KIND_CASES: ReadonlyArray<{ route: WorkflowRouteKey; body: Record<string, unknown> }>`

### Conditional modify (only if RED reveals bug)
- `src/api/workflows/routes.ts`
  - `function parseActorField(route: WorkflowRouteKey, source: Record<string, unknown>, field: string): RouteValidation<ActorRefPayload>`
  - Route validators in scope:
    - `validateCaptureEntryRequest`
    - `validateSuggestEntryAsTaskRequest`
    - `validateEditEntrySuggestionRequest`
    - `validateRejectEntrySuggestionRequest`
    - `validateAcceptEntryAsTaskRequest`
    - `validateIngestSignalRequest`
    - `validateTriageSignalRequest`
    - `validateConvertSignalRequest`
    - `validateCompleteTaskRequest`
    - `validateDeferTaskRequest`
    - `validateRescheduleTaskRequest`
    - `validateRequestEventSyncRequest`
    - `validateRequestOutboundDraftExecutionRequest`
    - `validateCreateJobRequest` (optional actor branch)
    - `validateRecordJobRunRequest`
    - `validateRetryJobRequest`
    - `validateCreateWorkflowCheckpointRequest`
    - `validateKeepCheckpointRequest`
    - `validateRecoverCheckpointRequest`

## Tests to write (unit + integration)

### Unit tests
- `tests/unit/api/workflows/routes.test.ts`
  - `capture.entry` invalid `actor.kind` -> validation failure references `actor.kind`.
  - `job.create` invalid provided `actor.kind` (optional actor path) -> validation failure references `actor.kind`.

### Integration tests
- `tests/integration/workflow-api-http.integration.test.ts`
  - Add one route-specific invalid-actor-kind assertion for each route listed in TDD steps 3-21.
  - For each case assert:
    - `status === 400`
    - response body contains `{ error: "workflow request failed", route }`
    - message includes `actor.kind`
    - response body does **not** include `_tag` or `cause`

## Risks and mitigations
1. Risk: false negatives from invalid non-actor fields causing unrelated `400` messages.
   Mitigation: use route fixtures copied from known-good payloads and mutate only `actor.kind`.

2. Risk: trusted-route confusion (`approval.approveOutboundAction`) because dispatcher injects trusted actor before route validation.
   Mitigation: explicitly scope this ticket to direct payload-actor routes and document trusted-route follow-up separately if needed.

3. Risk: a single table-driven test can mask exactly which route failed.
   Mitigation: ensure per-route test titles (or one test per route) so failures are attributable immediately.

4. Risk: brittle assertions on full message text.
   Mitigation: assert only stable fragments (`actor.kind`) plus sanitized shape fields.

## How to verify against acceptance criteria
Acceptance requires HTTP integration coverage for invalid `actor.kind` payloads with sanitized `400` responses on affected routes.

Verification checklist:
1. Route unit tests prove validator behavior for invalid `actor.kind` (baseline + optional actor path).
2. HTTP integration tests cover all direct payload-actor routes listed in this plan and assert sanitized `400` shape.
3. `bun run test:integration:api` and `bun run typecheck` pass after changes.


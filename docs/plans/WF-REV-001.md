# WF-REV-001 Plan: Expand HTTP Negative-Path Contract Tests Across All Workflow Routes (TDD First)

## Overview of the approach
Deliver WF-REV-001 as a contract-first, route-complete test expansion.

The target outcome is table-driven negative-path coverage for all 25 workflow route keys at two layers:
- `tests/unit/api/workflows/http-dispatch.test.ts` (dispatcher contract + sanitized error envelope)
- `tests/integration/workflow-api-http.integration.test.ts` (real route validators + workflow services + dispatcher)

Each route key gets at least one negative assertion with expected status in `400/403/404/409` (400 only where applicable), and every assertion verifies the sanitized payload shape (`{ error, route, message }`) with no leaked `_tag` or `cause`.

## TDD step order (tests before implementation)

### Phase 1: RED - unit dispatcher table coverage first
1. In `tests/unit/api/workflows/http-dispatch.test.ts`, add helper:
   `const expectSanitizedWorkflowError(response: { status: number; body: unknown }, expected: { status: 400 | 403 | 404 | 409; route: WorkflowRouteKey; messageIncludes?: string }): void`
2. In `tests/unit/api/workflows/http-dispatch.test.ts`, add helper type:
   `interface UnitDispatcherNegativeCase { route: WorkflowRouteKey; expectedStatus: 400 | 403 | 404 | 409; actorSource?: "payload" | "trusted"; auth?: WorkflowHttpAuthContext; body: Record<string, unknown>; message: string }`
3. Add one unit case for `capture.entry` -> `400` (validation-style mapped failure).
4. Add one unit case for `capture.suggest` -> `404`.
5. Add one unit case for `capture.editSuggestion` -> `404`.
6. Add one unit case for `capture.rejectSuggestion` -> `404`.
7. Add one unit case for `capture.acceptAsTask` -> `404`.
8. Add one unit case for `signal.ingest` -> `400`.
9. Add one unit case for `signal.triage` -> `404`.
10. Add one unit case for `signal.convert` -> `409`.
11. Add one unit case for `planning.completeTask` -> `404`.
12. Add one unit case for `planning.deferTask` -> `404`.
13. Add one unit case for `planning.rescheduleTask` -> `404`.
14. Add one unit case for `approval.requestEventSync` -> `409`.
15. Add one unit case for `approval.requestOutboundDraftExecution` -> `409`.
16. Add one unit case for `approval.approveOutboundAction` -> `403`.
17. Add one unit case for `job.create` -> `400`.
18. Add one unit case for `job.recordRun` -> `404`.
19. Add one unit case for `job.inspectRun` -> `404`.
20. Add one unit case for `job.list` -> `400`.
21. Add one unit case for `job.listHistory` -> `404`.
22. Add one unit case for `job.retry` -> `409`.
23. Add one unit case for `checkpoint.create` -> `400`.
24. Add one unit case for `checkpoint.inspect` -> `404`.
25. Add one unit case for `checkpoint.keep` -> `409`.
26. Add one unit case for `checkpoint.recover` -> `409`.
27. Add one unit case for `activity.list` -> `400`.
28. Add a unit matrix-completeness assertion:
   `expect(new Set(cases.map((c) => c.route))).toEqual(new Set(WORKFLOW_ROUTE_KEYS))`
29. Run `bun test tests/unit/api/workflows/http-dispatch.test.ts`.

### Phase 2: RED - integration route-by-route negative matrix
30. In `tests/integration/workflow-api-http.integration.test.ts`, add helper type:
   `interface IntegrationWorkflowNegativeCase { route: WorkflowRouteKey; expectedStatus: 400 | 403 | 404 | 409; body?: Record<string, unknown>; auth?: WorkflowHttpAuthContext; setup?: (ctx: { dispatch: ReturnType<typeof makeWorkflowHttpDispatcher>; platform: CorePlatform }) => Promise<void>; messageIncludes?: string }`
31. Add helper:
   `const postWorkflowRoute = async (dispatch: ReturnType<typeof makeWorkflowHttpDispatcher>, route: WorkflowRouteKey, body?: unknown, auth?: WorkflowHttpAuthContext): Promise<{ status: number; body: unknown }>`
32. Add helper:
   `const assertRouteNegativeCase = async (dispatch: ReturnType<typeof makeWorkflowHttpDispatcher>, routeCase: IntegrationWorkflowNegativeCase): Promise<void>`
33. Add one integration case for `capture.entry` -> `400` (blank `content`).
34. Add one integration case for `capture.suggest` -> `404` (missing `entryId`).
35. Add one integration case for `capture.editSuggestion` -> `404` (missing `entryId`).
36. Add one integration case for `capture.rejectSuggestion` -> `404` (missing `entryId`).
37. Add one integration case for `capture.acceptAsTask` -> `404` (missing `entryId`).
38. Add one integration case for `signal.ingest` -> `400` (blank `payload`).
39. Add one integration case for `signal.triage` -> `404` (missing `signalId`).
40. Add one integration case for `signal.convert` -> `409` (seed untriaged signal, then convert).
41. Add one integration case for `planning.completeTask` -> `404` (missing `taskId`).
42. Add one integration case for `planning.deferTask` -> `404` (missing `taskId`).
43. Add one integration case for `planning.rescheduleTask` -> `404` (missing `taskId`).
44. Add one integration case for `approval.requestEventSync` -> `409` (seed local-only event, request sync once, request again).
45. Add one integration case for `approval.requestOutboundDraftExecution` -> `409` (seed draft, request execution once, request again).
46. Add one integration case for `approval.approveOutboundAction` -> `403` (trusted route with non-user actor/session).
47. Add one integration case for `job.create` -> `400` (blank `name`).
48. Add one integration case for `job.recordRun` -> `404` (missing `jobId`).
49. Add one integration case for `job.inspectRun` -> `404` (missing `jobId`).
50. Add one integration case for `job.list` -> `400` (invalid `limit <= 0`).
51. Add one integration case for `job.listHistory` -> `404` (missing `jobId`).
52. Add one integration case for `job.retry` -> `409` (seed job with non-failed state, then retry).
53. Add one integration case for `checkpoint.create` -> `400` (blank `rollbackTarget`).
54. Add one integration case for `checkpoint.inspect` -> `404` (missing `checkpointId`).
55. Add one integration case for `checkpoint.keep` -> `409` (seed checkpoint into incompatible state, then keep).
56. Add one integration case for `checkpoint.recover` -> `409` (recover once, recover again).
57. Add one integration case for `activity.list` -> `400` (invalid `limit <= 0` or invalid `actorKind`).
58. Add an integration matrix-completeness assertion against `WORKFLOW_ROUTE_KEYS`.
59. Run `bun test tests/integration/workflow-api-http.integration.test.ts` and capture RED failures.

### Phase 3: GREEN - minimal implementation for contract drift
60. In `src/core/app/core-platform.ts`, update function implementation:
   `inspectJobRun: (jobId: string) => Effect.Effect<JobRunInspection, Error>`
   so `mapError` preserves structured error metadata (`code`) instead of wrapping into `new Error(...)`.
61. In `src/core/app/core-platform.ts`, update function implementation:
   `listJobRunHistory: (jobId: string, options?: { limit?: number; beforeAt?: Date }) => Effect.Effect<ReadonlyArray<JobRunHistoryRecord>, Error>`
   to preserve structured metadata.
62. In `src/core/app/core-platform.ts`, update function implementation:
   `inspectWorkflowCheckpoint: (checkpointId: string) => Effect.Effect<Checkpoint, Error>`
   to preserve structured metadata.
63. Re-run `bun test tests/unit/api/workflows/http-dispatch.test.ts`.
64. Re-run `bun test tests/integration/workflow-api-http.integration.test.ts` and confirm GREEN.

### Phase 4: VERIFY and regression gate
65. Run `bun test tests/unit/api/workflows/workflow-api.test.ts`.
66. Run `bun test tests/unit/api/workflows/errors.test.ts`.
67. Run `bun test tests/unit/api/workflows/routes.test.ts`.
68. Run `bun test tests/integration/api-contract-docs.integration.test.ts`.
69. Run `bun run test:integration:api`.
70. Run `bun run typecheck`.

## Files to create/modify (with specific function signatures)

### Create
- `docs/plans/WF-REV-001.md`

### Modify
- `tests/unit/api/workflows/http-dispatch.test.ts`
  - `const expectSanitizedWorkflowError(response: { status: number; body: unknown }, expected: { status: 400 | 403 | 404 | 409; route: WorkflowRouteKey; messageIncludes?: string }): void`
  - `interface UnitDispatcherNegativeCase { route: WorkflowRouteKey; expectedStatus: 400 | 403 | 404 | 409; actorSource?: "payload" | "trusted"; auth?: WorkflowHttpAuthContext; body: Record<string, unknown>; message: string }`
  - `const UNIT_DISPATCHER_NEGATIVE_CASES: ReadonlyArray<UnitDispatcherNegativeCase>`

- `tests/integration/workflow-api-http.integration.test.ts`
  - `interface IntegrationWorkflowNegativeCase { route: WorkflowRouteKey; expectedStatus: 400 | 403 | 404 | 409; body?: Record<string, unknown>; auth?: WorkflowHttpAuthContext; setup?: (ctx: { dispatch: ReturnType<typeof makeWorkflowHttpDispatcher>; platform: CorePlatform }) => Promise<void>; messageIncludes?: string }`
  - `const postWorkflowRoute(dispatch: ReturnType<typeof makeWorkflowHttpDispatcher>, route: WorkflowRouteKey, body?: unknown, auth?: WorkflowHttpAuthContext): Promise<{ status: number; body: unknown }>`
  - `const assertRouteNegativeCase(dispatch: ReturnType<typeof makeWorkflowHttpDispatcher>, routeCase: IntegrationWorkflowNegativeCase): Promise<void>`
  - `const INTEGRATION_NEGATIVE_CASES: ReadonlyArray<IntegrationWorkflowNegativeCase>`

- `src/core/app/core-platform.ts`
  - `inspectJobRun: (jobId: string) => Effect.Effect<JobRunInspection, Error>`
  - `listJobRunHistory: (jobId: string, options?: { limit?: number; beforeAt?: Date }) => Effect.Effect<ReadonlyArray<JobRunHistoryRecord>, Error>`
  - `inspectWorkflowCheckpoint: (checkpointId: string) => Effect.Effect<Checkpoint, Error>`

## Tests to write (unit + integration)

### Unit tests (`tests/unit/api/workflows/http-dispatch.test.ts`)
- Table-driven mapped-error test that iterates all 25 workflow route keys and asserts:
  - status in `400/403/404/409`
  - body contains `{ error: "workflow request failed", route, message }`
  - body omits `_tag` and `cause`
- Completeness test that fails if any `WORKFLOW_ROUTE_KEYS` entry is missing from the negative-case table.

### Integration tests (`tests/integration/workflow-api-http.integration.test.ts`)
- Table-driven end-to-end negative-path test with one primary scenario per route key (25 total).
- Route-specific setup callbacks for seeded conflict scenarios (`signal.convert`, approval routes, `job.retry`, checkpoint transitions).
- Completeness test that route-key set in integration cases equals `WORKFLOW_ROUTE_KEYS`.
- Sanitization assertions for every case (`error`, `route`, `message`, no `_tag`, no `cause`).

## Risks and mitigations
1. Risk: 404/409 cases accidentally hit validator failures and return 400.
   Mitigation: use validated payload shapes with only resource/state invalidity changed.

2. Risk: conflict cases are brittle if setup state is incomplete.
   Mitigation: encode deterministic `setup` callbacks that seed exact preconditions per route.

3. Risk: mapping drift causes false contract behavior (`job.inspectRun`, `job.listHistory`, `checkpoint.inspect` returning 400).
   Mitigation: keep implementation fix scoped to error preservation in `core-platform.ts` only.

4. Risk: table coverage silently regresses when new routes are added.
   Mitigation: include route-set completeness assertions against `WORKFLOW_ROUTE_KEYS` in both unit and integration tests.

5. Risk: flaky timestamp-dependent assertions.
   Mitigation: use fixed ISO timestamps in payloads and avoid asserting dynamic generated IDs/messages.

## How to verify against acceptance criteria
Acceptance criteria target: sanitized `403/404/409` (and `400` where applicable) for every workflow route key.

Verification checklist:
1. Unit dispatcher matrix passes with all 25 route keys represented and sanitized body assertions per case.
2. Integration matrix passes with all 25 route keys represented and expected negative status per scenario.
3. Known drift routes (`job.inspectRun`, `job.listHistory`, `checkpoint.inspect`) return contract-expected `404` after implementation fix.
4. `bun run test:integration:api` and `bun run typecheck` pass.

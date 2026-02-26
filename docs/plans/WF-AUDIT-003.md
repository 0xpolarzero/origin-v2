# WF-AUDIT-003 Plan: Required Jobs + Activity Workflow Surfaces (TDD First)

## Overview of the approach
Implement WF-AUDIT-003 in strict core-first order, then expose user-facing workflow surfaces:
1. Add missing core read-model functions needed by Jobs and Activity (list jobs, inspect checkpoint, list activity feed).
2. Extend workflow API/contracts/routes so Jobs and Activity data/actions are available over the same validated transport boundary already used for workflow actions.
3. Add thin user-facing surface adapters (state + commands) for Jobs and Activity that orchestrate inspect/retry/fix and keep/recover flows.
4. Persist/reuse view filters for Jobs and Activity using existing `view` primitives (no new DB tables).

Assumptions to keep explicit while implementing:
- Activity defaults to all audit transitions, with an `aiOnly` filter for AI-authored changes.
- “Retry/fix” means retry action plus an optional operator fix summary recorded in audit metadata.
- Keep/recover actions remain checkpoint-driven and are surfaced from Activity entries tied to checkpoints.

## TDD step order (tests before implementation)
1. **Test:** `tests/unit/core/services/job-service.test.ts` verifies `retryJobRun(...)` accepts optional `fixSummary` and stores it in retry audit metadata.
   **Implement:** update `src/core/services/job-service.ts` `retryJobRun(...)` to persist `fixSummary` when provided.

2. **Test:** `tests/unit/core/services/job-service.test.ts` verifies `listJobs(...)` returns newest-updated-first and supports `runState`, `limit`, `beforeUpdatedAt`.
   **Implement:** add `listJobs(...)` to `src/core/services/job-service.ts`.

3. **Test:** `tests/unit/core/services/checkpoint-service.test.ts` verifies `inspectWorkflowCheckpoint(...)` returns checkpoint details and maps missing checkpoints to `not_found`.
   **Implement:** add `inspectWorkflowCheckpoint(...)` to `src/core/services/checkpoint-service.ts`.

4. **Test:** create `tests/unit/core/services/activity-service.test.ts` for `listActivityFeed(...)` filtering (`entityType/entityId`, `actorKind`, `aiOnly`, pagination via `beforeAt/limit`) and descending time order.
   **Implement:** create `src/core/services/activity-service.ts` with typed filter/query logic over `listAuditTrail(...)`.

5. **Integration Test:** `tests/integration/core-platform.integration.test.ts` verifies new platform read surfaces (`listJobs`, `inspectWorkflowCheckpoint`, `listActivityFeed`) and retry fix summary passthrough.
   **Implement:** extend `src/core/app/core-platform.ts` with the new methods, mapping core-service errors to `Error`.

6. **Test:** `tests/unit/api/workflows/routes.test.ts` verifies route manifest includes `job.list`, `checkpoint.inspect`, and `activity.list`.
   **Implement:** update `src/api/workflows/contracts.ts` (`WorkflowRouteKey`) and `src/api/workflows/routes.ts` (`WORKFLOW_ROUTE_PATHS`).

7. **Test:** `tests/unit/api/workflows/routes.test.ts` verifies payload validators for:
   - `job.list` (`runState?`, `limit?`, `beforeUpdatedAt?`)
   - `checkpoint.inspect` (`checkpointId`)
   - `activity.list` (`entityType?`, `entityId?`, `actorKind?`, `aiOnly?`, `limit?`, `beforeAt?`)
   - `job.retry` optional `fixSummary`
   **Implement:** add request interfaces + validators in `src/api/workflows/contracts.ts` and `src/api/workflows/routes.ts`.

8. **Test:** `tests/unit/api/workflows/workflow-api.test.ts` verifies `makeWorkflowApi(...)` delegates new handlers and forwards `fixSummary` on retry.
   **Implement:** extend `src/api/workflows/workflow-api.ts` with `listJobs`, `inspectWorkflowCheckpoint`, and `listActivity`.

9. **Test:** `tests/unit/api/workflows/http-dispatch.test.ts` verifies dispatcher can invoke new Jobs/Activity routes and still returns sanitized failures.
   **Implement:** update test stubs/route wiring; no dispatcher contract changes expected unless tests reveal gaps.

10. **Integration Test:** `tests/integration/workflow-api.integration.test.ts` verifies Jobs workflow at API level:
   `job.create -> job.recordRun(failed) -> job.inspectRun -> job.retry(fixSummary) -> job.recordRun(succeeded) -> job.list -> job.listHistory`.
   **Implement:** finalize API/platform wiring for `job.list` and retry fix-summary propagation.

11. **Integration Test:** `tests/integration/workflow-api-http.integration.test.ts` verifies Activity workflow at HTTP boundary:
   `checkpoint.create(ai actor) -> activity.list(aiOnly=true) -> checkpoint.inspect -> checkpoint.keep/recover`.
   **Implement:** finalize route validators/date coercion for new list/inspect payloads.

12. **Test:** `tests/unit/core/services/view-service.test.ts` verifies Jobs/Activity filter views can be upserted and retrieved by scope.
   **Implement:** add scoped view helpers to `src/core/services/view-service.ts` (reuse existing `view` entity).

13. **Test:** create `tests/unit/ui/workflows/workflow-surface-client.test.ts` for typed client mapping between surface calls and workflow HTTP routes.
   **Implement:** create `src/ui/workflows/workflow-surface-client.ts`.

14. **Test:** create `tests/unit/ui/workflows/jobs-surface.test.ts` for Jobs surface state transitions:
   load jobs, inspect run, retry with fix summary, and post-action refresh.
   **Implement:** create `src/ui/workflows/jobs-surface.ts`.

15. **Test:** create `tests/unit/ui/workflows/activity-surface.test.ts` for Activity surface state transitions:
   load feed, filter AI changes, inspect checkpoint, keep/recover and refresh.
   **Implement:** create `src/ui/workflows/activity-surface.ts`.

16. **Integration Test:** create `tests/integration/workflow-surfaces.integration.test.ts` to exercise end-to-end surface orchestration against in-memory platform + HTTP dispatcher.
   **Implement:** wire surface client + Jobs/Activity surfaces through `makeWorkflowHttpDispatcher(...)` and `makeWorkflowRoutes(...)`.

17. **Test:** `tests/integration/workflow-gate-policy.integration.test.ts` (or equivalent ticket gate test) verifies new surface test file is included in workflow integration validation command set.
   **Implement:** update `package.json` integration scripts to include the new surface integration suite where appropriate.

## Files to create/modify (with specific function signatures)

### Create
- `src/core/services/activity-service.ts`
  - `export interface ListActivityFeedInput { entityType?: string; entityId?: string; actorKind?: "user" | "system" | "ai"; aiOnly?: boolean; limit?: number; beforeAt?: Date }`
  - `export interface ActivityFeedItem { id: string; entityType: string; entityId: string; fromState: string; toState: string; actor: { id: string; kind: "user" | "system" | "ai" }; reason: string; at: string; metadata?: Record<string, string> }`
  - `export const listActivityFeed: (repository: CoreRepository, input?: ListActivityFeedInput) => Effect.Effect<ReadonlyArray<ActivityFeedItem>, ActivityServiceError>`
- `src/ui/workflows/workflow-surface-client.ts`
  - `export interface WorkflowSurfaceClient { listJobs(...); inspectJobRun(...); retryJob(...); listActivity(...); inspectWorkflowCheckpoint(...); keepCheckpoint(...); recoverCheckpoint(...) }`
  - `export const makeWorkflowSurfaceClient: (dispatch: (request: WorkflowHttpRequest) => Effect.Effect<WorkflowHttpResponse, never>) => WorkflowSurfaceClient`
- `src/ui/workflows/jobs-surface.ts`
  - `export interface JobsSurfaceState { ... }`
  - `export const loadJobsSurface: (client: WorkflowSurfaceClient, input?: ListJobsRequest) => Effect.Effect<JobsSurfaceState, JobsSurfaceError>`
  - `export const inspectJobFromSurface: (client: WorkflowSurfaceClient, state: JobsSurfaceState, jobId: string) => Effect.Effect<JobsSurfaceState, JobsSurfaceError>`
  - `export const retryJobFromSurface: (client: WorkflowSurfaceClient, state: JobsSurfaceState, input: { jobId: string; actor: ActorRef; at?: Date; fixSummary?: string }) => Effect.Effect<JobsSurfaceState, JobsSurfaceError>`
- `src/ui/workflows/activity-surface.ts`
  - `export interface ActivitySurfaceState { ... }`
  - `export const loadActivitySurface: (client: WorkflowSurfaceClient, input?: ListActivityRequest) => Effect.Effect<ActivitySurfaceState, ActivitySurfaceError>`
  - `export const keepCheckpointFromActivity: (client: WorkflowSurfaceClient, state: ActivitySurfaceState, input: { checkpointId: string; actor: ActorRef; at?: Date }) => Effect.Effect<ActivitySurfaceState, ActivitySurfaceError>`
  - `export const recoverCheckpointFromActivity: (client: WorkflowSurfaceClient, state: ActivitySurfaceState, input: { checkpointId: string; actor: ActorRef; at?: Date }) => Effect.Effect<ActivitySurfaceState, ActivitySurfaceError>`
- `tests/unit/core/services/activity-service.test.ts`
- `tests/unit/ui/workflows/workflow-surface-client.test.ts`
- `tests/unit/ui/workflows/jobs-surface.test.ts`
- `tests/unit/ui/workflows/activity-surface.test.ts`
- `tests/integration/workflow-surfaces.integration.test.ts`

### Modify
- `src/core/services/job-service.ts`
  - extend `retryJobRun(...)` with optional fix summary
  - add `listJobs(...)`
- `src/core/services/checkpoint-service.ts`
  - add `inspectWorkflowCheckpoint(...)`
- `src/core/services/view-service.ts`
  - add scoped view helper(s) for Jobs/Activity saved filters
- `src/core/app/core-platform.ts`
  - `listJobs: (options?: { runState?: Job["runState"]; limit?: number; beforeUpdatedAt?: Date }) => Effect.Effect<ReadonlyArray<JobListItem>, Error>`
  - `inspectWorkflowCheckpoint: (checkpointId: string) => Effect.Effect<Checkpoint, Error>`
  - `listActivityFeed: (options?: ListActivityFeedInput) => Effect.Effect<ReadonlyArray<ActivityFeedItem>, Error>`
- `src/api/workflows/contracts.ts`
  - extend `WorkflowRouteKey` with `"job.list" | "checkpoint.inspect" | "activity.list"`
  - add `ListJobsRequest`, `InspectWorkflowCheckpointRequest`, `ListActivityRequest`
  - extend `WorkflowApi` with `listJobs`, `inspectWorkflowCheckpoint`, `listActivity`
  - extend `RetryJobRequest` with optional `fixSummary?: string`
- `src/api/workflows/routes.ts`
  - add route paths, validators, and route definitions for new keys
  - extend retry validator for `fixSummary`
- `src/api/workflows/workflow-api.ts`
  - add handler mappings for new routes and retry fix summary passthrough
- `tests/unit/api/workflows/routes.test.ts`
- `tests/unit/api/workflows/workflow-api.test.ts`
- `tests/unit/api/workflows/http-dispatch.test.ts`
- `tests/integration/core-platform.integration.test.ts`
- `tests/integration/workflow-api.integration.test.ts`
- `tests/integration/workflow-api-http.integration.test.ts`
- `package.json`

## Tests to write (unit + integration)

### Unit tests
- `tests/unit/core/services/job-service.test.ts`
  - retry fix summary metadata on audit transition
  - `listJobs` ordering/filter/pagination semantics
- `tests/unit/core/services/checkpoint-service.test.ts`
  - `inspectWorkflowCheckpoint` success + `not_found`
- `tests/unit/core/services/activity-service.test.ts`
  - activity filtering (`entity`, `actor`, `aiOnly`) + pagination + sort
- `tests/unit/core/services/view-service.test.ts`
  - Jobs/Activity scoped view save/update/read behavior
- `tests/unit/api/workflows/routes.test.ts`
  - new route key/path coverage
  - request validation for `job.list`, `checkpoint.inspect`, `activity.list`
  - retry payload accepts optional `fixSummary`
- `tests/unit/api/workflows/workflow-api.test.ts`
  - delegation/error mapping for new API methods
- `tests/unit/api/workflows/http-dispatch.test.ts`
  - dispatcher status/body mapping for new routes
- `tests/unit/ui/workflows/workflow-surface-client.test.ts`
  - route-level request/response contract mapping
- `tests/unit/ui/workflows/jobs-surface.test.ts`
  - load/inspect/retry-refresh surface behavior
- `tests/unit/ui/workflows/activity-surface.test.ts`
  - load/filter/inspect/keep/recover-refresh surface behavior

### Integration tests
- `tests/integration/core-platform.integration.test.ts`
  - core read-surface methods and fix summary propagation
- `tests/integration/workflow-api.integration.test.ts`
  - `Automation run -> inspect -> retry/fix` through workflow API
- `tests/integration/workflow-api-http.integration.test.ts`
  - `AI-applied update -> inspect -> keep/recover` through HTTP dispatcher
- `tests/integration/workflow-surfaces.integration.test.ts`
  - end-to-end Jobs + Activity surface orchestration via API transport

## Risks and mitigations
1. **Risk:** “User-facing view” scope is ambiguous without an existing frontend shell.
   **Mitigation:** ship headless surface adapters (state + commands) that are directly renderable by any shell and fully integration-tested.

2. **Risk:** Activity feed volume can cause expensive reads and noisy UX.
   **Mitigation:** enforce bounded queries (`limit`, `beforeAt`) and default sorting/pagination semantics in service + route validators.

3. **Risk:** Ambiguity in defining “AI-change” may hide relevant events.
   **Mitigation:** default to full audit feed and add explicit `aiOnly` filter based on actor kind.

4. **Risk:** Retry fix-note addition could break existing retry callers.
   **Mitigation:** keep `fixSummary` optional and add route/API regression tests for backward compatibility.

5. **Risk:** Keep/recover actions can race or be invoked on invalid checkpoint states.
   **Mitigation:** rely on existing conflict checks in checkpoint service and verify with API/HTTP integration tests.

## How to verify against acceptance criteria
1. **Jobs view exists with inspect/retry/fix/history controls**
   - `job.list`, `job.inspectRun`, `job.listHistory`, `job.retry(fixSummary)` all pass unit + integration tests.
   - Jobs surface tests confirm user-flow orchestration and post-action refresh.

2. **Activity view exists with auditable AI-change feed and keep/recover actions**
   - `activity.list` + `checkpoint.inspect` + `checkpoint.keep/recover` pass route/API/HTTP integration tests.
   - Activity surface tests confirm filter + recovery workflows.

3. **Required end-to-end workflows are usable**
   - Automation flow: `job.create -> recordRun -> inspect -> retry/fix -> recordRun -> list/history`.
   - AI-change flow: `checkpoint.create(ai actor) -> activity.list -> inspect -> keep/recover`.

4. **Quality gates for this slice**
   - `bun test tests/unit/core/services/job-service.test.ts`
   - `bun test tests/unit/core/services/checkpoint-service.test.ts`
   - `bun test tests/unit/core/services/activity-service.test.ts`
   - `bun test tests/unit/core/services/view-service.test.ts`
   - `bun test tests/unit/api/workflows/routes.test.ts`
   - `bun test tests/unit/api/workflows/workflow-api.test.ts`
   - `bun test tests/unit/api/workflows/http-dispatch.test.ts`
   - `bun test tests/unit/ui/workflows/workflow-surface-client.test.ts`
   - `bun test tests/unit/ui/workflows/jobs-surface.test.ts`
   - `bun test tests/unit/ui/workflows/activity-surface.test.ts`
   - `bun test tests/integration/core-platform.integration.test.ts`
   - `bun test tests/integration/workflow-api.integration.test.ts`
   - `bun test tests/integration/workflow-api-http.integration.test.ts`
   - `bun test tests/integration/workflow-surfaces.integration.test.ts`
   - `bun run test:integration:api`
   - `bun run test:integration:workflow`
   - `bun run typecheck`

# WF-AUDIT-002 Plan: Workflow API Routes + Product DB Schema Compliance (TDD First)

## Overview of the approach
Close the remaining WF-AUDIT-002 compliance gaps with strict test-first sequencing:
1. Add an explicit transport boundary for workflow routes so route compliance is verifiable at request/response level (not only in-process function calls).
2. Harden route payload validation for real JSON payloads by accepting ISO timestamp strings in addition to `Date` instances.
3. Add explicit run-history persistence (`job_run_history`) with a dedicated migration and API read route so run history is first-class in schema and route contracts.
4. Keep core/domain behavior in existing services; route and schema additions remain thin adapters around current workflow logic.

Assumptions to confirm while implementing:
- `run history` in ticket scope should be explicit (table + route), not only inferred from `job` current-state fields and `audit_transitions`.
- Transport binding should remain framework-agnostic for now (no hard dependency on a specific HTTP framework).

## TDD step order (tests before implementation)
1. **Test:** `tests/unit/api/workflows/routes.test.ts` verifies required route keys now include `job.listHistory` and its path is unique under `/api/workflows/`.
   **Implement:** update `src/api/workflows/contracts.ts` (`WorkflowRouteKey`) and `src/api/workflows/routes.ts` (`WORKFLOW_ROUTE_PATHS`).

2. **Test:** `tests/unit/api/workflows/routes.test.ts` verifies `job.listHistory` payload validation (`jobId` required, `limit` optional positive integer, `beforeAt` optional timestamp).
   **Implement:** add `ListJobRunHistoryRequest` and `validateListJobRunHistoryRequest` + route definition in `makeWorkflowRoutes`.

3. **Test:** `tests/unit/api/workflows/workflow-api.test.ts` verifies `api.listJobRunHistory(...)` delegates to `platform.listJobRunHistory(...)` and maps failures to `WorkflowApiError` with route `job.listHistory`.
   **Implement:** add `listJobRunHistory` handler in `src/api/workflows/workflow-api.ts`.

4. **Test:** `tests/unit/api/workflows/routes.test.ts` verifies timestamp fields accept both `Date` and ISO-8601 strings across capture/triage/retry/recover route payloads.
   **Implement:** in `src/api/workflows/routes.ts`, replace strict `Date`-only validation with date coercion helper that accepts `Date | string` and normalizes to `Date`.

5. **Test:** create `tests/unit/api/workflows/http-dispatch.test.ts` for path/method dispatch (`404` unknown path, `405` wrong method, `400` invalid payload, `200` success).
   **Implement:** create `src/api/workflows/http-dispatch.ts` with `makeWorkflowHttpDispatcher(...)` using `makeWorkflowRoutes(...)` handlers.

6. **Integration Test:** create `tests/integration/workflow-api-http.integration.test.ts` to exercise capture, triage, retry, and recovery via JSON request payloads (ISO date strings).
   **Implement:** wire dispatcher with `makeWorkflowApi({ platform })` + `makeWorkflowRoutes(api)` in test harness.

7. **Test:** `tests/unit/core/repositories/sqlite-migrations.test.ts` verifies migration manifest includes `005_job_run_history` after `004` with deterministic ordering/checksum behavior.
   **Implement:** create `src/core/database/migrations/005_job_run_history.sql` and register in `src/core/repositories/sqlite/migrations.ts`.

8. **Test:** `tests/unit/core/repositories/sqlite-schema.test.ts` verifies `job_run_history` table, required columns, and indexes exist.
   **Implement:** in `005_job_run_history.sql`, add table + indexes (at minimum `idx_job_run_history_job_id_at`).

9. **Test:** `tests/unit/core/repositories/sqlite-schema.test.ts` verifies relation and value integrity for `job_run_history` (`job_id` must exist, `outcome` constrained).
   **Implement:** in `005_job_run_history.sql`, add insert/update triggers for `job_id` and `outcome` validation.

10. **Test:** `tests/unit/core/repositories/sqlite-schema.test.ts` verifies migration backfills `job_run_history` from existing `audit_transitions` rows produced by prior job runs.
    **Implement:** in `005_job_run_history.sql`, add deterministic backfill SQL from historical `audit_transitions` (`entity_type='job'`, terminal run states).

11. **Test:** `tests/unit/core/repositories/sqlite-core-repository.test.ts` verifies repository can persist/load/list `job_run_history` rows.
    **Implement:** update `src/core/repositories/sqlite/sqlite-core-repository.ts` `TABLE_CONFIGS` to include `job_run_history` mapping.

12. **Test:** `tests/unit/core/services/job-service.test.ts` verifies `recordJobRun(...)` appends one `job_run_history` row per run with matching diagnostics/outcome/retry snapshot.
    **Implement:** update `recordJobRun(...)` in `src/core/services/job-service.ts` to persist a history row alongside job state + audit transition.

13. **Test:** `tests/unit/core/services/job-service.test.ts` verifies new `listJobRunHistory(...)` returns newest-first and honors `limit` / `beforeAt` filters.
    **Implement:** add `listJobRunHistory(...)` to `src/core/services/job-service.ts`.

14. **Test:** `tests/unit/api/workflows/workflow-api.test.ts` verifies `makeWorkflowApi` exposes `listJobRunHistory` and route-key error mapping remains stable for all handlers.
    **Implement:** finalize `WorkflowApi` contract and handler wiring in `contracts.ts` + `workflow-api.ts`.

15. **Test:** `tests/unit/api/workflows/routes.test.ts` verifies `makeWorkflowRoutes(...)` includes `job.listHistory` route with payload validation failures reported as `WorkflowApiError`.
    **Implement:** finalize route registration and validator integration in `routes.ts`.

16. **Integration Test:** `tests/integration/workflow-api.integration.test.ts` verifies `job.create -> job.recordRun(failed) -> job.retry -> job.recordRun(succeeded) -> job.listHistory` returns ordered history entries with both runs.
    **Implement:** add `listJobRunHistory` method to `src/core/app/core-platform.ts` and expose via API route.

17. **Integration Test:** `tests/integration/database-core-platform.integration.test.ts` verifies `job_run_history` persists across SQLite restart and remains consistent with latest `job` state.
    **Implement:** tune history write/read ordering and migration backfill SQL if assertions fail.

18. **Test:** `package.json` slice gate check ensures API integration script covers HTTP boundary integration test.
    **Implement:** update `test:integration:api` script to include `tests/integration/workflow-api-http.integration.test.ts`.

## Files to create/modify (with specific function signatures)

### Create
- `src/api/workflows/http-dispatch.ts`
  - `export interface WorkflowHttpRequest { method: string; path: string; body?: unknown }`
  - `export interface WorkflowHttpResponse { status: number; body: unknown }`
  - `export const makeWorkflowHttpDispatcher: (routes: ReadonlyArray<WorkflowRouteDefinition>) => (request: WorkflowHttpRequest) => Effect.Effect<WorkflowHttpResponse, never>`
- `src/core/database/migrations/005_job_run_history.sql`
- `tests/unit/api/workflows/http-dispatch.test.ts`
- `tests/integration/workflow-api-http.integration.test.ts`

### Modify
- `src/api/workflows/contracts.ts`
  - `export type WorkflowRouteKey = ... | "job.listHistory"`
  - `export interface ListJobRunHistoryRequest { jobId: string; limit?: number; beforeAt?: Date }`
  - `listJobRunHistory: (input: ListJobRunHistoryRequest) => ApiOutput<CorePlatform["listJobRunHistory"]>`
- `src/api/workflows/routes.ts`
  - `export const WORKFLOW_ROUTE_PATHS: Record<WorkflowRouteKey, string>` (add `job.listHistory`)
  - `const validateListJobRunHistoryRequest: RouteValidator<ListJobRunHistoryRequest>`
  - `const parseDateField(...)` updated to accept `Date | ISO string`
- `src/api/workflows/workflow-api.ts`
  - add `listJobRunHistory` mapping in `makeWorkflowApi(...)`
- `src/core/app/core-platform.ts`
  - `listJobRunHistory: (jobId: string, options?: { limit?: number; beforeAt?: Date }) => Effect.Effect<ReadonlyArray<JobRunHistoryRecord>, Error>`
- `src/core/services/job-service.ts`
  - `export interface JobRunHistoryRecord { id: string; jobId: string; outcome: "succeeded" | "failed"; diagnostics: string; retryCount: number; actor: ActorRef; at: string; createdAt: string }`
  - `export const listJobRunHistory: (repository: CoreRepository, input: { jobId: string; limit?: number; beforeAt?: Date }) => Effect.Effect<ReadonlyArray<JobRunHistoryRecord>, JobServiceError>`
  - update `recordJobRun(...)` to persist one `job_run_history` row
- `src/core/repositories/sqlite/migrations.ts`
  - append `defineMigration("005_job_run_history", ... , "../../database/migrations/005_job_run_history.sql")`
- `src/core/repositories/sqlite/sqlite-core-repository.ts`
  - extend `TABLE_CONFIGS` with `job_run_history`
- `tests/unit/api/workflows/routes.test.ts`
- `tests/unit/api/workflows/workflow-api.test.ts`
- `tests/unit/core/repositories/sqlite-migrations.test.ts`
- `tests/unit/core/repositories/sqlite-schema.test.ts`
- `tests/unit/core/repositories/sqlite-core-repository.test.ts`
- `tests/unit/core/services/job-service.test.ts`
- `tests/integration/workflow-api.integration.test.ts`
- `tests/integration/database-core-platform.integration.test.ts`
- `package.json`

## Tests to write (unit + integration)

### Unit tests
- `tests/unit/api/workflows/routes.test.ts`
  - includes `job.listHistory` in route manifest and route table.
  - `job.listHistory` payload validation success/failure cases.
  - date coercion accepts ISO strings and rejects invalid timestamps.
- `tests/unit/api/workflows/workflow-api.test.ts`
  - `listJobRunHistory` delegation + route-tagged error mapping.
  - regression check that existing route mappings remain unchanged.
- `tests/unit/api/workflows/http-dispatch.test.ts`
  - method/path dispatch matrix (`200`/`400`/`404`/`405`).
- `tests/unit/core/repositories/sqlite-migrations.test.ts`
  - migration manifest/order/idempotency with `005_job_run_history`.
- `tests/unit/core/repositories/sqlite-schema.test.ts`
  - `job_run_history` table/index/trigger/backfill coverage.
- `tests/unit/core/repositories/sqlite-core-repository.test.ts`
  - persistence mapping for `job_run_history` entity rows.
- `tests/unit/core/services/job-service.test.ts`
  - `recordJobRun` writes history rows.
  - `listJobRunHistory` ordering + filters.

### Integration tests
- `tests/integration/workflow-api-http.integration.test.ts`
  - capture/triage/retry/recovery through transport-style JSON dispatcher.
- `tests/integration/workflow-api.integration.test.ts`
  - run-history end-to-end (`create`, `record`, `retry`, `record`, `listHistory`).
- `tests/integration/database-core-platform.integration.test.ts`
  - SQLite restart durability + run-history consistency checks.

## Risks and mitigations
1. **Risk:** `job_run_history` backfill could over/under-count historical runs.
   **Mitigation:** constrain backfill to deterministic audit predicates and assert backfill behavior with fixture rows in schema tests.

2. **Risk:** accepting ISO timestamps may silently accept malformed date-like strings.
   **Mitigation:** strict ISO parse helper (`new Date(value)` + finite-time validation) and explicit invalid-format tests per route family.

3. **Risk:** transport dispatcher behavior drifts from eventual framework adapter.
   **Mitigation:** keep dispatcher contract minimal (`method/path/body -> status/body`) and map framework adapters to this contract later.

4. **Risk:** extra history writes in `recordJobRun` create partial-write bugs.
   **Mitigation:** rely on existing `withTransaction` mutation boundary and assert rollback behavior in DB integration tests.

5. **Risk:** schema growth impacts read performance for long-lived job histories.
   **Mitigation:** add targeted indexes (`job_id`, `at`) and keep `listJobRunHistory` default-limited.

## How to verify against acceptance criteria
1. **Explicit workflow API routes exist and are invocable for required operations**
   - Route/unit tests pass for capture, triage, run history (`job.listHistory`), retry/fix, and recovery paths.

2. **Product DB schema/migrations explicitly support required operations**
   - `005_job_run_history` migration applied and schema tests confirm table/index/constraints/backfill behavior.

3. **Route/schema compliance is directly testable**
   - HTTP-dispatch integration tests pass with JSON payloads (including ISO timestamps).
   - Workflow + DB integration suites verify route calls persist expected rows and survive restart.

4. **Quality gates for this slice**
   - `bun test tests/unit/api/workflows/routes.test.ts`
   - `bun test tests/unit/api/workflows/workflow-api.test.ts`
   - `bun test tests/unit/api/workflows/http-dispatch.test.ts`
   - `bun test tests/unit/core/services/job-service.test.ts`
   - `bun test tests/unit/core/repositories/sqlite-migrations.test.ts`
   - `bun test tests/unit/core/repositories/sqlite-schema.test.ts`
   - `bun test tests/unit/core/repositories/sqlite-core-repository.test.ts`
   - `bun test tests/integration/workflow-api.integration.test.ts`
   - `bun test tests/integration/workflow-api-http.integration.test.ts`
   - `bun test tests/integration/database-core-platform.integration.test.ts`
   - `bun run test:integration:api`
   - `bun run test:integration:db`
   - `bun run typecheck`

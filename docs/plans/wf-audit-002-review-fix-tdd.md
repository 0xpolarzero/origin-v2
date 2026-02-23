# WF-AUDIT-002 review fix TDD log

This log records red-green verification for WF-AUDIT-002 review fixes after `9a47c28`.

## 1) SQLite transaction overlap isolation

Test-first change:
- Added `withTransaction isolates overlapping root transactions` in
  `tests/unit/core/repositories/sqlite-core-repository.test.ts`.

Red run before fix:
- `bun test tests/unit/core/repositories/sqlite-core-repository.test.ts --test-name-pattern "withTransaction isolates overlapping root transactions"`
- Failure included `committedEntry` missing (`Received: undefined`) after outer rollback.

Green run after fix in `src/core/repositories/sqlite/sqlite-core-repository.ts`:
- `bun test tests/unit/core/repositories/sqlite-core-repository.test.ts --test-name-pattern "withTransaction isolates overlapping root transactions"`
- Result: test passed.

## 2) HTTP dispatcher error sanitization

Test-first changes in `tests/unit/api/workflows/http-dispatch.test.ts`:
- Updated 400 assertion to require sanitized body without `_tag` / `cause`.
- Added `returns sanitized 500 body when a route defects`.

Red run before fix:
- `bun test tests/unit/api/workflows/http-dispatch.test.ts`
- Failures included raw `WorkflowApiError` body on 400 and raw defect data on 500.

Green run after fixes in `src/api/workflows/http-dispatch.ts` and `src/api/workflows/routes.ts`:
- `bun test tests/unit/api/workflows/http-dispatch.test.ts`
- Result: all tests passed.

## 3) Job run history query pushdown path

Test-first changes:
- Added `listJobRunHistory queries job-scoped rows with SQL filtering and ordering` in
  `tests/unit/core/repositories/sqlite-core-repository.test.ts`.
- Added `listJobRunHistory uses repository-level filtered history query when available` in
  `tests/unit/core/services/job-service.test.ts`.

Red runs before fix:
- `bun test tests/unit/core/repositories/sqlite-core-repository.test.ts --test-name-pattern "listJobRunHistory queries job-scoped rows with SQL filtering and ordering"`
- Failure included `listJobRunHistory` being `undefined`.
- `bun test tests/unit/core/services/job-service.test.ts --test-name-pattern "listJobRunHistory uses repository-level filtered history query when available"`
- Failure included empty history (`Received: []`) instead of repository-filtered row.

Green runs after fixes in:
- `src/core/repositories/core-repository.ts`
- `src/core/repositories/in-memory-core-repository.ts`
- `src/core/repositories/sqlite/sqlite-core-repository.ts`
- `src/core/services/job-service.ts`

Commands:
- `bun test tests/unit/core/repositories/sqlite-core-repository.test.ts --test-name-pattern "listJobRunHistory queries job-scoped rows with SQL filtering and ordering"`
- `bun test tests/unit/core/services/job-service.test.ts --test-name-pattern "listJobRunHistory uses repository-level filtered history query when available"`

Result: both tests passed.

## 4) ISO-8601 offset timestamp acceptance

Test-first change:
- Added `route handlers accept ISO timestamp offsets in payload date fields` in
  `tests/unit/api/workflows/routes.test.ts`.

Red run before fix:
- `bun test tests/unit/api/workflows/routes.test.ts --test-name-pattern "route handlers accept ISO timestamp offsets in payload date fields"`
- Failure included validation error: `beforeAt must be a valid Date`.

Green run after fix in `src/api/workflows/routes.ts`:
- `bun test tests/unit/api/workflows/routes.test.ts --test-name-pattern "route handlers accept ISO timestamp offsets in payload date fields"`
- Result: test passed.

## 5) Typed HTTP dispatch API stub coverage

Test-first change:
- Added `dispatches job.listHistory route with the API stub` in
  `tests/unit/api/workflows/http-dispatch.test.ts`.

Red run before fix:
- `bun test tests/unit/api/workflows/http-dispatch.test.ts --test-name-pattern "dispatches job.listHistory route with the API stub"`
- Failure included `Expected: 200, Received: 500`.

Green run after fixing stub typing in `tests/unit/api/workflows/http-dispatch.test.ts`:
- Added missing `listJobRunHistory` stub method.
- Removed `as unknown as WorkflowApi` cast.
- `bun test tests/unit/api/workflows/http-dispatch.test.ts`
- Result: all tests passed.

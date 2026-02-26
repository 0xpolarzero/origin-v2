# CORE-REV-TEST-003 Plan: Add HTTP integration tests for `activity.list` invalid parameter combinations (TDD First)

## Overview of the approach
Close the HTTP coverage gap for `activity.list` validation errors by adding route-specific integration tests for invalid `aiOnly`, `actorKind`, `limit`, and `beforeAt` inputs, and assert sanitized `400` responses (`{ error, route, message }` with no internal fields).

Validator behavior already exists in unit coverage, but this plan adds one explicit unit assertion for `limit: 0` to pin "non-positive" semantics directly. Production implementation changes are conditional and only applied if RED tests reveal regressions.

## TDD step order (tests before implementation)

### Phase 1: RED (write failing tests first)
1. Add a unit assertion in `tests/unit/api/workflows/routes.test.ts`:
   - `activity.list` rejects `limit: 0` with `WorkflowApiError` and message including `limit`.

2. Add integration test in `tests/integration/workflow-api-http.integration.test.ts`:
   - `activity.list` with `aiOnly: "true"` returns sanitized `400` and message including `aiOnly`.

3. Add integration test:
   - `activity.list` with `actorKind: "robot"` returns sanitized `400` and message including `actorKind`.

4. Add integration test:
   - `activity.list` with `limit: 0` returns sanitized `400` and message including `limit`.

5. Add integration test:
   - `activity.list` with `beforeAt: "not-a-date"` returns sanitized `400` and message including `beforeAt`.

6. Optional hardening integration test (only if contract ambiguity appears during RED):
   - `activity.list` with timezone-less `beforeAt` (`"2026-02-23T10:00:00"`) returns sanitized `400`.

### Phase 2: GREEN (minimal implementation only after failures)
7. Add a focused helper in the integration test file to keep assertions uniform:
   - `const expectInvalidActivityList400 = async (dispatch: ReturnType<typeof makeWorkflowHttpDispatcher>, body: Record<string, unknown>, messageIncludes: string): Promise<void>`

8. If `aiOnly` case fails, patch `validateListActivityRequest` in `src/api/workflows/routes.ts` to enforce boolean-only `aiOnly`.

9. If `actorKind` case fails, patch `validateListActivityRequest` to enforce `user | system | ai`.

10. If `limit` case fails, patch `validateListActivityRequest` / `parsePositiveIntegerField(...)` usage to keep zero and negatives invalid.

11. If `beforeAt` case fails, patch `validateListActivityRequest` / `parseDateField(route, ..., "beforeAt", true)` usage to preserve strict date parsing.

12. If any error response leaks internals, patch sanitization mapping in `src/api/workflows/http-dispatch.ts` (`toClientErrorBody` and status mapping path).

### Phase 3: VERIFY
13. Run focused unit validator tests:
   - `bun test tests/unit/api/workflows/routes.test.ts`

14. Run focused HTTP integration tests:
   - `bun test tests/integration/workflow-api-http.integration.test.ts`

15. Run API integration gate:
   - `bun run test:integration:api`

16. Run type safety gate:
   - `bun run typecheck`

## Files to create/modify (with specific function signatures)

### Create
- `docs/plans/CORE-REV-TEST-003.md`

### Modify (tests)
- `tests/unit/api/workflows/routes.test.ts`
  - Extend existing `activity.list` validator test with:
    - `Effect.either(activityRoute!.handle({ limit: 0 }))`

- `tests/integration/workflow-api-http.integration.test.ts`
  - Add helper:
    - `const expectInvalidActivityList400 = async (dispatch: ReturnType<typeof makeWorkflowHttpDispatcher>, body: Record<string, unknown>, messageIncludes: string): Promise<void>`
  - Add route tests:
    - `test("activity.list returns sanitized 400 for non-boolean aiOnly", async () => { ... })`
    - `test("activity.list returns sanitized 400 for unsupported actorKind", async () => { ... })`
    - `test("activity.list returns sanitized 400 for non-positive limit", async () => { ... })`
    - `test("activity.list returns sanitized 400 for malformed beforeAt", async () => { ... })`
    - optional: timezone-less `beforeAt` variant

### Conditional modify (only if RED reveals bug)
- `src/api/workflows/routes.ts`
  - `const validateListActivityRequest: RouteValidator<ListActivityRequest> = (input) => { ... }`

- `src/api/workflows/http-dispatch.ts`
  - `const toClientErrorBody = (error: WorkflowApiError): { error: string; route: string; message: string } => ({ ... })`
  - `const toHttpStatus = (error: WorkflowApiError): number => { ... }`

## Tests to write (unit + integration)

### Unit tests
- `tests/unit/api/workflows/routes.test.ts`
  - Add explicit `activity.list` invalid `limit: 0` assertion.
  - Keep existing assertions for invalid `actorKind`, non-boolean `aiOnly`, malformed `beforeAt`, and negative `limit`.

### Integration tests
- `tests/integration/workflow-api-http.integration.test.ts`
  - `activity.list` with invalid `aiOnly` (`"true"`) -> sanitized `400`; message includes `aiOnly`.
  - `activity.list` with unsupported `actorKind` (`"robot"`) -> sanitized `400`; message includes `actorKind`.
  - `activity.list` with non-positive `limit` (`0`) -> sanitized `400`; message includes `limit`.
  - `activity.list` with malformed `beforeAt` (`"not-a-date"`) -> sanitized `400`; message includes `beforeAt`.
  - optional hardening: timezone-less `beforeAt` -> sanitized `400`.

Required assertion shape for each integration case:
- `response.status === 400`
- body includes `{ error: "workflow request failed", route: "activity.list" }`
- body message includes the relevant invalid field name
- body excludes `_tag` and `cause`

## Risks and mitigations
1. Risk: an unrelated validation failure (wrong field) masks the intended check.
   Mitigation: each request body mutates exactly one field from a minimal valid baseline.

2. Risk: brittle tests from exact message matching.
   Mitigation: assert stable field-name fragments only (`aiOnly`, `actorKind`, `limit`, `beforeAt`).

3. Risk: validator already passes all new cases and no production code change is needed.
   Mitigation: keep GREEN implementation conditional and ship test-only changes when behavior is already correct.

4. Risk: sanitization assertions drift if duplicated across tests.
   Mitigation: use shared `expectSanitizedError` plus `expectInvalidActivityList400` helper for consistency.

## How to verify against acceptance criteria
1. Ensure integration coverage exists for all four invalid combinations in `tests/integration/workflow-api-http.integration.test.ts`.
2. Run:
   - `bun test tests/unit/api/workflows/routes.test.ts`
   - `bun test tests/integration/workflow-api-http.integration.test.ts`
   - `bun run test:integration:api`
   - `bun run typecheck`
3. Acceptance mapping:
   - invalid/non-boolean `aiOnly`: explicit integration case with sanitized `400`.
   - unsupported `actorKind`: explicit integration case with sanitized `400`.
   - non-positive `limit`: explicit integration case (`0`) + unit assertion.
   - malformed `beforeAt`: explicit integration case with sanitized `400`.

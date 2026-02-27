# API-DATA-003 Plan: Relax date-like parser to full ISO-8601 timezone support (TDD First)

## Overview of the approach
This slice should stay focused on the existing workflow route date parsing seam in `src/api/workflows/routes.ts`. The plan is to add route-level regression tests first for accepted/rejected ISO-8601 timezone variants, then minimally broaden the regex gate used by `parseDateLike(...)` so timezone-bearing minute-precision timestamps (for example `2026-02-23T10:00Z`) are accepted while timezone-less values remain rejected.

The implementation should remain centralized in parser helpers and avoid route-specific parsing branches.

## TDD step order (tests before implementation)

### Phase 1: RED (add failing tests first)
1. **Unit test (route: `job.listHistory`)**
   Add `test("job.listHistory accepts minute-precision UTC Z beforeAt")` in `tests/unit/api/workflows/routes.test.ts`:
   - payload: `{ jobId, beforeAt: "2026-02-23T10:00Z", limit }`
   - assert route call succeeds and forwarded `beforeAt` is a `Date` with `toISOString() === "2026-02-23T10:00:00.000Z"`.

2. **Unit test (route: `job.listHistory`)**
   Add `test("job.listHistory accepts minute-precision offset beforeAt")`:
   - payload variants: `+01:00` and `-05:30` without seconds (`2026-02-23T10:00+01:00`, `2026-02-23T10:00-05:30`)
   - assert success and normalized UTC `toISOString()` values.

3. **Unit test (route: `job.list`)**
   Add `test("job.list accepts minute-precision timezone beforeUpdatedAt")`:
   - payload: `{ beforeUpdatedAt: "2026-02-23T10:00Z" }`
   - assert success and forwarded `beforeUpdatedAt` is a `Date`.

4. **Unit test (route: `activity.list`)**
   Add `test("activity.list rejects timezone-less minute-precision beforeAt")`:
   - payload: `{ beforeAt: "2026-02-23T10:00" }`
   - assert `WorkflowApiError` on `activity.list` with message containing `beforeAt`.

5. **Unit test (route: `job.listHistory`)**
   Add `test("job.listHistory rejects malformed timezone variants")`:
   - rejected variants: `2026-02-23T10:00:00+01`, `2026-02-23T10:00:00+`, `2026-02-23T10:00`
   - assert each returns `WorkflowApiError` and does not invoke API handler.

6. **Integration test (route: `job.list`)**
   Add `test("workflow HTTP accepts minute-precision timezone beforeUpdatedAt")` in `tests/integration/workflow-api-http.integration.test.ts`:
   - request body includes `beforeUpdatedAt: "2026-02-23T10:00Z"`
   - assert successful status (`200`) and no validation error body.

7. **Integration test (route: `job.list`)**
   Add `test("workflow HTTP rejects timezone-less minute-precision beforeUpdatedAt")`:
   - request body includes `beforeUpdatedAt: "2026-02-23T10:00"`
   - assert sanitized `400` response with route `job.list`.

### Phase 2: GREEN (minimal implementation after tests fail)
8. **Function-level implementation**
   Update `src/api/workflows/routes.ts`:
   - broaden `ISO_8601_PATTERN` to allow:
     - timezone-bearing `YYYY-MM-DDTHH:mmZ`
     - timezone-bearing `YYYY-MM-DDTHH:mm±HH:MM`
     - existing second/fraction variants
   - keep timezone mandatory.

9. **Function-level implementation**
   Keep `parseDateLike(value: unknown): Date | undefined` flow unchanged:
   - regex gate first
   - `new Date(value)` parse
   - reject `NaN` dates
   This preserves strict rejection of malformed strings even when regex broadens.

10. **Route-level implementation**
    Do not add route-specific date parsing logic in validators (`validateListJobsRequest`, `validateListJobRunHistoryRequest`, `validateListActivityRequest`); they should continue to rely on shared `parseDateField(...)`.

### Phase 3: VERIFY
11. Run focused unit tests:
    - `bun test tests/unit/api/workflows/routes.test.ts`

12. Run focused integration tests:
    - `bun test tests/integration/workflow-api-http.integration.test.ts`

13. Run type safety gate:
    - `bun run typecheck`

## Files to create/modify (with specific function signatures)

### Create
- `docs/plans/API-DATA-003.md`

### Modify (implementation)
- `src/api/workflows/routes.ts`
  - `const ISO_8601_PATTERN: RegExp`
  - `const parseDateLike = (value: unknown): Date | undefined`
  - (behavior reused by) `parseDateField(...)`

### Modify (unit tests)
- `tests/unit/api/workflows/routes.test.ts`
  - add route-level tests around:
    - `job.listHistory` (`beforeAt`)
    - `job.list` (`beforeUpdatedAt`)
    - `activity.list` (`beforeAt`)

### Modify (integration tests)
- `tests/integration/workflow-api-http.integration.test.ts`
  - add transport-level assertions for `job.list` accepted/rejected minute-precision timestamp variants.

## Tests to write (unit + integration)

### Unit tests
- `job.listHistory` accepts `2026-02-23T10:00Z`.
- `job.listHistory` accepts offset minute-precision variants (`+01:00`, `-05:30`).
- `job.list` accepts `beforeUpdatedAt` minute-precision timezone string.
- `activity.list` rejects timezone-less `2026-02-23T10:00`.
- `job.listHistory` rejects malformed timezone suffixes (`+01`, `+`, missing timezone).

### Integration tests
- `workflow-api-http` accepts `job.list` with `beforeUpdatedAt: "2026-02-23T10:00Z"` (status `200`).
- `workflow-api-http` rejects `job.list` with `beforeUpdatedAt: "2026-02-23T10:00"` (sanitized `400` with route).

## Risks and mitigations
1. **Risk:** Broad regex may accidentally allow non-contract formats.
   **Mitigation:** Keep explicit accepted/rejected variant matrix tests and require timezone token (`Z` or `±HH:MM`).

2. **Risk:** JavaScript `Date` parsing can be permissive.
   **Mitigation:** Retain regex pre-validation and assert malformed timezone examples remain rejected.

3. **Risk:** Regression in existing second/fraction support.
   **Mitigation:** Keep existing offset/fraction route tests and run full `routes.test.ts`.

4. **Risk:** Integration tests may fail for reasons unrelated to parser changes.
   **Mitigation:** Use `job.list` route for integration parser checks because it does not require pre-seeded entity IDs.

## How to verify against acceptance criteria
Acceptance criteria requires:
- support for full timezone-bearing ISO-8601 forms (including `2026-02-23T10:00Z`)
- continued rejection of timezone-less values
- route-level tests for accepted/rejected variants

Verification checklist:
1. Route-level tests pass for accepted minute-precision timezone variants (`Z`, `±HH:MM`).
2. Route-level tests fail for timezone-less/malformed timezone variants.
3. `src/api/workflows/routes.ts` has a broadened timezone-aware `ISO_8601_PATTERN` with timezone still mandatory.
4. `bun test tests/unit/api/workflows/routes.test.ts` passes.
5. `bun test tests/integration/workflow-api-http.integration.test.ts` and `bun run typecheck` pass for regression confidence.

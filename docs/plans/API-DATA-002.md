# API-DATA-002 Plan: Allow Omitted JSON Body for List Routes with No Required Fields (TDD First)

## Overview of the approach
This ticket is a focused API validation parity fix. The contract says `job.list` and `activity.list` have no required request fields, so omitted JSON body (`undefined`) should be treated like an empty filter object for those two routes only.

Implementation will stay minimal and localized to route validation + dispatcher regression tests:
- Keep existing strict validation for all routes with required fields.
- Make `job.list` and `activity.list` accept omitted body while still rejecting malformed field types/values.
- Add dispatcher-level regression tests for bodyless `POST` requests to both list routes.

## TDD step order (tests before implementation)
1. **Test (unit, routes):** adjust the undefined-payload contract test so it explicitly encodes mixed behavior:
   - routes with required fields still reject `undefined`
   - `job.list` and `activity.list` accept `undefined`
   File: `tests/unit/api/workflows/routes.test.ts`

2. **Test (unit, routes, one route):** add/extend `job.list` validator coverage to assert:
   - `handle(undefined)` succeeds
   - API receives normalized empty filter input (`{ runState: undefined, limit: undefined, beforeUpdatedAt: undefined }`)
   - existing invalid-field assertions still fail (e.g., invalid `runState`)
   File: `tests/unit/api/workflows/routes.test.ts`

3. **Test (unit, routes, one route):** add/extend `activity.list` validator coverage to assert:
   - `handle(undefined)` succeeds
   - API receives normalized empty filter input (`{ entityType: undefined, entityId: undefined, actorKind: undefined, aiOnly: undefined, limit: undefined, beforeAt: undefined }`)
   - existing invalid-field assertions still fail (e.g., invalid `actorKind` / `aiOnly`)
   File: `tests/unit/api/workflows/routes.test.ts`

4. **Test (unit, dispatcher, one route):** add regression test for bodyless `POST /api/workflows/job/list`:
   - request omits `body`
   - dispatcher returns `200`
   - stub sees `job.list` input normalized as empty filter object
   File: `tests/unit/api/workflows/http-dispatch.test.ts`

5. **Test (unit, dispatcher, one route):** add regression test for bodyless `POST /api/workflows/activity/list`:
   - request omits `body`
   - dispatcher returns `200`
   - stub sees `activity.list` input normalized as empty filter object
   File: `tests/unit/api/workflows/http-dispatch.test.ts`

6. **Test (integration, optional but recommended):** add HTTP integration assertion that both list endpoints succeed when `body` is omitted to guard end-to-end transport behavior.
   File: `tests/integration/workflow-api-http.integration.test.ts`

7. **Implement (routes helper):** introduce a narrow helper for optional-body list validators, e.g.:
   - `const parseOptionalRecord = (route: WorkflowRouteKey, input: unknown): RouteValidation<Record<string, unknown>>`
   Behavior: `input === undefined` maps to `valid({})`; all other values pass through `parseRecord(route, input)`.
   File: `src/api/workflows/routes.ts`

8. **Implement (route function, one route):** update
   - `const validateListJobsRequest: RouteValidator<ListJobsRequest>`
   to use optional-body parsing.
   File: `src/api/workflows/routes.ts`

9. **Implement (route function, one route):** update
   - `const validateListActivityRequest: RouteValidator<ListActivityRequest>`
   to use optional-body parsing.
   File: `src/api/workflows/routes.ts`

10. **Verify:** run targeted tests/typecheck for changed slice and ensure acceptance criteria are met.

## Files to create/modify (with specific function signatures)

### Create
- None expected.

### Modify
- `src/api/workflows/routes.ts`
  - `const validateListJobsRequest: RouteValidator<ListJobsRequest> = (input) => ...`
  - `const validateListActivityRequest: RouteValidator<ListActivityRequest> = (input) => ...`
  - `const parseOptionalRecord: (route: WorkflowRouteKey, input: unknown) => RouteValidation<Record<string, unknown>>` (new internal helper)

- `tests/unit/api/workflows/routes.test.ts`
  - Update undefined payload behavior test to distinguish optional-body routes.
  - Extend/add route-specific tests for:
    - `job.list`
    - `activity.list`

- `tests/unit/api/workflows/http-dispatch.test.ts`
  - Add dispatcher regression test: bodyless `job.list` POST.
  - Add dispatcher regression test: bodyless `activity.list` POST.

- `tests/integration/workflow-api-http.integration.test.ts` (optional)
  - Add single integration regression for omitted body on both list routes.

## Tests to write (unit + integration)

### Unit tests
- `tests/unit/api/workflows/routes.test.ts`
  - `route handlers enforce undefined payload rules by route requirement`
  - `job.list validator accepts undefined body and preserves field validation`
  - `activity.list validator accepts undefined body and preserves field validation`

- `tests/unit/api/workflows/http-dispatch.test.ts`
  - `dispatches bodyless POST to job.list`
  - `dispatches bodyless POST to activity.list`

### Integration tests
- `tests/integration/workflow-api-http.integration.test.ts` (recommended)
  - `list routes with no required fields accept omitted body at HTTP boundary`

## Risks and mitigations
1. **Risk:** accidental broadening so `null` or arrays become valid list payloads.
   **Mitigation:** optional-body helper only treats `undefined` as empty object; everything else still uses `parseRecord`.

2. **Risk:** weakening existing guard that required routes must reject omitted payload.
   **Mitigation:** explicitly split/assert required-route rejection in `routes.test.ts`.

3. **Risk:** regression in date/type coercion for existing optional filters.
   **Mitigation:** keep current invalid-field assertions in route-specific tests and re-run dispatcher coercion tests.

4. **Risk:** dispatcher regression tests pass but transport integration still drifts later.
   **Mitigation:** add optional integration regression in `workflow-api-http.integration.test.ts`.

## How to verify against acceptance criteria
1. Run route validator unit tests:
   - `bun test tests/unit/api/workflows/routes.test.ts`

2. Run dispatcher regression tests:
   - `bun test tests/unit/api/workflows/http-dispatch.test.ts`

3. Run HTTP integration regression (if added):
   - `bun test tests/integration/workflow-api-http.integration.test.ts`

4. Run typecheck for changed slice safety:
   - `bun run typecheck`

Acceptance criteria mapping:
- `job.list` and `activity.list` accept omitted/empty body: covered by route-level and dispatcher-level tests.
- Dispatcher-level bodyless POST regressions exist: covered by two new `http-dispatch.test.ts` cases.

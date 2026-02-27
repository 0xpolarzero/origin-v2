# WF-REV-002 Plan: Add Route-Specific Validation Failure Tests for Uncovered Workflow Route Keys (TDD First)

## Overview of the approach
Close validation coverage gaps in `tests/unit/api/workflows/routes.test.ts` for nine uncovered workflow route keys by adding explicit malformed and empty payload assertions per route.

This is a test-only ticket: implement RED/GREEN within the unit test suite, keep production code unchanged unless tests expose a genuine validator gap.

## TDD step order (tests before implementation)

### Phase 1: RED - add failing unit tests route by route
1. Add a small helper in `tests/unit/api/workflows/routes.test.ts`:
   `const getRouteHandle = (key: WorkflowRouteKey) => ReturnType<typeof makeWorkflowRoutes>[number]["handle"]`
2. Add a small assertion helper in `tests/unit/api/workflows/routes.test.ts`:
   `const expectWorkflowValidationLeft = (result: unknown, route: WorkflowRouteKey, messageIncludes: string): void`

3. Add empty-payload rejection test for `capture.suggest` (expect `WorkflowApiError`, route key match, message token `entryId` or `actor`).
4. Add malformed-payload rejection test for `capture.suggest` (`suggestedTitle: "   "`, message token `suggestedTitle`).

5. Add empty-payload rejection test for `capture.editSuggestion`.
6. Add malformed-payload rejection test for `capture.editSuggestion` (`suggestedTitle: 123`, message token `suggestedTitle`).

7. Add empty-payload rejection test for `capture.acceptAsTask`.
8. Add malformed-payload rejection test for `capture.acceptAsTask` (`actor.kind: "robot"`, message token `actor.kind`).

9. Add empty-payload rejection test for `signal.triage`.
10. Add malformed-payload rejection test for `signal.triage` (`decision: 1`, message token `decision`).

11. Add empty-payload rejection test for `signal.convert`.
12. Add malformed-payload rejection test for `signal.convert` (`targetType: "invalid"`, message token `targetType`).

13. Add empty-payload rejection test for `planning.completeTask`.
14. Add malformed-payload rejection test for `planning.completeTask` (`taskId: 1`, message token `taskId`).

15. Add empty-payload rejection test for `planning.rescheduleTask`.
16. Add malformed-payload rejection test for `planning.rescheduleTask` (`nextAt: "not-a-date"`, message token `nextAt`).

17. Add empty-payload rejection test for `job.recordRun`.
18. Add malformed-payload rejection test for `job.recordRun` (`outcome: "partial"`, message token `outcome`).

19. Add empty-payload rejection test for `job.inspectRun`.
20. Add malformed-payload rejection test for `job.inspectRun` (`jobId: "   "`, message token `jobId`).

21. Run `bun test tests/unit/api/workflows/routes.test.ts` and capture failing/passing deltas.

### Phase 2: GREEN - minimal implementation only if tests expose real validator gaps
22. If all new tests pass immediately, do not change implementation.
23. If any new test fails due to validator mismatch, minimally adjust `src/api/workflows/routes.ts` route validator for that specific field only.
24. Re-run `bun test tests/unit/api/workflows/routes.test.ts` until green.

### Phase 3: VERIFY - regression checks
25. Run `bun test tests/unit/api/workflows/http-dispatch.test.ts`.
26. Run `bun test tests/integration/workflow-api-http.integration.test.ts` as integration regression confirmation (no new integration test additions expected for this ticket).
27. Run `bun run typecheck` if any implementation file was modified.

## Files to create/modify (with specific function signatures)

### Create
- `docs/plans/WF-REV-002.md`

### Modify
- `tests/unit/api/workflows/routes.test.ts`
  - `const getRouteHandle(key: WorkflowRouteKey): ReturnType<typeof makeWorkflowRoutes>[number]["handle"]`
  - `const expectWorkflowValidationLeft(result: unknown, route: WorkflowRouteKey, messageIncludes: string): void`
  - New tests for each uncovered route key:
    - `capture.suggest`
    - `capture.editSuggestion`
    - `capture.acceptAsTask`
    - `signal.triage`
    - `signal.convert`
    - `planning.completeTask`
    - `planning.rescheduleTask`
    - `job.recordRun`
    - `job.inspectRun`

### Conditional modify (only if RED reveals bug)
- `src/api/workflows/routes.ts`
  - route validator branches for the failing route key(s), no broader refactor.

## Tests to write (unit + integration)

### Unit tests (new)
- In `tests/unit/api/workflows/routes.test.ts`, add 18 explicit assertions:
  - 9 empty payload cases (`{}`)
  - 9 malformed payload cases (wrong type/enum/blank/date)
- Every case must assert:
  - `Either.isLeft(result) === true`
  - `_tag: "WorkflowApiError"`
  - `route` equals tested route key
  - `message` contains field token indicating the failing validator

### Integration tests
- No new integration test file changes planned for WF-REV-002 because scope is route-validator unit coverage.
- Integration verification run required:
  - `tests/integration/workflow-api-http.integration.test.ts` should remain green to confirm no contract regression.

## Risks and mitigations
1. Risk: brittle message-token assertions if error text formatting changes.
   Mitigation: assert stable field tokens (e.g., `targetType`, `jobId`) instead of full message strings.

2. Risk: overlap with existing generic `undefined` payload test causes redundant coverage without catching empty-object behavior.
   Mitigation: keep explicit `{}` tests per route key to validate object-shape requirements, not just `undefined`.

3. Risk: route lookup repetition increases maintenance overhead.
   Mitigation: add a minimal `getRouteHandle` helper and table-driven per-route data where practical.

4. Risk: accidental scope creep into unrelated route tests.
   Mitigation: limit edits to the nine listed route keys and shared helper code only.

## How to verify against acceptance criteria
1. `tests/unit/api/workflows/routes.test.ts` contains explicit malformed and empty payload assertions for all nine required route keys.
2. Running `bun test tests/unit/api/workflows/routes.test.ts` is green.
3. No unintended regressions in workflow HTTP behavior:
   - `bun test tests/unit/api/workflows/http-dispatch.test.ts` is green.
   - `bun test tests/integration/workflow-api-http.integration.test.ts` is green.
4. If implementation changed, `bun run typecheck` is green.

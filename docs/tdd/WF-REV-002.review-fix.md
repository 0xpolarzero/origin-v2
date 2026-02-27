# WF-REV-002 Review-Fix TDD Log

Date: 2026-02-26

## Scope
- Ticket: add route-specific validation failure tests for uncovered workflow route keys.
- Review-fix goals:
  - restore strict WF-REV-002 scope (unit-route tests only),
  - remove out-of-scope workflow integration additions,
  - capture explicit RED/GREEN evidence for this ticket in `docs/tdd/`.

## RED -> GREEN evidence
1. RED (scope compliance failure in reviewed state):
   - `rg -n "uncovered workflow routes return sanitized 400s|activity\.list returns sanitized 400|minute-precision|spoofing user payload actor|non-integer auditCursor|invalidZeroLimit" tests/integration/workflow-api-http.integration.test.ts tests/unit/api/workflows/routes.test.ts`
   - Result: found WF-REV-002-extraneous additions in integration tests and unrelated unit assertions outside the nine required uncovered keys.

2. GREEN (scope restored):
   - Removed WF-REV-002 out-of-scope additions from `tests/integration/workflow-api-http.integration.test.ts`.
   - Removed unrelated unit assertions from `tests/unit/api/workflows/routes.test.ts`:
     - `checkpoint.create` non-integer `auditCursor` assertion,
     - `activity.list` `limit: 0` assertion,
     - minute-precision timestamp acceptance test.
   - Preserved required WF-REV-002 uncovered-route validation tests in `tests/unit/api/workflows/routes.test.ts`.

3. GREEN verification:
   - `bun test tests/unit/api/workflows/routes.test.ts`
   - `bun test tests/integration/workflow-api-http.integration.test.ts`

## Required pre-describe checks
- `bun run typecheck`
- `bun run test:integration:workflow`

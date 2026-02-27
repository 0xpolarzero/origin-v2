# CORE-REV-TEST-003 Review-Fix TDD Log

Date: 2026-02-26

## Scope
- Ticket: HTTP integration coverage for `activity.list` invalid parameter combinations only.
- Review fixes: enforce minimal ticket scope, remove duplicate/non-isolated matrix coverage, and add ticket-specific TDD attestation.

## RED -> GREEN evidence
1. RED (coverage gap in parent snapshot):
   - `jj --ignore-working-copy file show -r @- tests/integration/workflow-api-http.integration.test.ts | rg "activity\\.list returns sanitized 400 for (non-boolean aiOnly|unsupported actorKind|non-positive limit|malformed beforeAt)"`
   - Result: no matches in parent snapshot for the required ticket-specific invalid-parameter cases.

2. GREEN (tests added, implementation unchanged):
   - Added integration tests in `tests/integration/workflow-api-http.integration.test.ts` for invalid `aiOnly`, `actorKind`, `limit`, and `beforeAt`.
   - Added unit assertion in `tests/unit/api/workflows/routes.test.ts` for `activity.list` rejecting `limit: 0`.
   - No production-code changes were required; validator behavior already existed.

3. Verification commands:
   - `bun run typecheck`
   - `bun run test`

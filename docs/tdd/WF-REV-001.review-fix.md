# WF-REV-001 Review Fix TDD Log

Date: 2026-02-26

This review-fix phase followed tests-first sequencing for the behavior change and captured red/green evidence.

1. Expanded negative-path contract tests to route-complete matrices in:
   - `tests/unit/api/workflows/http-dispatch.test.ts`
   - `tests/integration/workflow-api-http.integration.test.ts`
   - Added completeness assertions against `WORKFLOW_ROUTE_KEYS` in both files.

2. RED validation before implementation fix:
   - Command: `bun test tests/integration/workflow-api-http.integration.test.ts`
   - Result: fail in matrix test for inspect-style routes.
   - Failure evidence: expected `404`, received `400` for missing-resource scenarios (`job.inspectRun`, `job.listHistory`, `checkpoint.inspect`).

3. GREEN implementation fix after RED:
   - Updated `src/core/app/core-platform.ts` to preserve structured service errors (including `code`) by removing lossy `mapError(new Error(...))` wrappers for:
     - `inspectJobRun`
     - `listJobRunHistory`
     - `inspectWorkflowCheckpoint`

4. GREEN validation after implementation:
   - Command: `bun test tests/integration/workflow-api-http.integration.test.ts tests/unit/api/workflows/http-dispatch.test.ts`
   - Result: pass.

5. Required ticket checks (run before each `jj describe` attempt):
   - `bun run typecheck`
   - `bun run test:integration:workflow`

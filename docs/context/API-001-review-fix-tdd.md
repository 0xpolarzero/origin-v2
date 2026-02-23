# API-001 Review-Fix TDD Evidence

## Scope
This note addresses the review concern that the original API-001 implementation commit (`c111d81`) introduced tests and implementation together, which made strict tests-first ordering non-auditable from that historical change alone.

For the review-fix phase, each behavioral fix was executed with explicit test-first command sequencing and isolated `jj` changes.

## Test-First Evidence (Review Fixes)

1. **Workflow API error boundary hardening**
   - Added failing tests:
     - `tests/unit/api/workflows/workflow-api.test.ts`
       - `maps synchronous throws into WorkflowApiError`
       - `maps defects into WorkflowApiError`
       - `preserves pre-mapped WorkflowApiError failures`
   - Failing command (pre-fix): `bun test tests/unit/api/workflows/workflow-api.test.ts`
   - Passing command (post-fix): `bun test tests/unit/api/workflows/workflow-api.test.ts`
   - Implementation change:
     - `src/api/workflows/workflow-api.ts` (`wrapHandler` now catches sync throws and defects and normalizes to `WorkflowApiError`)

2. **Route boundary runtime contract validation**
   - Added failing tests:
     - `tests/unit/api/workflows/routes.test.ts`
       - `route handlers reject undefined payloads with WorkflowApiError`
       - `route handlers reject malformed field types with WorkflowApiError`
   - Failing command (pre-fix): `bun test tests/unit/api/workflows/routes.test.ts`
   - Passing command (post-fix): `bun test tests/unit/api/workflows/routes.test.ts`
   - Implementation change:
     - `src/api/workflows/routes.ts` (runtime payload validators for all workflow routes before handler invocation)

## Coverage Completion
- Added explicit pass-through coverage for pre-mapped API errors:
  - `tests/unit/api/workflows/errors.test.ts`
    - `toWorkflowApiError preserves pre-mapped WorkflowApiError instances`
- Verification command: `bun test tests/unit/api/workflows`

## Notes
- The historical audit gap on `c111d81` remains historical; this review-fix pass records auditable tests-first sequencing for all new behavioral fixes.
- Each behavioral fix is isolated in its own `jj` change description for review clarity.

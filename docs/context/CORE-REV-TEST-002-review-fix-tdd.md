# CORE-REV-TEST-002 Review-Fix TDD Evidence

## Scope
This note addresses the spec-review finding that the original ticket history for
`CORE-REV-TEST-002` is not auditable as tests-first.

## Historical Commit Order Validation
The finding is valid:

1. `f679be3` (`2026-02-23`) introduced runtime payload validation behavior.
2. `df3e4d2` (`2026-02-26`) added invalid `actor.kind` tests later.

Because `f679be3` predates `df3e4d2`, the original ticket sequence does not
meet the strict tests-before-implementation criterion in the ticket plan.

## Review-Fix Remediation
- This review-fix phase preserves prior reviewed behavior and records explicit
  evidence of the historical ordering gap.
- The historical sequence cannot be retroactively converted into tests-only then
  implementation-only checkpoints without rewriting already reviewed history.
- A regression guard test now enforces that this evidence note remains present:
  - `tests/integration/review-fix-tdd-evidence.integration.test.ts`

## Review-Fix Phase Validation
- RED (before adding this file):
  - `bun test tests/integration/review-fix-tdd-evidence.integration.test.ts`
  - Result: fail (`ENOENT` for this evidence file)
- GREEN (after adding this file):
  - `bun test tests/integration/review-fix-tdd-evidence.integration.test.ts`
  - Result: pass

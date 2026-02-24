# WF-AUDIT-004 Review-Fix TDD Evidence

## Scope
This note addresses the review concern that the original ticket implementation commit (`d72e166a`) combined implementation and test changes, so strict test-first ordering was not directly auditable from that historical commit alone.

For this review-fix phase, each fix was executed with explicit red-to-green test sequencing and isolated `jj` changes.

## Test-First Evidence (Review Fixes)

1. **Polyglot fallback gate regression**
   - Added failing integration test:
     - `tests/integration/workflow-gate-policy.integration.test.ts`
       - `CLI fallback config keeps Go/Rust gates runnable when node scripts are missing`
   - Red command (pre-fix):
     - `bun test tests/integration/workflow-gate-policy.integration.test.ts --test-name-pattern "CLI fallback config keeps Go/Rust gates runnable when node scripts are missing"`
   - Green commands (post-fix):
     - `bun test tests/integration/workflow-gate-policy.integration.test.ts --test-name-pattern "CLI fallback config keeps Go/Rust gates runnable when node scripts are missing"`
     - `bun test tests/integration/workflow-gate-policy.integration.test.ts`

2. **Patch mode-bit metadata regression**
   - Added failing regression assertion:
     - `tests/unit/workflow/patch-regression.test.ts`
       - `CLI patch hunks retain fallback-gate wiring` now rejects `old mode 100644` / `new mode 100755` in `src/cli/index.ts` patch section.
   - Red command (pre-fix):
     - `bun test tests/unit/workflow/patch-regression.test.ts --test-name-pattern "CLI patch hunks retain fallback-gate wiring"`
   - Green command (post-fix):
     - `bun test tests/unit/workflow/patch-regression.test.ts --test-name-pattern "CLI patch hunks retain fallback-gate wiring"`

## Notes
- The original audit gap on `d72e166a` cannot be retroactively converted to tests-only then implementation-only checkpoints without rewriting reviewed history.
- This review-fix pass restores auditable test-first sequencing for all new fixes in this phase.

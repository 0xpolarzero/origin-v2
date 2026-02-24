# CORE-REV-007 review fix TDD log

This log records red-green verification for CORE-REV-007 review fixes completed on February 24, 2026.

## 1) Existing-worktree idempotence regression + behavioral runtime coverage

Test-first changes in `tests/unit/workflow/smithers-jj-state.test.ts`:
- Added explicit failure-path assertions for `workspaceUpdateStale(...)` and `bookmarkSet(...)`.
- Replaced source-text-only reconciliation coverage with a runtime scenario using a real pre-existing jj worktree.
- Added a re-entry case that runs the same worktree path twice with a non-repo `rootDir` on the second run.

Red run before engine fix:
- `bun test tests/unit/workflow/smithers-jj-state.test.ts --test-name-pattern "engine behaviorally"`
- Failure included: `Cannot create worktree: no git or jj repository found from ...` on second run.

Green run after fix in `node_modules/smithers-orchestrator/src/engine/index.ts` and patch persistence update in `patches/smithers-orchestrator-jj-traceability.patch`:
- `bun test tests/unit/workflow/smithers-jj-state.test.ts`
- Result: all tests passed.

Validation command executed after fix:
- `echo "No test command configured yet"`

## 2) Runtime coverage for generated workflow merge helpers

Test-first change in `tests/unit/workflow/patch-regression.test.ts`:
- Added executable runtime assertions for generated `mergeCommandMap(...)` and `resolveRuntimeConfig(...)` helper behavior (command map merge, fallback handling, and pre/post check derivation).

Verification run:
- `bun test tests/unit/workflow/patch-regression.test.ts`
- Result: tests passed with runtime helper execution coverage.

Validation command executed after fix:
- `echo "No test command configured yet"`

## 3) Revset compatibility test brittleness removal

Test refactor in `tests/unit/workflow/jj-revset-compatibility.test.ts`:
- Removed brace-count source parsing.
- Replaced with runtime merge-queue operation checks against temp jj repos, including escaped ticket-id handling.

Verification run:
- `bun test tests/unit/workflow/jj-revset-compatibility.test.ts`
- Result: tests passed; no source-body parsing remains.

Validation command executed after fix:
- `echo "No test command configured yet"`

# CORE-REV-007 Plan: Repair jj traceability and unblock history verification (TDD First)

## Overview of the approach
This ticket addresses two verified blockers from `docs/context/CORE-REV-007.md`:
1. jj revset incompatibility (`bookmark(...)`) causes land/merge-queue failures on jj `0.37.0`.
2. progress checkpoints are not reliably auditable from visible history/bookmarks.

Implementation direction:
- Standardize ticket revsets to `bookmarks(...)` everywhere land/merge-queue logic constructs jj queries.
- Make progress updates produce bookmark-visible checkpoints (`jj describe` + `jj new` + bookmark set/push) so commit references are auditable.
- Reconcile existing jj worktrees on reuse to reduce stale state drift when `/tmp/workflow-wt-*` paths already exist.
- Lock behavior with unit/integration tests plus dependency patch regression coverage.

## TDD step order (tests before implementation)
1. **Unit test (RED):** create `tests/unit/workflow/jj-traceability-prompts.test.ts` asserting `node_modules/super-ralph/src/prompts/Land.mdx` uses `bookmarks("ticket/{...}")` and does not contain `bookmark("ticket/{...}")`.
   **Implement (GREEN):** update `node_modules/super-ralph/src/prompts/Land.mdx` revset examples to plural `bookmarks(...)` in log/diff/rebase/fast-forward commands.

2. **Unit test (RED):** in `tests/unit/workflow/jj-traceability-prompts.test.ts`, assert `node_modules/super-ralph/src/prompts/UpdateProgress.mdx` commit flow includes:
   - `jj describe -m ...`
   - `jj new`
   - `jj bookmark set ...`
   - `jj git push --bookmark ...`
   and explicitly instructs visible-history checks.
   **Implement (GREEN):** update `node_modules/super-ralph/src/prompts/UpdateProgress.mdx` commit section and guidance text for bookmark-visible progress checkpoints.

3. **Unit test (RED):** extend `tests/unit/workflow/super-ralph-wiring.test.tsx` to assert the `wt-update-progress` worktree is branch-bound for progress traceability and that `UpdateProgressPrompt` receives the bookmark identifier.
   **Implement (GREEN):** modify `node_modules/super-ralph/src/components/SuperRalph.tsx`:
   - add `progressBookmark?: string` to `SuperRalphProps`
   - default to a deterministic bookmark (for example `progress/update-progress`)
   - set `<Worktree id="wt-update-progress" ... branch={progressBookmark}>`
   - pass `progressBookmark` into `<UpdateProgressPrompt ... />`

4. **Unit test (RED):** create `tests/unit/workflow/jj-revset-compatibility.test.ts` to assert merge-queue revset helpers generate `bookmarks("ticket/<id>")` (plural) and properly quote ticket IDs.
   **Implement (GREEN):** update `node_modules/super-ralph/src/mergeQueue/coordinator.ts`:
   - replace singular helper with plural-safe helper
   - add escaping helper for revset string literals
   - use the helper in rebase, diff/log context collection, and fast-forward paths.

5. **Unit test (RED):** create `tests/unit/workflow/smithers-jj-state.test.ts` for new smithers jj helpers that reconcile stale workspace state and bookmark rebinding safely.
   **Implement (GREEN):** update `node_modules/smithers-orchestrator/src/vcs/jj.ts` with helpers:
   - `export async function workspaceUpdateStale(cwd?: string): Promise<WorkspaceResult>`
   - `export async function bookmarkSet(name: string, rev: string, cwd?: string): Promise<WorkspaceResult>`
   and export from `node_modules/smithers-orchestrator/src/index.ts`.

6. **Unit test (RED):** in `tests/unit/workflow/smithers-jj-state.test.ts`, assert existing jj worktree paths still run reconciliation logic instead of returning early with stale state.
   **Implement (GREEN):** update `node_modules/smithers-orchestrator/src/engine/index.ts`:
   - keep `ensureWorktree(rootDir, worktreePath, branch?)` signature
   - add `async function reconcileExistingJjWorktree(vcsRoot: string, worktreePath: string, branch?: string): Promise<void>`
   - call reconciliation when `existsSync(worktreePath)` is true (before early return).

7. **Unit regression (RED):** extend `tests/unit/workflow/patch-regression.test.ts` to require patch hunks for:
   - `src/prompts/Land.mdx`
   - `src/prompts/UpdateProgress.mdx`
   - `src/components/SuperRalph.tsx`
   - `src/mergeQueue/coordinator.ts`
   and (if smithers is patched) smithers patch sections.
   **Implement (GREEN):** refresh `patches/super-ralph-codex-schema.patch`; add smithers patch + `package.json` `patchedDependencies` entry if smithers edits are required for persistence.

8. **Integration test (RED):** extend `tests/integration/workflow-gate-policy.integration.test.ts` with a temp jj repo scenario proving progress checkpoint visibility:
   - run the same command sequence defined in `UpdateProgress.mdx`
   - verify referenced checkpoint commit is reachable from `ancestors(bookmarks("progress/update-progress"))`
   - verify no revset parse error when querying `bookmarks("ticket/<id>")`.
   **Implement (GREEN):** adjust prompt text/helper wiring until the integration assertions pass deterministically.

9. **Verification slice:** run only ticket-relevant workflow tests + typecheck; fix brittle assertions without weakening guarantees.

## Files to create/modify (with specific function signatures)

### Create
- `tests/unit/workflow/jj-traceability-prompts.test.ts`
  - `function readModuleSource(relativePath: string): string`
  - `function expectUsesBookmarksRevset(source: string): void`

- `tests/unit/workflow/jj-revset-compatibility.test.ts`
  - `function extractFunctionBody(source: string, signature: string): string`

- `tests/unit/workflow/smithers-jj-state.test.ts`
  - `async function initTempJjRepo(): Promise<{ root: string; cleanup: () => void }>`

### Modify
- `node_modules/super-ralph/src/prompts/Land.mdx`
- `node_modules/super-ralph/src/prompts/UpdateProgress.mdx`
- `node_modules/super-ralph/src/components/SuperRalph.tsx`
  - `export type SuperRalphProps = { ...; progressBookmark?: string; ... }`

- `node_modules/super-ralph/src/mergeQueue/coordinator.ts`
  - `function escapeRevsetString(value: string): string`
  - `function ticketBookmarkRevset(ticketId: string): string`

- `node_modules/smithers-orchestrator/src/vcs/jj.ts`
  - `export async function workspaceUpdateStale(cwd?: string): Promise<WorkspaceResult>`
  - `export async function bookmarkSet(name: string, rev: string, cwd?: string): Promise<WorkspaceResult>`

- `node_modules/smithers-orchestrator/src/index.ts`
  - export `workspaceUpdateStale`, `bookmarkSet`

- `node_modules/smithers-orchestrator/src/engine/index.ts`
  - `async function reconcileExistingJjWorktree(vcsRoot: string, worktreePath: string, branch?: string): Promise<void>`

- `tests/unit/workflow/super-ralph-wiring.test.tsx`
- `tests/unit/workflow/patch-regression.test.ts`
- `tests/integration/workflow-gate-policy.integration.test.ts`
- `patches/super-ralph-codex-schema.patch`
- `package.json` (only if adding smithers patch persistence)
- `patches/smithers-orchestrator-jj-traceability.patch` (conditional on smithers edits)

## Tests to write (unit + integration)

### Unit tests
- `tests/unit/workflow/jj-traceability-prompts.test.ts`
  - land prompt uses `bookmarks(...)` consistently.
  - update-progress prompt includes bookmark-visible commit/push flow.

- `tests/unit/workflow/jj-revset-compatibility.test.ts`
  - merge-queue revset helper emits plural function and escaped ticket IDs.

- `tests/unit/workflow/super-ralph-wiring.test.tsx`
  - update-progress worktree is branch-bound for auditability.
  - progress bookmark prop is passed into prompt component.

- `tests/unit/workflow/smithers-jj-state.test.ts`
  - `workspaceUpdateStale` is safe/idempotent when no stale workspaces exist.
  - `bookmarkSet` reports deterministic failures/success for jj commands.
  - existing worktree path reconciliation path is exercised.

- `tests/unit/workflow/patch-regression.test.ts`
  - local patch keeps new jj-traceability hunks (prompts/coordinator/wiring).

### Integration tests
- `tests/integration/workflow-gate-policy.integration.test.ts`
  - temp jj repo validates prompt-defined progress checkpoint flow yields bookmark-visible history.
  - jj `bookmarks(...)` revset queries execute successfully in repo context.

## Risks and mitigations
1. **Risk:** string-based prompt assertions can be brittle to formatting-only changes.
   **Mitigation:** assert behavior markers (command sequence and revset function names), not exact whitespace.

2. **Risk:** progress bookmark push may fail in offline/no-remote environments.
   **Mitigation:** keep integration tests local-only (no remote required) and ensure workflow handles push failure as explicit, auditable error text.

3. **Risk:** patch drift after reinstall can reintroduce legacy revset syntax.
   **Mitigation:** keep patch regression tests mandatory and refresh patch files in the same slice.

4. **Risk:** stale worktree reconciliation can be platform-sensitive.
   **Mitigation:** test idempotent behavior in temp repos and avoid destructive cleanup assumptions.

## How to verify against acceptance criteria
1. **Revset compatibility fixed (jj 0.37.0):**
   - `bun test tests/unit/workflow/jj-traceability-prompts.test.ts`
   - `bun test tests/unit/workflow/jj-revset-compatibility.test.ts`

2. **Progress checkpoints are auditable/visible:**
   - `bun test tests/unit/workflow/super-ralph-wiring.test.tsx`
   - `bun test tests/integration/workflow-gate-policy.integration.test.ts`

3. **Patch persistence and regression guardrails:**
   - `bun test tests/unit/workflow/patch-regression.test.ts`

4. **JJ state/worktree reconciliation hardening:**
   - `bun test tests/unit/workflow/smithers-jj-state.test.ts`

5. **Changed-slice safety checks:**
   - `bun run typecheck`

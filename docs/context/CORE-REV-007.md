# CORE-REV-007 Research Context

## Ticket
- ID: `CORE-REV-007`
- Title: `Repair jj traceability and unblock history verification`
- Category: `jj-compliance`
- Priority: `medium`
- Description: Resolve jj lock/state issue and ensure progress notes map to visible jj checkpoints/commits so compliance with `docs/engineering.choices.md:14` can be audited.

## Relevant Files Field
- `CORE-REV-007` exists in `.super-ralph/workflow.db` (`category_review.suggested_tickets`) with `id/title/description/category/priority` only.
- `relevantFiles` is absent (`json_type(...,'$.relevantFiles')` is null/empty).
- Effective implementation scope must therefore be derived from workflow/runtime sources below.

## Paths Reviewed

| Path | Summary | Relevance to CORE-REV-007 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated global prompt; requires jj checkpoints/commits per slice. | Source-of-truth process contract the ticket is auditing. |
| `README.md` | Repo overview and Super Ralph invocation path. | Confirms where generated workflow/progress artifacts come from. |
| `docs/design.spec.md` | Requires reliability plus auditability/recovery for AI-applied changes. | Product-level reason traceable history must be auditable. |
| `docs/engineering.choices.md` | Normative guardrails; line 14 requires checkpointing with jj. | Direct compliance target referenced by ticket description. |
| `docs/references.md` | Lists required upstream references (jj/smithers/super-ralph/effect/etc.). | Declares expected reference inputs; local submodule tree is currently absent. |
| `docs/super-ralph.prompt.md` | Canonical autonomous prompt mirrors generated constraints, including jj checkpointing. | Confirms process expectations outside generated artifacts. |
| `AGENTS.md` | Repo-specific rules require frequent jj checkpointing and atomic commits. | Additional policy requirement for traceability behavior. |
| `PROGRESS.md` | Current progress report contains commit references and stale run status text. | Primary artifact with traceability drift symptoms. |
| `.super-ralph/workflow.db` | Stores run/node/attempt outputs (`progress`, `report`, `land`, internal smithers tables). | Evidence source for run state, progress summaries, and landing failures. |
| `.super-ralph/generated/workflow.tsx` | Wraps `SuperRalph`; planning prompt is "Plan and research next tickets." | Confirms live workflow artifact in use for current run. |
| `node_modules/super-ralph/src/components/SuperRalph.tsx` | Defines `update-progress` task in `/tmp/workflow-wt-update-progress`; ticket worktrees in `/tmp/workflow-wt-<ticket>`. | Core wiring for where progress commits happen and how workspaces are isolated. |
| `node_modules/super-ralph/src/prompts/UpdateProgress.mdx` | Instructs `jj log --limit 50` then `jj describe`; explicitly no bookmark push. | Main source of non-bookmarked progress commit behavior and possible lineage mismatch. |
| `node_modules/super-ralph/src/prompts/Research.mdx` | Research step commits with `jj describe`, `jj new`, bookmark set, and bookmark push. | Contrast case: ticket research commits are bookmark-visible by design. |
| `node_modules/super-ralph/src/prompts/Plan.mdx` | Plan step also uses bookmark set + push. | Shows expected traceability pattern used in non-progress phases. |
| `node_modules/super-ralph/src/prompts/Land.mdx` | Uses revsets with `bookmark("ticket/{id}")`. | Contains jj revset syntax incompatible with installed jj version. |
| `node_modules/super-ralph/src/mergeQueue/coordinator.ts` | Merge queue operations also build revsets via `bookmark("ticket/<id>")`. | Runtime root cause for rebase/eviction failures under current jj. |
| `node_modules/super-ralph/src/selectors.ts` | Progress summary consumed from one `update-progress` output row. | Explains how stale early progress can propagate in run context. |
| `node_modules/smithers-orchestrator/src/engine/index.ts` | `ensureWorktree` reuses existing path if present; creates jj workspaces; captures `jjPointer`. | Key state-management behavior affecting stale worktree reuse and traceability. |
| `node_modules/smithers-orchestrator/src/vcs/jj.ts` | Implements `runJj`, `workspaceAdd`, `workspaceClose`, `getJjPointer`, `restore --from`. | JJ adapter behavior and version compatibility seam for workspace/pointer state. |
| `tests/unit/workflow/generated-workflow-gates.test.ts` | Validates generated workflow gate wiring and safety policy defaults. | Existing test pattern where new jj-traceability assertions can be added. |
| `tests/unit/workflow/patch-regression.test.ts` | Ensures critical super-ralph patch hunks remain applied. | Candidate location to lock in any prompt/runtime jj traceability patch hunks. |
| `tests/integration/workflow-gate-policy.integration.test.ts` | Integration checks for workflow gate policy and safety policy env behavior. | Candidate integration anchor for jj policy behavior expectations. |

## Reference Materials Reviewed (Patterns)
- `jj --version` reports `jj 0.37.0`.
- `jj help -k revsets` documents `bookmarks([pattern])` (plural) and hidden/visible commit semantics.
- `jj help workspace` documents per-workspace `@` commits and `workspace add/list/forget/update-stale` lifecycle.
- `jj help workspace update-stale` documents stale workspace handling and links official stale-working-copy docs.

## Live Runtime/History Evidence

### 1) Progress notes reference commits not visible from current workspace ancestry
- `progress.summary` row for `update-progress` records: `current @ commit: d2687e26`.
- `jj log -r d2687e26` resolves to `xvzppywnmqlq  📝 docs: update progress report`.
- `jj log -r 'ancestors(@) & d2687e26'` returns empty (not in current workspace ancestry).
- `jj log -r 'bookmarks() & d2687e26'` returns empty (not bookmark-targeted).
- Result: progress note references a checkpoint that is neither ancestor-visible nor bookmark-addressable from the active workspace.

### 2) Merge queue/Land revset syntax is incompatible with installed jj
- Land/merge-queue code uses `bookmark("ticket/<id>")` revsets.
- On jj `0.37.0`, this fails with parser errors suggesting `bookmarks`/`remote_bookmarks`.
- Concrete DB evidence (`land.eviction_details` for `WF-AUDIT-006:land`):
  - `Failed to parse revset: Function 'bookmark' doesn't exist`.
  - Same failure when collecting attempted log/mainline context.
- Impact: tickets are evicted with `rebase_conflict`, preventing expected landing lineage.

### 3) Progress step traceability policy differs from ticket phases
- `UpdateProgress.mdx` commits only with `jj describe`; it does not run `jj new`, bookmark set, or bookmark push.
- `Research.mdx` and `Plan.mdx` do run `jj new` + bookmark set/push.
- This asymmetry makes progress checkpoints harder to audit across workspaces/remotes.

### 4) Worktree state reuse risk in engine
- `ensureWorktree()` returns early if worktree path already exists; it skips workspace creation and bookmark branch setup on reuse.
- For long-running or restarted automation, stale pre-existing `/tmp/workflow-wt-*` paths can carry prior jj workspace state into a new run unless explicitly reconciled.

### 5) PROGRESS.md content is stale relative to DB
- Current `PROGRESS.md` still states run stalled at `update-progress` with no completed rows.
- DB now contains many finished rows for `discover/category_review/research/plan/implement/test/report` and `CORE-REV-007:research` currently `in-progress`.
- Indicates progress artifact freshness and traceability drift.

## Constraints Extracted for Implementation
- `docs/engineering.choices.md:14`: checkpointing must use jj and remain auditable.
- `docs/super-ralph.prompt.md:19` and `:29`: each slice must checkpoint+commit via jj.
- `AGENTS.md:18-20`: frequent jj checkpointing, atomic commits, tests/typecheck for changed slice.
- `docs/design.spec.md:12` and `:65`: auditability/recovery expectations require verifiable history.

## Derived File Focus for CORE-REV-007
(derived because ticket metadata has no `relevantFiles`)

### Primary fix surfaces
- `node_modules/super-ralph/src/prompts/UpdateProgress.mdx`
- `node_modules/super-ralph/src/components/SuperRalph.tsx`
- `node_modules/super-ralph/src/prompts/Land.mdx`
- `node_modules/super-ralph/src/mergeQueue/coordinator.ts`
- `node_modules/smithers-orchestrator/src/engine/index.ts`
- `.super-ralph/generated/workflow.tsx` (regenerated artifact)
- `patches/super-ralph-codex-schema.patch`

### Verification/regression surfaces
- `tests/unit/workflow/generated-workflow-gates.test.ts`
- `tests/unit/workflow/patch-regression.test.ts`
- `tests/integration/workflow-gate-policy.integration.test.ts`

## Open Questions to Resolve During Implementation
1. Should progress commits be bookmark-tracked/pushed (like ticket phases), or should progress updates avoid independent commits and be merged through another auditable path?
2. Should progress history be restricted to `ancestors(@)`/landed bookmarks only, to prevent reporting non-visible commits?
3. For stale worktrees, should automation run `jj workspace update-stale` and/or recreate worktrees when existing paths are detected?
4. Should revset compatibility be centralized (e.g., `bookmarks()` wrapper) to avoid repeating syntax-sensitive strings across prompts/runtime code?

## Research Summary
- CORE-REV-007 has no ticket-local `relevantFiles`; scope is derived from Super Ralph prompts/runtime + Smithers jj workspace orchestration.
- Two concrete blockers are already evidenced in this repo:
  - progress notes can reference non-visible, non-bookmarked jj commits;
  - land/merge-queue revsets use `bookmark(...)` syntax incompatible with installed jj (`0.37.0`), causing evictions.
- Highest-value implementation path is to normalize jj revset compatibility and tighten progress checkpoint traceability so every referenced checkpoint is externally visible/auditable.

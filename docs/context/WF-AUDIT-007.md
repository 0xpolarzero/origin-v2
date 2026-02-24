# WF-AUDIT-007 Research Context

## Ticket
- ID: `WF-AUDIT-007`
- Title: `Make generated workflow configuration portable`
- Category: `architecture`
- Priority: `medium`
- Description: `Eliminate hardcoded absolute paths in generated workflow config; use repo-relative resolution so automation runs are reproducible across environments.`

## Relevant Files Field
- `WF-AUDIT-007` exists in `.super-ralph/workflow.db` under `category_review.suggested_tickets` (`run_id: sr-mlz6qucu-8799bd59`, `node_id: codebase-review:workflow`, `iteration: 0`).
- Ticket metadata currently includes `id/title/description/category/priority` only.
- `relevantFiles` and `referenceFiles` are null/empty in stored ticket JSON for `WF-AUDIT-007`.
- There are currently no rows for `WF-AUDIT-007` in `research`, `plan`, or `report` tables.

## Paths Reviewed

| Path | Summary | Relevance to WF-AUDIT-007 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated top-level prompt (listed twice in ticket reference paths) requiring core-first implementation, validation loops, and safety/auditability. | Defines process constraints that portability changes must preserve. |
| `README.md` | Repo source-of-truth map for docs/contracts and Super Ralph invocation. | Confirms required reference documents and generated artifact flow. |
| `docs/design.spec.md` | Requires reliability, explicit approval for risky actions, and auditability/recovery for AI-applied changes. | Portability supports reproducible and auditable automation runs across environments. |
| `docs/engineering.choices.md` | Normative guardrails: deterministic/testable core logic, per-slice validation, autonomous workflow expectations. | Reinforces fail-closed, reproducible workflow infrastructure behavior. |
| `docs/references.md` | Declares required external references and expected `docs/references/*` submodule paths. | Reference policy source (local `docs/references/` directory is currently absent). |
| `docs/super-ralph.prompt.md` | Canonical non-generated prompt mirror. | Confirms generated prompt constraints are intentional and stable. |
| `.super-ralph/workflow.db` | Ticket metadata and run outputs across phases. | Source-of-truth evidence for WF-AUDIT-007 metadata and missing `relevantFiles`. |
| `.super-ralph/generated/workflow.tsx` | Current generated workflow artifact includes absolute imports and constants (`REPO_ROOT`, `DB_PATH`, `PROMPT_SPEC_PATH`, and fallback `specsPath/referenceFiles`). | Primary artifact exhibiting portability defects. |
| `node_modules/super-ralph/src/cli/index.ts` | Generator template (`renderWorkflowFile`) currently emits absolute path constants and absolute source imports when `runningFromSource` is true. | Primary implementation seam for removing hardcoded absolute paths in generated output. |
| `node_modules/super-ralph/src/cli/fallback-config.ts` | Fallback config builder chooses `specsPath` from absolute `join(repoRoot, ...)` candidates and includes absolute `promptSpecPath` in `referenceFiles`. | Primary config-generation seam for converting to repo-relative references. |
| `node_modules/super-ralph/src/components/SuperRalph.tsx` | Research prompt receives `referencePaths={[specsPath, ...referenceFiles]}` and ticket `relevantFiles`. | Confirms relative config paths are consumed as prompt inputs from repo root context. |
| `node_modules/super-ralph/src/prompts/Research.mdx` | Research phase explicitly asks to read ticket `relevantFiles` and provided `referencePaths`. | Shows how missing `relevantFiles` and path shapes affect downstream research behavior. |
| `node_modules/super-ralph/src/selectors.ts` | Normalizes optional ticket `relevantFiles`/`referenceFiles`. | Confirms null metadata naturally falls back to derived file scope. |
| `node_modules/super-ralph/README.md` | Usage examples configure `specsPath`/`referenceFiles` as repo-relative values. | Pattern precedent for relative path configuration in intended public API. |
| `tests/helpers/generated-workflow.ts` | Reads generated workflow artifact and extracts constants/functions for runtime assertions. | Reusable helper location for new portability assertions on generated source. |
| `tests/unit/workflow/generated-workflow-gates.test.ts` | Current artifact tests validate gate maps/safety wiring but do not assert path portability. | Best unit-test entry point for hardcoded-absolute-path regression coverage. |
| `tests/integration/workflow-gate-policy.integration.test.ts` | Integration policy checks for gate scripts and safety policy runtime behavior. | Candidate suite for end-to-end assertions that generated config paths are repo-relative. |
| `tests/unit/workflow/patch-regression.test.ts` | Ensures local `super-ralph` patch hunks remain present. | Must be extended if new portability hunks are added to patch file(s). |
| `patches/super-ralph-codex-schema.patch` | Local persistence layer for super-ralph source customizations. | Portability changes in vendored `node_modules` must be captured here to survive reinstalls. |
| `docs/context/WF-AUDIT-006.md` | Previous workflow audit context focused on agent safety gating and generated artifact policy testing. | Immediate predecessor with overlapping files/tests and established context structure. |
| `docs/plans/WF-AUDIT-006.md` | Prior TDD plan for generated workflow hardening and patch-regression coverage. | Useful pattern for sequencing portability test additions before implementation updates. |

## Requirements Extracted for WF-AUDIT-007

### Portability/reproducibility requirement
- Generated workflow configuration must avoid machine-specific absolute paths.
- Runtime behavior should resolve paths relative to repository root so committed artifacts execute across developer machines/CI environments.

### Process/quality constraints
- Keep core workflow infrastructure deterministic and test-backed before broader flow changes.
- Preserve existing safety and gate-policy behavior while introducing portable path resolution.
- Ensure patch persistence and regression coverage continue to guard generated workflow invariants.

## Current Implementation Snapshot (Path Portability)
1. Generated artifact currently hardcodes machine-specific absolute imports:
   - `import { SuperRalph } from "/Users/.../node_modules/super-ralph/src";`
   - `import {...} from "/Users/.../node_modules/super-ralph/src/components";`
2. Generated artifact currently hardcodes absolute runtime/config constants:
   - `REPO_ROOT`, `DB_PATH`, `PROMPT_SPEC_PATH`
   - `FALLBACK_CONFIG.specsPath`
   - `FALLBACK_CONFIG.referenceFiles[0]`
3. Generator template (`node_modules/super-ralph/src/cli/index.ts`) intentionally selects absolute source import prefix when `runningFromSource` and serializes absolute path values into the template string.
4. Fallback config builder (`node_modules/super-ralph/src/cli/fallback-config.ts`) currently emits absolute spec/reference paths because candidates are built with `join(repoRoot, ...)` and returned directly.
5. Existing workflow artifact tests currently cover gate/safety policy, but there are no assertions preventing hardcoded absolute paths.

## Key Gaps To Close
1. No regression guard currently fails when absolute import/config paths reappear in generated workflow output.
2. Generator import strategy currently prefers non-portable absolute source imports in common local-source execution paths.
3. Fallback config serialization currently produces absolute `specsPath` and prompt reference path values, defeating reproducibility of checked-in generated artifacts.
4. Local patch durability checks do not yet assert portability-specific hunks.

## Derived File Focus for Implementation
(derived because ticket metadata has no `relevantFiles`)

### Primary implementation files
- `node_modules/super-ralph/src/cli/index.ts`
- `node_modules/super-ralph/src/cli/fallback-config.ts`
- `.super-ralph/generated/workflow.tsx` (regenerated artifact)
- `patches/super-ralph-codex-schema.patch`

### Primary test/regression files
- `tests/unit/workflow/generated-workflow-gates.test.ts`
- `tests/helpers/generated-workflow.ts`
- `tests/integration/workflow-gate-policy.integration.test.ts`
- `tests/unit/workflow/patch-regression.test.ts`

### Supporting prompt/runtime files
- `node_modules/super-ralph/src/components/SuperRalph.tsx`
- `node_modules/super-ralph/src/prompts/Research.mdx`
- `node_modules/super-ralph/src/selectors.ts`

## Suggested Verification Commands for Implementation Phase
- `bun run typecheck`
- `bun test tests/unit/workflow/generated-workflow-gates.test.ts`
- `bun test tests/integration/workflow-gate-policy.integration.test.ts`
- `bun test tests/unit/workflow/patch-regression.test.ts`

## Research Summary
- `WF-AUDIT-007` metadata is present, but `relevantFiles`/`referenceFiles` are absent; implementation scope must be derived from generator/runtime/test seams.
- Current generated workflow artifact is not portable: it embeds absolute filesystem paths in imports and config constants.
- Highest-value implementation path is to make generator output repo-relative (or runtime-resolved from repo root), add explicit artifact portability tests, and persist the changes through patch-regression coverage.

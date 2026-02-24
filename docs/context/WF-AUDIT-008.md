# WF-AUDIT-008 Research Context

## Ticket
- ID: `WF-AUDIT-008`
- Title: `Enforce jj commit policy and check discipline`
- Category: `jj-native`
- Priority: `medium`
- Description: `Add automation/linting for allowed commit message types and require passing typecheck/tests per atomic change to align with AGENTS jj-native rules.`

## Relevant Files Field
- No explicit `relevantFiles` payload is present for `WF-AUDIT-008` in repository ticket metadata.
- Evidence:
  - `.super-ralph/workflow.db` (`category_review.suggested_tickets`) contains `WF-AUDIT-008` with `id/title/description/category/priority` only.
  - SQL extraction for this ticket returns `json_type(value,'$.relevantFiles') = null` and `json_extract(value,'$.relevantFiles') = null`.
  - `.super-ralph/workflow.db` currently has no `WF-AUDIT-008` rows in `research`, `plan`, or `report` tables.

## Paths Reviewed

| Path | Summary | Relevance to WF-AUDIT-008 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated autonomous prompt (ticket input listed this path twice) requiring atomic jj commits and per-slice `typecheck + relevant tests`. | Process requirement source for check discipline. |
| `README.md` | Repo source-of-truth map for specs/contracts/prompt. | Confirms canonical policy docs to enforce. |
| `docs/design.spec.md` | Product goals include reliability, explicit control for risky actions, and auditability. | Policy automation should preserve auditable delivery behavior. |
| `docs/engineering.choices.md` | Normative quality rules include running typecheck + relevant tests per slice and atomic checkpoint/commit behavior. | Direct check-discipline requirement source. |
| `docs/references.md` | Declares required reference repositories (`jj`, `super-ralph`, `smithers`). | Reference policy for implementation decisions. |
| `docs/super-ralph.prompt.md` | Canonical prompt mirror of generated prompt. | Confirms ticket constraints are intentional/stable. |
| `AGENTS.md` | Repo-level jj-native policy: commit every atomic slice, each commit must pass relevant tests/typecheck, commit format restricted to `feat|fix|docs|chore`. | Primary policy this ticket must enforce automatically. |
| `.super-ralph/workflow.db` | Ticket metadata and workflow run outputs (`category_review`, `research`, `plan`, `report`, etc.). | Source-of-truth metadata and audit evidence for missing `relevantFiles`. |
| `package.json` | Defines gate scripts (`test`, `typecheck`, category test scripts); no commit-linting scripts are present. | Current check command surface; missing commit policy automation. |
| `.jj/repo/config.toml` | Contains only user identity; no aliases/policy wrappers configured. | Shows no jj-level local enforcement for commit/check policy. |
| `.git/hooks` | Only stock `*.sample` files; no active commit-msg/pre-push/pre-commit hooks. | Confirms no git-hook-based commit policy enforcement exists. |
| `.super-ralph/generated/workflow.tsx` | Generated runtime config includes command gates but no commit-message policy validator or per-commit check attestation mechanism. | Current generated artifact lacks ticket-required enforcement. |
| `node_modules/super-ralph/src/components/SuperRalph.tsx` | Sets default `commitConfig.prefix = "📝"`; wires prompt commit prefixes (`prefix`, `🐛 fix`), ticket gate commands, and merge-queue readiness based on report completion. | Main orchestration point where commit/check discipline is currently weakly enforced (prompt-level only). |
| `node_modules/super-ralph/src/components/ticket-gates.ts` | Resolves verify/validation commands; rejects no-op command patterns and enforces runnable command sets. | Existing strong foundation for command-shape discipline. |
| `node_modules/super-ralph/src/cli/gate-config.ts` | Requires `test` and `typecheck` scripts; maps focus-specific test commands. | Existing gate-config strictness that can be extended with policy checks. |
| `node_modules/super-ralph/src/cli/fallback-config.ts` | Builds fallback command maps deterministically from scripts. | Existing deterministic config pattern for policy enforcement defaults. |
| `node_modules/super-ralph/src/components/InterpretConfig.tsx` | Structured output enforces non-empty gate fields; no commit-policy fields in schema. | Current config schema gap for commit policy controls. |
| `node_modules/super-ralph/src/prompts/Implement.mdx` | Commit command template allows `{props.commitPrefix || 'EMOJI'} type(scope): description`; references "conventional commit prefixes" but does not enforce allowed type set. | Direct commit-message policy gap. |
| `node_modules/super-ralph/src/prompts/ReviewFix.mdx` | Same unrestricted commit template pattern as implement phase. | Same commit-type enforcement gap. |
| `node_modules/super-ralph/src/prompts/Test.mdx` | Fix commit template defaults to `🐛 fix` with arbitrary scope text. | Non-AGENTS commit-format output risk. |
| `node_modules/super-ralph/src/prompts/BuildVerify.mdx` | Fix commit template defaults to emoji-prefixed `fix` pattern. | Same commit message policy drift risk. |
| `node_modules/super-ralph/src/prompts/Research.mdx` | Uses `jj describe -m "📝 docs({props.ticketCategory}): ..."`. | Existing docs-phase commit style uses emoji prefix. |
| `node_modules/super-ralph/src/prompts/Plan.mdx` | Uses `"{props.commitPrefix || '📝'} docs(...): ..."`. | Existing docs-phase commit style allows emoji prefix by default. |
| `node_modules/super-ralph/src/prompts/UpdateProgress.mdx` | Uses `"{props.commitMessage || '📝 docs: update progress report'}"`. | Current default message shape is not strict `docs:` format. |
| `node_modules/super-ralph/src/mergeQueue/coordinator.ts` | Runs `postLandChecks` in speculative workspace and fails on non-zero exit. | Strong final CI enforcement exists, but it does not prove per-atomic-change checks. |
| `node_modules/super-ralph/src/selectors.ts` | `reportComplete` gating is based on report output status, not explicit pass/fail proof of per-commit checks. | Shows workflow progression is not tied to machine-verifiable per-atomic check attestations. |
| `tests/unit/workflow/gate-config.test.ts` | Validates required scripts and deterministic runnable gate commands. | Existing strict policy test pattern to mirror for commit-policy linting. |
| `tests/unit/workflow/ticket-gates.test.ts` | Validates category gate selection and non-runnable command rejection. | Existing check-discipline coverage baseline. |
| `tests/unit/workflow/generated-workflow-gates.test.ts` | Validates generated workflow gate wiring and safety policy behavior. | Candidate location for generated commit-policy contract assertions. |
| `tests/unit/workflow/super-ralph-wiring.test.tsx` | Asserts prompt wiring for verify/test/validation commands and progress bookmark behavior. | Candidate for asserting commit-policy wiring into prompts/runtime config. |
| `tests/unit/workflow/jj-traceability-prompts.test.ts` | Verifies jj traceability command sequences in prompts. | Existing prompt-policy test pattern reusable for commit-format discipline. |
| `tests/unit/workflow/patch-regression.test.ts` | Ensures patched `super-ralph` behavior persists. | Required durability guard if commit-policy logic is patched in `node_modules`. |
| `tests/integration/workflow-gate-policy.integration.test.ts` | End-to-end policy assertions for gate commands and jj traceability behavior. | Best integration surface for commit/check discipline policy assertions. |
| `src/core/tooling/platform-dependency-policy.ts` + `tests/integration/platform-mandated-dependencies.integration.test.ts` | Existing in-repo "policy-as-code" pattern with deterministic violation detection and integration enforcement. | Strong implementation pattern for a new commit/check policy linter module. |
| `docs/plans/WF-AUDIT-004.md` + `docs/context/WF-AUDIT-004.md` | Prior gate-hardening plan/context replacing no-op checks with enforceable commands. | Direct predecessor for check-discipline enforcement strategy. |
| `docs/plans/CORE-REV-007.md` + `docs/context/CORE-REV-007.md` | Prior jj traceability hardening for bookmark-visible checkpoints. | Relevant jj-native precedent and auditability constraints. |

## Reference Materials Reviewed (Patterns)
- `jj --version` confirms `jj 0.37.0` in this environment.
- `jj describe --help` confirms message entry surface (`jj describe -m`).
- `jj help -k config` documents alias support and `jj util exec` script wrappers, which can support jj-native policy wrappers when needed.

## Requirements Extracted for WF-AUDIT-008

### Policy requirements from source-of-truth docs
- `AGENTS.md` requires:
  - atomic jj commits,
  - every atomic commit passes relevant tests/typecheck for the changed slice,
  - commit messages restricted to concise conventional types (`feat`, `fix`, `docs`, `chore`).
- `docs/engineering.choices.md` and prompt docs require per-slice validation (`typecheck + relevant tests`) in the delivery loop.
- `.super-ralph/generated/PROMPT.md` and `docs/super-ralph.prompt.md` require `plan -> implement -> verify -> review/fix -> checkpoint + commit` for each slice.

### Enforcement objective implied by ticket description
- Move from instruction-only behavior to machine-checked policy for:
  - allowed commit-message type prefixes,
  - check discipline tied to atomic changes.

## Current Implementation Snapshot (Commit + Check Discipline)
1. Gate command resolution is strict for command shape and category relevance (`gate-config.ts`, `ticket-gates.ts`, workflow gate tests).
2. Commit-message policy is not machine-enforced:
   - commit templates allow generic `type(scope)` and emoji prefixes,
   - defaults in prompts/components are emoji-prefixed (`📝`, `🐛 fix`).
3. No hook or script currently linting commit messages (`package.json`, `.git/hooks`, `.jj/repo/config.toml`).
4. Workflow progression relies on LLM-reported outputs (`report.status`) rather than explicit per-commit proof that required checks passed.
5. Merge queue enforces `postLandChecks` at landing time, but this does not guarantee the AGENTS requirement of checks per atomic change.

## Key Gaps To Close
1. **Allowed commit types are not enforced** across prompt templates or runtime workflow checks.
2. **Default commit message shapes drift from AGENTS format** via emoji-prefixed defaults.
3. **No policy-as-code check exists** to fail runs when commit messages violate required prefixes.
4. **No machine-verifiable attestation exists** that each atomic change ran/passed required validation commands before checkpointing.
5. **Interpreted/generated config schemas do not expose commit-policy controls** analogous to existing gate command controls.
6. **Patch durability tests do not currently cover commit-policy enforcement markers**.

## Derived File Focus for Implementation
(derived because ticket metadata has no `relevantFiles`)

### Primary implementation surfaces
- `node_modules/super-ralph/src/prompts/Implement.mdx`
- `node_modules/super-ralph/src/prompts/ReviewFix.mdx`
- `node_modules/super-ralph/src/prompts/Test.mdx`
- `node_modules/super-ralph/src/prompts/BuildVerify.mdx`
- `node_modules/super-ralph/src/prompts/Research.mdx`
- `node_modules/super-ralph/src/prompts/Plan.mdx`
- `node_modules/super-ralph/src/prompts/UpdateProgress.mdx`
- `node_modules/super-ralph/src/components/SuperRalph.tsx`
- `node_modules/super-ralph/src/components/InterpretConfig.tsx`
- `node_modules/super-ralph/src/cli/gate-config.ts`
- `node_modules/super-ralph/src/components/ticket-gates.ts`
- `.super-ralph/generated/workflow.tsx` (regenerated artifact)
- `patches/super-ralph-codex-schema.patch`

### Policy-module pattern candidates in this repo
- `src/core/tooling/platform-dependency-policy.ts`
- `tests/integration/platform-mandated-dependencies.integration.test.ts`

### Verification/regression surfaces
- `tests/unit/workflow/jj-traceability-prompts.test.ts`
- `tests/unit/workflow/generated-workflow-gates.test.ts`
- `tests/unit/workflow/super-ralph-wiring.test.tsx`
- `tests/unit/workflow/gate-config.test.ts`
- `tests/unit/workflow/ticket-gates.test.ts`
- `tests/unit/workflow/patch-regression.test.ts`
- `tests/integration/workflow-gate-policy.integration.test.ts`

## Suggested Verification Commands for Implementation Phase
- `bun run typecheck`
- `bun test tests/unit/workflow/jj-traceability-prompts.test.ts`
- `bun test tests/unit/workflow/generated-workflow-gates.test.ts`
- `bun test tests/unit/workflow/super-ralph-wiring.test.tsx`
- `bun test tests/unit/workflow/gate-config.test.ts`
- `bun test tests/unit/workflow/ticket-gates.test.ts`
- `bun test tests/unit/workflow/patch-regression.test.ts`
- `bun test tests/integration/workflow-gate-policy.integration.test.ts`

## Research Summary
- `WF-AUDIT-008` has no ticket-provided `relevantFiles`; implementation scope is derived from Super Ralph prompt/runtime/gate-policy seams.
- The repo already has strong runnable gate-command enforcement, but commit-message and per-atomic-check discipline remain largely instruction-based.
- The main gap is missing machine enforcement for AGENTS commit type restrictions and per-atomic-change validation compliance.
- Existing policy-as-code and workflow gate tests provide a clear, reusable pattern for implementing and hardening this ticket.

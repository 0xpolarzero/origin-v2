# WF-AUDIT-008 Plan: Enforce jj Commit Policy and Check Discipline (TDD First)

## Overview of the approach
This slice turns AGENTS jj-native commit/check rules into policy-as-code instead of prompt-only guidance.

The implementation uses three seams:
1. Add explicit commit/check policy helpers (allowed commit types + required atomic verification coverage).
2. Wire policy into Super Ralph runtime config and prompt props so every phase uses one normalized contract.
3. Harden prompts/tests/regression checks so commit instructions and per-atomic check discipline cannot drift.

This stays core-first: policy helpers and test contracts are implemented before prompt/runtime wiring and generated artifact refresh.

## TDD step order (tests before implementation)
1. **Unit test (RED):** create `tests/unit/workflow/commit-policy.test.ts` with `test("parseCommitType accepts feat/fix/docs/chore and rejects non-conventional messages")`.
   **Implement (GREEN):** create `node_modules/super-ralph/src/components/commit-policy.ts` with:
   - `export const DEFAULT_ALLOWED_COMMIT_TYPES = ["feat", "fix", "docs", "chore"] as const`
   - `export function parseCommitType(commitMessage: string): string | null`

2. **Unit test (RED):** in `tests/unit/workflow/commit-policy.test.ts`, add `test("normalizeCommitPolicy fails closed and dedupes allowlist")`.
   **Implement (GREEN):** in `commit-policy.ts`, add:
   - `export type CommitPolicy = { allowedTypes: string[]; requireAtomicChecks: boolean }`
   - `export function normalizeCommitPolicy(input: unknown): CommitPolicy`

3. **Unit test (RED):** in `tests/unit/workflow/commit-policy.test.ts`, add `test("assertCommitMessageAllowed enforces AGENTS commit types")`.
   **Implement (GREEN):** in `commit-policy.ts`, add:
   - `export function assertCommitMessageAllowed(commitMessage: string, policy: CommitPolicy): void`

4. **Unit test (RED):** extend `tests/unit/workflow/ticket-gates.test.ts` with `test("resolveVerifyCommands enforces atomic typecheck+test discipline")` that fails when a resolved verify set lacks `typecheck` or lacks a runnable test command.
   **Implement (GREEN):** update `node_modules/super-ralph/src/components/ticket-gates.ts`:
   - `function assertAtomicCheckDiscipline(commands: string[]): void`
   - call discipline assertion from `resolveVerifyCommands(...)` before returning commands.

5. **Unit test (RED):** extend `tests/unit/workflow/super-ralph-wiring.test.tsx` with `test("commit policy + atomic check commands are passed to implement/review-fix prompts")`.
   **Implement (GREEN):** update `node_modules/super-ralph/src/components/SuperRalph.tsx`:
   - extend `commitConfig` to include `allowedTypes?: string[]`
   - compute `const commitPolicy = normalizeCommitPolicy(...)`
   - pass `allowedCommitTypes={commitPolicy.allowedTypes}` and per-ticket `atomicCheckCommands={ticketGateSelection.verifyCommands}` / `validationCommands` into commit-capable prompts.

6. **Unit test (RED):** create `tests/unit/workflow/commit-policy-prompts.test.ts` with assertions that `Implement.mdx` and `ReviewFix.mdx`:
   - only document allowed commit types (`feat|fix|docs|chore`),
   - remove emoji/default `type(scope)` placeholders,
   - require running ticket-scoped verify/validation commands before each atomic `jj describe`.
   **Implement (GREEN):** update:
   - `node_modules/super-ralph/src/prompts/Implement.mdx`
   - `node_modules/super-ralph/src/prompts/ReviewFix.mdx`

7. **Unit test (RED):** extend `tests/unit/workflow/commit-policy-prompts.test.ts` with assertions for `Test.mdx`, `BuildVerify.mdx`, `Plan.mdx`, `Research.mdx`, and `UpdateProgress.mdx` commit sections (same allowlist + no emoji default + explicit atomic-check requirement where applicable).
   **Implement (GREEN):** update:
   - `node_modules/super-ralph/src/prompts/Test.mdx`
   - `node_modules/super-ralph/src/prompts/BuildVerify.mdx`
   - `node_modules/super-ralph/src/prompts/Plan.mdx`
   - `node_modules/super-ralph/src/prompts/Research.mdx`
   - `node_modules/super-ralph/src/prompts/UpdateProgress.mdx`

8. **Unit + integration tests (RED):**
   - extend `tests/unit/workflow/interpret-config-guardrails.test.tsx` with `test("schema and prompt hard requirements include commit policy and atomic check discipline")`.
   - extend `tests/unit/workflow/generated-workflow-gates.test.ts` with `test("generated workflow embeds normalized commit policy in FALLBACK_CONFIG/runtime config")`.
   - extend `tests/integration/workflow-gate-policy.integration.test.ts` with `test("repo fallback config exposes commit allowlist and per-ticket verify commands remain typecheck+relevant test")`.
   **Implement (GREEN):** update:
   - `node_modules/super-ralph/src/components/InterpretConfig.tsx` schema + hard requirements text
   - `node_modules/super-ralph/src/cli/fallback-config.ts` to emit default `commitPolicy`
   - `node_modules/super-ralph/src/cli/index.ts` template (if needed) and regenerate `.super-ralph/generated/workflow.tsx`.

9. **Patch durability test (RED):** extend `tests/unit/workflow/patch-regression.test.ts` with assertions for commit-policy helper export/wiring and prompt hunk markers.
   **Implement (GREEN):** refresh `patches/super-ralph-codex-schema.patch` and `node_modules/super-ralph/src/components/index.ts` exports to preserve enforcement after reinstall.

10. **Verification pass:** run targeted policy tests + typecheck and confirm acceptance criteria with prompt-pattern scan for removed emoji/default commit templates.

## Files to create/modify (with specific function signatures)

### Create
- `node_modules/super-ralph/src/components/commit-policy.ts`
  - `export const DEFAULT_ALLOWED_COMMIT_TYPES: readonly ["feat", "fix", "docs", "chore"]`
  - `export type CommitPolicy = { allowedTypes: string[]; requireAtomicChecks: boolean }`
  - `export function parseCommitType(commitMessage: string): string | null`
  - `export function normalizeCommitPolicy(input: unknown): CommitPolicy`
  - `export function assertCommitMessageAllowed(commitMessage: string, policy: CommitPolicy): void`

- `tests/unit/workflow/commit-policy.test.ts`
  - `function assertThrowsPolicyError(fn: () => unknown, pattern: RegExp): void`

- `tests/unit/workflow/commit-policy-prompts.test.ts`
  - `function readPromptSource(relativePath: string): string`
  - `function assertCommitAllowlistContract(source: string, context: string): void`

### Modify
- `node_modules/super-ralph/src/components/index.ts`
  - export `CommitPolicy`, `normalizeCommitPolicy`, `assertCommitMessageAllowed`

- `node_modules/super-ralph/src/components/ticket-gates.ts`
  - `function assertAtomicCheckDiscipline(commands: string[]): void`
  - `export const resolveVerifyCommands(params: ResolveTicketGateSelectionParams): string[]`

- `node_modules/super-ralph/src/components/SuperRalph.tsx`
  - `type SuperRalphProps["commitConfig"]` adds `allowedTypes?: string[]`
  - integrate `normalizeCommitPolicy(...)`
  - pass `allowedCommitTypes` + `atomicCheckCommands` props to prompt components

- `node_modules/super-ralph/src/components/InterpretConfig.tsx`
  - `interpretConfigOutputSchema` adds `commitPolicy` object
  - prompt hard requirements include commit type allowlist + per-atomic verification discipline

- `node_modules/super-ralph/src/cli/fallback-config.ts`
  - `export function buildFallbackConfig(...)` returns `commitPolicy: { allowedTypes: string[]; requireAtomicChecks: boolean }`

- `node_modules/super-ralph/src/cli/index.ts`
  - `function renderWorkflowFile(params: { ... }): string` includes commit-policy field in generated runtime config contract (if additional runtime normalization is required)

- `.super-ralph/generated/workflow.tsx`
  - regenerated artifact with commit policy serialized in `FALLBACK_CONFIG`

- Prompt files:
  - `node_modules/super-ralph/src/prompts/Implement.mdx`
  - `node_modules/super-ralph/src/prompts/ReviewFix.mdx`
  - `node_modules/super-ralph/src/prompts/Test.mdx`
  - `node_modules/super-ralph/src/prompts/BuildVerify.mdx`
  - `node_modules/super-ralph/src/prompts/Plan.mdx`
  - `node_modules/super-ralph/src/prompts/Research.mdx`
  - `node_modules/super-ralph/src/prompts/UpdateProgress.mdx`

- Type declarations:
  - `src/types/super-ralph/components.d.ts`
  - `src/types/super-ralph/cli-fallback-config.d.ts`

- Tests:
  - `tests/unit/workflow/ticket-gates.test.ts`
  - `tests/unit/workflow/super-ralph-wiring.test.tsx`
  - `tests/unit/workflow/interpret-config-guardrails.test.tsx`
  - `tests/unit/workflow/generated-workflow-gates.test.ts`
  - `tests/integration/workflow-gate-policy.integration.test.ts`
  - `tests/unit/workflow/patch-regression.test.ts`

- Patch artifact:
  - `patches/super-ralph-codex-schema.patch`

## Tests to write (unit + integration)

### Unit tests
- `tests/unit/workflow/commit-policy.test.ts`
  - parse conventional commit type from valid messages
  - reject non-allowlisted commit types and malformed subject prefixes
  - normalize input policy (dedupe/sanitize/fail-closed defaults)

- `tests/unit/workflow/ticket-gates.test.ts`
  - verify command resolution fails when discipline contract is broken (missing `typecheck` or missing runnable test command)
  - verify existing category mapping still returns runnable per-ticket checks

- `tests/unit/workflow/super-ralph-wiring.test.tsx`
  - implement/review-fix prompt props include policy allowlist and atomic check command arrays
  - defaults remain deterministic when `commitConfig.allowedTypes` is omitted

- `tests/unit/workflow/commit-policy-prompts.test.ts`
  - prompt commit sections enforce `feat|fix|docs|chore` allowlist
  - prompt commit sections remove emoji/default `type(scope)` placeholders
  - prompt commit sections require checks before each `jj describe`

- `tests/unit/workflow/interpret-config-guardrails.test.tsx`
  - interpret schema requires `commitPolicy`
  - interpret prompt includes hard requirements for allowed commit types + per-atomic checks

- `tests/unit/workflow/generated-workflow-gates.test.ts`
  - generated `FALLBACK_CONFIG` includes commit policy defaults
  - generated runtime config still preserves gate command behavior and safety policy wiring

- `tests/unit/workflow/patch-regression.test.ts`
  - patch contains commit-policy module + export hunks
  - patch contains updated prompt contract hunks with allowlist/no-emoji markers

### Integration tests
- `tests/integration/workflow-gate-policy.integration.test.ts`
  - fallback config for this repo exposes commit policy allowlist (`feat|fix|docs|chore`) and `requireAtomicChecks=true`
  - ticket gate resolution still guarantees `typecheck + relevant test` commands for representative categories
  - generated workflow constants keep required root script keys while carrying commit policy contract

## Risks and mitigations
1. **Risk:** commit-message regex may be too strict and reject legitimate scopes/subjects.
   **Mitigation:** keep parser focused on AGENTS-required type prefix only and cover edge-case scopes in unit tests.

2. **Risk:** prompt string assertions become brittle after harmless wording edits.
   **Mitigation:** assert stable semantic markers (allowlisted types present, emoji placeholders absent, check-before-commit instructions present) rather than full snapshots.

3. **Risk:** stronger discipline checks could break categories with custom commands.
   **Mitigation:** enforce presence of one runnable `typecheck` command and one runnable test command, while preserving existing category fallback behavior.

4. **Risk:** `node_modules` edits disappear on reinstall.
   **Mitigation:** refresh `patches/super-ralph-codex-schema.patch` and guard with patch-regression coverage.

5. **Risk:** workflow could appear compliant while generated artifact drifts.
   **Mitigation:** include generated-workflow unit assertions plus integration checks against real repo fallback config.

## How to verify against acceptance criteria
1. **Allowed commit types are machine-enforced/linted**
   - `bun test tests/unit/workflow/commit-policy.test.ts`
   - `bun test tests/unit/workflow/commit-policy-prompts.test.ts`

2. **Atomic change discipline requires typecheck + relevant tests**
   - `bun test tests/unit/workflow/ticket-gates.test.ts`
   - `bun test tests/unit/workflow/super-ralph-wiring.test.tsx`
   - `bun test tests/integration/workflow-gate-policy.integration.test.ts`

3. **Runtime/generator config carries policy contract**
   - `bun test tests/unit/workflow/interpret-config-guardrails.test.tsx`
   - `bun test tests/unit/workflow/generated-workflow-gates.test.ts`

4. **Patch durability for super-ralph customizations**
   - `bun test tests/unit/workflow/patch-regression.test.ts`

5. **Type safety for touched workflow surfaces**
   - `bun run typecheck`

6. **Manual policy scan (quick guardrail)**
   - `rg -n "📝|🐛 fix|EMOJI|type\(scope\)" node_modules/super-ralph/src/prompts/{Implement,ReviewFix,Test,BuildVerify,Plan,Research,UpdateProgress}.mdx`

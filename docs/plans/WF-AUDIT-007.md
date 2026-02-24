# WF-AUDIT-007 Plan: Make Generated Workflow Configuration Portable (TDD First)

## Overview of the approach
This slice removes machine-specific absolute paths from generated workflow configuration and replaces them with repo-relative path resolution.

The work is split across three seams:
1. Workflow template generation in `super-ralph` CLI (`renderWorkflowFile`) so generated imports/constants are portable.
2. Fallback config generation (`buildFallbackConfig`) so `specsPath` and `referenceFiles` are emitted as repo-relative values.
3. Regression durability (generated artifact assertions + patch assertions) so absolute paths cannot silently reappear.

This remains core-first: path normalization and generation logic are covered by tests before artifact and patch refresh.

## TDD step order (tests before implementation)
1. **Unit test (RED):** extend `tests/unit/workflow/generated-workflow-gates.test.ts` with `test("workflow artifact uses portable import specifiers")` to fail if generated source contains absolute import strings (for example `from "/` or `node_modules/super-ralph/src`).
   **Implement (GREEN):** update `node_modules/super-ralph/src/cli/index.ts` by extracting import selection into:
   - `function resolveWorkflowImportPrefix(params: { isSuperRalphRepo: boolean; runningFromSource: boolean }): string`
   and remove absolute-source import emission in favor of portable package/relative imports.

2. **Unit test (RED):** extend `tests/unit/workflow/generated-workflow-gates.test.ts` with `test("workflow artifact resolves repo paths at runtime without hardcoded absolute constants")` asserting generated source defines runtime path helpers and no longer serializes absolute `REPO_ROOT`/`DB_PATH`/`PROMPT_SPEC_PATH` literals.
   **Implement (GREEN):** update `renderWorkflowFile(...)` template in `node_modules/super-ralph/src/cli/index.ts` to emit:
   - `function resolveRepoRootFromWorkflowFile(): string`
   - `function resolveRepoPath(pathFromRepoRoot: string): string`
   and compute runtime paths from workflow-file location.

3. **Unit test (RED):** create `tests/unit/workflow/fallback-config-portability.test.ts` with `test("toRepoRelativePath normalizes absolute/relative inputs into repo-relative paths")`.
   **Implement (GREEN):** add helper in `node_modules/super-ralph/src/cli/fallback-config.ts`:
   - `export function toRepoRelativePath(repoRoot: string, pathValue: string): string`
   to normalize prompt/spec candidates into portable repo-relative strings.

4. **Unit test (RED):** in `tests/unit/workflow/fallback-config-portability.test.ts`, add `test("buildFallbackConfig emits repo-relative specsPath/referenceFiles")` for both in-repo spec candidates and absolute `promptSpecPath` input.
   **Implement (GREEN):** update `buildFallbackConfig(...)` in `node_modules/super-ralph/src/cli/fallback-config.ts` to:
   - choose specs candidates from relative path list
   - check existence via `join(repoRoot, relativeCandidate)`
   - store `specsPath` and prompt-derived `referenceFiles` as repo-relative values.

5. **Integration test (RED):** extend `tests/integration/workflow-gate-policy.integration.test.ts` with `test("fallback config path fields are portable in real repo wiring")` asserting `specsPath` and `referenceFiles` are non-absolute and reproducible.
   **Implement (GREEN):** reconcile integration expectations with the updated fallback config contract (relative paths only).

6. **Unit test (RED):** extend `tests/unit/workflow/generated-workflow-gates.test.ts` with `test("serialized FALLBACK_CONFIG path fields are repo-relative in generated artifact")`.
   **Implement (GREEN):** regenerate `.super-ralph/generated/workflow.tsx` from updated CLI so committed artifact reflects portable path output.

7. **Unit regression test (RED):** extend `tests/unit/workflow/patch-regression.test.ts` with assertions that CLI/fallback-config patch hunks include portability helpers and do not include absolute-path template branches.
   **Implement (GREEN):** refresh `patches/super-ralph-codex-schema.patch` so reinstalling dependencies preserves portability logic.

8. **Verification pass:** run targeted workflow tests + typecheck and confirm acceptance criteria with explicit absolute-path scan of generated artifact.

## Files to create/modify (with specific function signatures)

### Create
- `tests/unit/workflow/fallback-config-portability.test.ts`
  - `function makeTempRepoFixture(): string`
  - `function assertRepoRelative(pathValue: string): void`

### Modify
- `node_modules/super-ralph/src/cli/index.ts`
  - `function resolveWorkflowImportPrefix(params: { isSuperRalphRepo: boolean; runningFromSource: boolean }): string`
  - `function renderWorkflowFile(params: { promptText: string; promptSpecPath: string; repoRoot: string; dbPath: string; packageScripts: Record<string, string>; detectedAgents: { claude: boolean; codex: boolean }; fallbackConfig: any; clarificationSession: any | null }): string`
  - generated template helpers:
    - `function resolveRepoRootFromWorkflowFile(): string`
    - `function resolveRepoPath(pathFromRepoRoot: string): string`

- `node_modules/super-ralph/src/cli/fallback-config.ts`
  - `export function toRepoRelativePath(repoRoot: string, pathValue: string): string`
  - `export function buildFallbackConfig(repoRoot: string, promptSpecPath: string, packageScripts: Record<string, string>): { specsPath: string; referenceFiles: string[]; buildCmds: Record<string, string>; testCmds: Record<string, string>; preLandChecks: string[]; postLandChecks: string[]; agentSafetyPolicy: { riskyModeEnabled: boolean; approvalRequiredPhases: string[] }; maxConcurrency: number; [key: string]: unknown }`

- `.super-ralph/generated/workflow.tsx`
  - regenerated artifact with runtime repo-path resolution and repo-relative fallback config fields

- `tests/unit/workflow/generated-workflow-gates.test.ts`
- `tests/integration/workflow-gate-policy.integration.test.ts`
- `tests/unit/workflow/patch-regression.test.ts`
- `patches/super-ralph-codex-schema.patch`

## Tests to write (unit + integration)

### Unit tests
- `tests/unit/workflow/generated-workflow-gates.test.ts`
  - fails on absolute import specifiers in generated workflow source
  - fails when `REPO_ROOT`/`DB_PATH`/`PROMPT_SPEC_PATH` are hardcoded absolute literals
  - fails when serialized `FALLBACK_CONFIG.specsPath` or `referenceFiles` contain absolute paths

- `tests/unit/workflow/fallback-config-portability.test.ts`
  - `toRepoRelativePath` converts absolute repo-internal paths to stable relative values
  - `toRepoRelativePath` preserves already-relative config-safe values
  - `buildFallbackConfig` emits repo-relative `specsPath` and prompt reference path

- `tests/unit/workflow/patch-regression.test.ts`
  - patch contains portability helper hunks in `src/cli/fallback-config.ts`
  - patch contains runtime repo-path helper/import-prefix updates in `src/cli/index.ts`
  - patch no longer includes absolute-source import template markers

### Integration tests
- `tests/integration/workflow-gate-policy.integration.test.ts`
  - fallback config for this repo uses repo-relative `specsPath`/`referenceFiles`
  - fallback config generated for temporary fixture repos remains portable and deterministic
  - existing gate command policy behavior remains unchanged after path portability refactor

## Risks and mitigations
1. **Risk:** removing absolute source imports may break local `runningFromSource` execution when module resolution differs by environment.
   **Mitigation:** add explicit unit assertions for import prefix strategy and run integration suite that exercises fallback config + generated artifact contracts.

2. **Risk:** path normalization can accidentally emit `..` traversal or platform-specific separators.
   **Mitigation:** centralize normalization in `toRepoRelativePath(...)` and add unit coverage for normalization edge cases.

3. **Risk:** string-based generated artifact tests can be brittle across harmless formatting/template changes.
   **Mitigation:** assert semantic markers (helper function names + absolute-path absence patterns) rather than full block snapshots.

4. **Risk:** `node_modules` edits are lost on reinstall.
   **Mitigation:** refresh `patches/super-ralph-codex-schema.patch` and enforce new patch-regression assertions.

## How to verify against acceptance criteria
1. `bun test tests/unit/workflow/fallback-config-portability.test.ts`
   - validates repo-relative path normalization and fallback config emission.

2. `bun test tests/unit/workflow/generated-workflow-gates.test.ts`
   - validates generated artifact has no hardcoded absolute import/config paths.

3. `bun test tests/integration/workflow-gate-policy.integration.test.ts`
   - validates repo-level portability contract while preserving gate policy behavior.

4. `bun test tests/unit/workflow/patch-regression.test.ts`
   - validates portability logic is persisted in patch hunks.

5. `bun run typecheck`
   - validates type safety for touched workflow/CLI surfaces.

6. `rg -n 'from \"/|\"/Users/|[A-Za-z]:\\\\' .super-ralph/generated/workflow.tsx`
   - explicit scan confirming generated artifact no longer embeds machine-specific absolute paths.

## Review-Fix TDD Evidence (2026-02-24)
- RED: `bun test tests/unit/workflow/patch-regression.test.ts` failed after adding portability assertions for patch durability (`const REPO_ROOT = resolveRepoRootFromWorkflowFile();` missing in patch artifact contract checks).
- GREEN: regenerated `patches/super-ralph-codex-schema.patch`, tightened patch assertions to target added hunks, then `bun test tests/unit/workflow/patch-regression.test.ts` passed.
- RED: `bun test tests/unit/workflow/cli-fallback-config-types.test.ts` failed for missing `FallbackConfig` declaration fields (`projectName`, `projectId`, `focuses`, `codeStyle`, `reviewChecklist`, `maxConcurrency`).
- GREEN: updated `src/types/super-ralph/cli-fallback-config.d.ts`, then `bun test tests/unit/workflow/cli-fallback-config-types.test.ts` passed.
- Verification: `bun run typecheck` and workflow portability suite (`generated-workflow-gates`, `fallback-config-portability`, `patch-regression`, `workflow-gate-policy`, `cli-fallback-config-types`) passed.

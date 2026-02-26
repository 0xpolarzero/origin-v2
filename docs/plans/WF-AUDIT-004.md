# WF-AUDIT-004 Plan: Replace No-Op Verification Gates With Enforceable Checks (TDD First)

## Overview of the approach
`package.json` already defines real `test`/`typecheck` scripts, so this ticket is now about enforcement consistency:
1. remove remaining no-op fallback behavior (`echo` placeholders / soft-fail command patterns) from ticket gate resolution,
2. ensure generated workflow output is in sync with strict generator wiring and never bakes in placeholder checks,
3. preserve the behavior in the local `super-ralph` patch and guard it with focused regression tests.

Implementation stays core-first for workflow infrastructure: gate resolution logic and generated workflow contract are hardened before any broader workflow execution changes.

## TDD step order (tests before implementation)
1. **Test:** `tests/unit/workflow/ticket-gates.test.ts` adds a case that `resolveCategoryTestCommand(...)` fails when `testCmds` is empty (instead of returning an `echo` placeholder).
   **Implement:** update `node_modules/super-ralph/src/components/ticket-gates.ts` so fallback resolution throws a hard error when no runnable test command exists.

2. **Test:** `tests/unit/workflow/ticket-gates.test.ts` adds a case that `resolveTicketGateSelection(...)` fails if resolved verify/validation commands are missing or non-runnable.
   **Implement:** add strict command validation in `ticket-gates.ts` (for example via a dedicated helper) and apply it before returning `verifyCommands`, `validationCommands`, and `testSuites`.

3. **Integration Test:** `tests/integration/workflow-gate-policy.integration.test.ts` adds assertions that resolved gate commands do not contain placeholder/no-op patterns (for example `No ... configured yet`, `|| echo`) and remain real `bun run ...` commands for this repo.
   **Implement:** harden command filtering/validation in `ticket-gates.ts` so category/default command selection cannot emit placeholder or soft-fail strings.

4. **Test:** create `tests/unit/workflow/generated-workflow-gates.test.ts` to parse `.super-ralph/generated/workflow.tsx` and assert:
   - `PACKAGE_SCRIPTS` includes `typecheck` and `test`,
   - `FALLBACK_CONFIG.buildCmds` / `FALLBACK_CONFIG.testCmds` contain runnable commands (no placeholder echoes),
   - `preLandChecks` and `postLandChecks` are populated from real command maps.
   **Implement:** regenerate or update `.super-ralph/generated/workflow.tsx` so committed generated output reflects real script-derived gate commands.

5. **Test:** `tests/unit/workflow/generated-workflow-gates.test.ts` adds assertions that generated workflow wiring uses runtime merge helpers (`mergeCommandMap`, `resolveRuntimeConfig`) and passes `runtimeConfig` to both `<SuperRalph />` and `<Monitor />`.
   **Implement:** update `node_modules/super-ralph/src/cli/index.ts` `renderWorkflowFile(...)` template if needed, then regenerate `.super-ralph/generated/workflow.tsx`.

6. **Test:** `tests/unit/workflow/patch-regression.test.ts` adds assertions that patch hunks no longer include `echo "No test command configured yet"` fallback in `ticket-gates.ts` and do include strict runtime merge wiring in CLI output generation.
   **Implement:** refresh `patches/super-ralph-codex-schema.patch` from updated `node_modules/super-ralph/src` changes.

7. **Integration Test:** `tests/integration/workflow-gate-policy.integration.test.ts` adds script contract assertions for `package.json` (`test`, `typecheck`, and category-relevant scripts) to ensure gate prerequisites remain defined and non-empty.
   **Implement:** adjust `package.json` scripts only if any required script is missing/drifting; keep commands pinned and runnable.

## Files to create/modify (with specific function signatures)

### Create
- `tests/unit/workflow/generated-workflow-gates.test.ts`
  - `function extractConstJson<T = unknown>(source: string, constName: string): T`
  - `function assertNoPlaceholderCommands(commands: string[], context: string): void`

### Modify
- `node_modules/super-ralph/src/components/ticket-gates.ts`
  - `function defaultTestCommand(testCmds: Record<string, string>): string` (change from placeholder return to hard-fail behavior)
  - `function uniqueCommands(commands: string[]): string[]`
  - `export const resolveCategoryTestCommand(ticketCategory: string, testCmds: Record<string, string>): string`
  - `export const resolveVerifyCommands(params: ResolveTicketGateSelectionParams): string[]`
  - `export const resolveTicketGateSelection(params: ResolveTicketGateSelectionParams): TicketGateSelection`

- `node_modules/super-ralph/src/cli/index.ts`
  - `function mergeCommandMap(fallback: Record<string, string>, candidate: unknown): Record<string, string>`
  - `function resolveRuntimeConfig(ctx: any): { buildCmds: Record<string, string>; testCmds: Record<string, string>; preLandChecks: string[]; postLandChecks: string[] }`
  - `function renderWorkflowFile(params: { ... }): string` (ensure generated contract includes strict runtime config wiring)

- `.super-ralph/generated/workflow.tsx`
  - regenerate committed artifact from updated generator output (real gate commands; no placeholder `echo` checks).

- `tests/unit/workflow/ticket-gates.test.ts`
- `tests/unit/workflow/patch-regression.test.ts`
- `tests/integration/workflow-gate-policy.integration.test.ts`
- `patches/super-ralph-codex-schema.patch`
- `package.json` (only if script contract requires normalization)

## Tests to write (unit + integration)

### Unit tests
- `tests/unit/workflow/ticket-gates.test.ts`
  - fails when no runnable test command can be resolved
  - resolved verify/validation command sets reject placeholder/no-op commands

- `tests/unit/workflow/generated-workflow-gates.test.ts`
  - generated workflow constants include real `test`/`typecheck` script-derived gate commands
  - generated workflow uses runtime config merge (`mergeCommandMap` + `resolveRuntimeConfig`)
  - generated workflow does not contain placeholder gate strings

- `tests/unit/workflow/patch-regression.test.ts`
  - patch contains strict ticket-gate fallback behavior and runtime config merge hunks
  - patch no longer preserves placeholder `echo` gate fallback strings

### Integration tests
- `tests/integration/workflow-gate-policy.integration.test.ts`
  - gate config maps repo scripts to runnable commands (`bun run ...`)
  - per-category gate selection includes `typecheck` + relevant test command
  - resolved gate commands do not include placeholder/no-op patterns
  - package script prerequisites for gates remain present

## Risks and mitigations
1. **Risk:** Generated workflow artifact drifts from generator template and silently reintroduces placeholders.
   **Mitigation:** add dedicated generated-workflow contract test and keep regeneration step explicit in ticket implementation.

2. **Risk:** Stricter gate resolution (throwing instead of echo fallback) can break repos that truly lack required scripts.
   **Mitigation:** keep failure message explicit and pair with package script contract tests so breakage is immediate and actionable.

3. **Risk:** Patch drift after dependency reinstall can undo enforcement.
   **Mitigation:** strengthen `patch-regression` tests to cover both strict ticket-gate fallback behavior and runtime-config merge wiring.

4. **Risk:** String-based assertions for generated files can become brittle with template formatting changes.
   **Mitigation:** parse constant blocks where possible and keep text assertions focused on stable behavioral markers.

## How to verify against acceptance criteria
1. **Real `typecheck` and test scripts are defined and used**
   - `tests/integration/workflow-gate-policy.integration.test.ts` verifies required scripts exist and map to runnable commands.

2. **No-op verification gates are replaced by enforceable checks**
   - `tests/unit/workflow/ticket-gates.test.ts` verifies empty/invalid gate resolution hard-fails.
   - `tests/unit/workflow/generated-workflow-gates.test.ts` verifies generated workflow contains real gate commands, not placeholder echoes.

3. **Workflow wiring fails builds when checks fail**
   - Gate commands are real shell commands (`bun run ...`) consumed by merge queue CI, which already fails on non-zero exit status.
   - `tests/integration/workflow-gate-policy.integration.test.ts` verifies enforceable command shape for representative ticket categories.

4. **Slice verification commands**
   - `bun test tests/unit/workflow/ticket-gates.test.ts`
   - `bun test tests/unit/workflow/generated-workflow-gates.test.ts`
   - `bun test tests/unit/workflow/patch-regression.test.ts`
   - `bun test tests/integration/workflow-gate-policy.integration.test.ts`
   - `bun run typecheck`

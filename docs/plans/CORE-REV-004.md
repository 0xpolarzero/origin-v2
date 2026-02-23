# CORE-REV-004 Plan: Establish Core-First Test/Typecheck Gates (TDD First)

## Overview
The repository already has `test` and `typecheck` scripts, but delivery-loop enforcement is still brittle:
- fallback gate commands can silently degrade to no-op `echo` commands,
- `preLandChecks` is defined but not used in ticket execution,
- category-specific test gates are not selected deterministically per ticket slice.

Approach:
1. Add pure gate-resolution helpers in Super Ralph so command selection is deterministic and testable.
2. Write unit tests first for fallback command generation, category-to-test mapping, and per-ticket gate selection.
3. Wire helpers into CLI fallback config + `SuperRalph` ticket phases so each slice runs `typecheck` plus relevant tests before review/fix.
4. Keep the behavior codified in the local Super Ralph patch and verify with integration tests against real repo scripts.

## TDD Step Order (tests first, then implementation)

1. **Test:** `tests/unit/workflow/gate-config.test.ts` -> `buildGateCommandConfig derives base build/test commands from package scripts and never returns no-op echo fallbacks when scripts exist`.
   **Implement:** `node_modules/super-ralph/src/cli/gate-config.ts` -> `buildGateCommandConfig(runner: ScriptRunner, packageScripts: Record<string, string>): GateCommandConfig`.

2. **Test:** `tests/unit/workflow/gate-config.test.ts` -> `buildGateCommandConfig maps focus-specific test scripts (core/api/workflow/db) and keeps test as default fallback`.
   **Implement:** `node_modules/super-ralph/src/cli/gate-config.ts` -> `resolveFocusTestCommands(runner: ScriptRunner, packageScripts: Record<string, string>): Record<string, string>`.

3. **Test:** `tests/unit/workflow/gate-config.test.ts` -> `assertRequiredGateScripts fails when test/typecheck scripts are missing`.
   **Implement:** `node_modules/super-ralph/src/cli/gate-config.ts` -> `assertRequiredGateScripts(packageScripts: Record<string, string>): void`.

4. **Test:** `tests/unit/workflow/ticket-gates.test.ts` -> `resolveTicketGateSelection chooses typecheck + category-relevant test for core tickets`.
   **Implement:** `node_modules/super-ralph/src/components/ticket-gates.ts` -> `resolveTicketGateSelection(params: ResolveTicketGateSelectionParams): TicketGateSelection`.

5. **Test:** `tests/unit/workflow/ticket-gates.test.ts` -> `resolveTicketGateSelection chooses category-relevant test for api/workflow tickets and falls back to default test command for unknown categories`.
   **Implement:** `node_modules/super-ralph/src/components/ticket-gates.ts` -> `resolveCategoryTestCommand(ticketCategory: string, testCmds: Record<string, string>): string`.

6. **Test:** `tests/unit/workflow/ticket-gates.test.ts` -> `resolveTicketGateSelection reuses configured preLandChecks when present, but always includes at least one relevant test command`.
   **Implement:** `node_modules/super-ralph/src/components/ticket-gates.ts` -> `resolveVerifyCommands(params: ResolveTicketGateSelectionParams): string[]`.

7. **Test:** `tests/unit/workflow/super-ralph-wiring.test.tsx` -> `SuperRalph passes ticket-scoped verify commands to ImplementPrompt`.
   **Implement:** `node_modules/super-ralph/src/components/SuperRalph.tsx` -> wire `verifyCommands={ticketGateSelection.verifyCommands}`.

8. **Test:** `tests/unit/workflow/super-ralph-wiring.test.tsx` -> `SuperRalph passes ticket-scoped suites to TestPrompt (instead of global all-suite fallback)`.
   **Implement:** `node_modules/super-ralph/src/components/SuperRalph.tsx` -> wire `testSuites={ticketGateSelection.testSuites}`.

9. **Test:** `tests/unit/workflow/super-ralph-wiring.test.tsx` -> `SuperRalph uses the same ticket-scoped validation commands in ReviewFixPrompt`.
   **Implement:** `node_modules/super-ralph/src/components/SuperRalph.tsx` -> wire `validationCommands={ticketGateSelection.validationCommands}`.

10. **Test:** `tests/unit/workflow/interpret-config-guardrails.test.ts` -> `interpret config hard requirements preserve typecheck/tests gate fields and non-empty pre/post land arrays`.
    **Implement:** `node_modules/super-ralph/src/components/InterpretConfig.tsx` -> tighten prompt/schema guidance for gate command fields and required reasoning.

11. **Integration Test:** `tests/integration/workflow-gate-policy.integration.test.ts` -> `CLI fallback config and ticket gate resolver produce runnable commands for this repo (core/api/workflow)`.
    **Implement:** `node_modules/super-ralph/src/cli/index.ts` -> replace inline fallback assembly with `buildGateCommandConfig`, and keep config merge deterministic.

12. **Integration Test:** `tests/integration/workflow-gate-policy.integration.test.ts` -> `package.json scripts required by gate resolver exist and map to current test slices`.
    **Implement:** `package.json` -> ensure `test`, `typecheck`, and slice scripts remain present; add/normalize any missing gate aliases required by resolver.

13. **Test:** `tests/unit/workflow/patch-regression.test.ts` -> `local super-ralph patch contains gate helper wiring changes (protects against dependency reinstall drift)`.
    **Implement:** `patches/super-ralph-codex-schema.patch` -> include `gate-config.ts`, `ticket-gates.ts`, and updated CLI/component hunks; regenerate patch content from applied source edits.

## Files to Create/Modify (with specific function signatures)

### Create
- `tests/unit/workflow/gate-config.test.ts`
- `tests/unit/workflow/ticket-gates.test.ts`
- `tests/unit/workflow/super-ralph-wiring.test.tsx`
- `tests/unit/workflow/interpret-config-guardrails.test.ts`
- `tests/unit/workflow/patch-regression.test.ts`
- `tests/integration/workflow-gate-policy.integration.test.ts`
- `node_modules/super-ralph/src/cli/gate-config.ts`
  - `export type ScriptRunner = "bun" | "pnpm" | "yarn" | "npm"`
  - `export type GateCommandConfig = { buildCmds: Record<string, string>; testCmds: Record<string, string>; preLandChecks: string[]; postLandChecks: string[] }`
  - `export const assertRequiredGateScripts: (packageScripts: Record<string, string>) => void`
  - `export const resolveFocusTestCommands: (runner: ScriptRunner, packageScripts: Record<string, string>) => Record<string, string>`
  - `export const buildGateCommandConfig: (runner: ScriptRunner, packageScripts: Record<string, string>) => GateCommandConfig`
- `node_modules/super-ralph/src/components/ticket-gates.ts`
  - `export type ResolveTicketGateSelectionParams = { ticketCategory: string; buildCmds: Record<string, string>; testCmds: Record<string, string>; preLandChecks: string[] }`
  - `export type TicketGateSelection = { verifyCommands: string[]; validationCommands: string[]; testSuites: Array<{ name: string; command: string; description: string }> }`
  - `export const resolveCategoryTestCommand: (ticketCategory: string, testCmds: Record<string, string>) => string`
  - `export const resolveVerifyCommands: (params: ResolveTicketGateSelectionParams) => string[]`
  - `export const resolveTicketGateSelection: (params: ResolveTicketGateSelectionParams) => TicketGateSelection`

### Modify
- `node_modules/super-ralph/src/cli/index.ts`
  - consume `buildGateCommandConfig` inside `buildFallbackConfig(...)`
  - keep/adjust merge behavior so fallback gate commands are always present when interpret output is partial
- `node_modules/super-ralph/src/components/SuperRalph.tsx`
  - resolve per-ticket gate selection and use it in Implement/Test/ReviewFix prompt wiring
- `node_modules/super-ralph/src/components/InterpretConfig.tsx`
  - keep schema fields explicit and reinforce gate-command requirements in prompt hard constraints
- `package.json`
  - confirm/normalize required script entries used by gate resolution: `test`, `typecheck`, `test:core`, `test:integration:api`, `test:integration:workflow`, `test:integration:db`
- `patches/super-ralph-codex-schema.patch`
  - refresh patch to include all source changes above so dependency reinstall keeps gate behavior

## Tests to Write

### Unit tests
- `tests/unit/workflow/gate-config.test.ts`
  - derives gate command maps from package scripts using runner-aware command prefixes
  - fails clearly when `test` or `typecheck` scripts are missing
  - emits category command keys (`core`, `api`, `workflow`, `db`) when corresponding scripts exist
- `tests/unit/workflow/ticket-gates.test.ts`
  - category mapping for `core`, `api`, `workflow`
  - fallback mapping for unknown category -> default `test`
  - verify-command composition includes typecheck + relevant test when `preLandChecks` is empty
- `tests/unit/workflow/super-ralph-wiring.test.tsx`
  - implement phase receives ticket-scoped gate commands
  - test phase receives ticket-scoped suites
  - review-fix uses same validation command set as implement/test loop
- `tests/unit/workflow/interpret-config-guardrails.test.ts`
  - config schema/prompt continue to require build/test command objects + pre/post land arrays
- `tests/unit/workflow/patch-regression.test.ts`
  - patch file includes key hunks for gate helper files and Super Ralph wiring (drift guard)

### Integration tests
- `tests/integration/workflow-gate-policy.integration.test.ts`
  - builds gate config from this repo's real `package.json` scripts and confirms commands are runnable command strings (`bun run ...`)
  - resolves ticket gates for representative categories (`core`, `api`, `workflow`) and confirms each includes `typecheck` plus the category-relevant test command
  - validates that fallback + per-ticket resolver output aligns with delivery loop requirement: implement -> typecheck + relevant tests -> review/fix

## Risks and Mitigations

1. **Risk:** Super Ralph dependency patch drifts after reinstall or version bump.
   **Mitigation:** keep all behavior in `patches/super-ralph-codex-schema.patch` and add patch-regression unit coverage.

2. **Risk:** Category labels in tickets may not exactly match expected keys (`core`, `api`, `workflow`).
   **Mitigation:** implement explicit normalization/fallback logic in `resolveCategoryTestCommand` and test unknown-category behavior.

3. **Risk:** Overly strict gate requirements could break bootstrap scenarios in non-Origin repos.
   **Mitigation:** scope strict `assertRequiredGateScripts` to this workflow path and provide clear failure messages with missing script names.

4. **Risk:** Wiring changes could accidentally run full suites for every slice and slow the loop.
   **Mitigation:** unit-test ticket-scoped suite selection and assert only one category-relevant suite is selected by default.

5. **Risk:** Changes in `InterpretConfig` output may omit required gate fields.
   **Mitigation:** keep schema-required gate fields and fallback merge behavior so command sets never collapse to empty/no-op.

## How to Verify Against Acceptance Criteria

1. **`test` and `typecheck` scripts are defined and used as required gates**
   - verify with `tests/unit/workflow/gate-config.test.ts` and `package.json` assertions.

2. **Per-slice gates are enforced (typecheck + relevant tests)**
   - verify with `tests/unit/workflow/ticket-gates.test.ts` and `tests/unit/workflow/super-ralph-wiring.test.tsx`.

3. **Delivery loop wiring matches `docs/engineering.choices.md:16-26`**
   - verify with `tests/integration/workflow-gate-policy.integration.test.ts` that ticket gate selection is category-aware and includes typecheck before review/fix.

4. **Patched dependency behavior is stable/reproducible**
   - verify with `tests/unit/workflow/patch-regression.test.ts` and refreshed `patches/super-ralph-codex-schema.patch`.

5. **Slice quality gate commands pass for this ticket’s changed slice**
   - run:
     - `bun test tests/unit/workflow/gate-config.test.ts`
     - `bun test tests/unit/workflow/ticket-gates.test.ts`
     - `bun test tests/unit/workflow/super-ralph-wiring.test.tsx`
     - `bun test tests/unit/workflow/interpret-config-guardrails.test.ts`
     - `bun test tests/integration/workflow-gate-policy.integration.test.ts`
     - `bun run typecheck`

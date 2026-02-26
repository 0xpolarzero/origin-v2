# WF-AUDIT-006 Plan: Add Safety Gates for Automation Agent Execution (TDD First)

## Overview of the approach
This slice hardens workflow-agent execution so unsafe automation is never the implicit default.

The implementation direction is:
1. Fail closed at agent configuration time (`yolo`/`dangerouslySkipPermissions`/bypass flags disabled by default).
2. Make risky execution an explicit opt-in runtime mode.
3. Require Smithers approval gates (`needsApproval`) on risky ticket phases when risky mode is enabled.
4. Lock behavior with unit, integration, and patch-regression tests so unsafe defaults cannot silently return.

This stays core-first: policy helpers and workflow wiring are hardened before any runtime behavior changes.

## TDD step order (tests before implementation)
1. **Unit test (RED):** `tests/unit/workflow/generated-workflow-gates.test.ts` adds assertions that generated workflow source does not hardcode permissive flags (`dangerouslySkipPermissions: true`, `yolo: true`) and instead includes explicit safety-policy wiring.
   **Implement (GREEN):** update `node_modules/super-ralph/src/cli/index.ts` `renderWorkflowFile(...)` template to emit a safety config object and remove hardcoded permissive defaults.

2. **Unit test (RED):** add a targeted policy helper test file `tests/unit/workflow/agent-safety-policy.test.ts` that verifies fail-closed defaults and risky-mode phase gating resolution.
   **Implement (GREEN):** create `node_modules/super-ralph/src/components/agent-safety-policy.ts` with pure helpers:
   - `export type AgentSafetyPolicy = { riskyModeEnabled: boolean; approvalRequiredPhases: string[] }`
   - `export function normalizeAgentSafetyPolicy(input: unknown): AgentSafetyPolicy`
   - `export function requiresApprovalForPhase(phase: string, policy: AgentSafetyPolicy): boolean`

3. **Unit test (RED):** `tests/unit/workflow/super-ralph-wiring.test.tsx` adds assertions that risky phases are **not** approval-gated when policy is default-safe.
   **Implement (GREEN):** extend `node_modules/super-ralph/src/components/SuperRalph.tsx` props with `agentSafetyPolicy?: AgentSafetyPolicy` and wire default-safe behavior.

4. **Unit test (RED):** `tests/unit/workflow/super-ralph-wiring.test.tsx` adds assertions that risky phases (`implement`, `review-fix`, `land`) set `needsApproval={true}` when risky mode is enabled.
   **Implement (GREEN):** apply `requiresApprovalForPhase(...)` to those `Task` nodes in `SuperRalph.tsx`.

5. **Unit test (RED):** `tests/unit/workflow/super-ralph-wiring.test.tsx` adds an allowlist case (for example `approvalRequiredPhases: ["land"]`) proving only selected risky phase(s) are gated.
   **Implement (GREEN):** finalize phase normalization/allowlist logic in `agent-safety-policy.ts` and `SuperRalph.tsx`.

6. **Unit test (RED):** `tests/unit/workflow/generated-workflow-gates.test.ts` adds assertions that generated `createClaude(...)`/`createCodex(...)` helpers force explicit `yolo: false` in safe mode and only set dangerous flags when risky policy is enabled.
   **Implement (GREEN):** update generated template in `node_modules/super-ralph/src/cli/index.ts`:
   - `function resolveAgentSafetyPolicy(): AgentSafetyPolicy`
   - `function createClaude(systemPrompt: string, policy: AgentSafetyPolicy): ClaudeCodeAgent`
   - `function createCodex(systemPrompt: string, policy: AgentSafetyPolicy): CodexAgent`
   - `function choose(primary: "claude" | "codex", systemPrompt: string, policy: AgentSafetyPolicy)`

7. **Integration test (RED):** `tests/integration/workflow-gate-policy.integration.test.ts` adds policy-level assertions that the committed generated workflow artifact and runtime gate config together enforce safe defaults and carry approval-gating policy into `<SuperRalph />`.
   **Implement (GREEN):** regenerate `.super-ralph/generated/workflow.tsx` from updated template and keep artifact in sync.

8. **Unit regression test (RED):** `tests/unit/workflow/patch-regression.test.ts` adds assertions that patch hunks include agent safety policy wiring and `needsApproval` task gating markers.
   **Implement (GREEN):** refresh `patches/super-ralph-codex-schema.patch` so reinstalls preserve safety gates.

9. **Integration verification (RED/GREEN):** run only workflow-policy slice checks to validate no regressions in existing gate contracts.
   **Implement (GREEN):** adjust any brittle assertions to stable behavioral markers (policy constants/function names + absence of unsafe defaults) without loosening guarantees.

## Files to create/modify (with specific function signatures)

### Create
- `tests/unit/workflow/agent-safety-policy.test.ts`
  - `function buildPolicy(overrides?: Partial<AgentSafetyPolicy>): AgentSafetyPolicy`
- `node_modules/super-ralph/src/components/agent-safety-policy.ts`
  - `export type AgentSafetyPolicy = { riskyModeEnabled: boolean; approvalRequiredPhases: string[] }`
  - `export function normalizeAgentSafetyPolicy(input: unknown): AgentSafetyPolicy`
  - `export function requiresApprovalForPhase(phase: string, policy: AgentSafetyPolicy): boolean`

### Modify
- `node_modules/super-ralph/src/cli/index.ts`
  - `function renderWorkflowFile(params: { ... }): string`
  - generated helper signatures inside template:
    - `function resolveAgentSafetyPolicy(): AgentSafetyPolicy`
    - `function createClaude(systemPrompt: string, policy: AgentSafetyPolicy): ClaudeCodeAgent`
    - `function createCodex(systemPrompt: string, policy: AgentSafetyPolicy): CodexAgent`
    - `function choose(primary: "claude" | "codex", systemPrompt: string, policy: AgentSafetyPolicy)`

- `node_modules/super-ralph/src/components/SuperRalph.tsx`
  - `export type SuperRalphProps = { ...; agentSafetyPolicy?: AgentSafetyPolicy; ... }`
  - gate wiring via `needsApproval={requiresApprovalForPhase("<phase>", agentSafetyPolicy)}` on risky phases

- `.super-ralph/generated/workflow.tsx`
  - regenerated artifact reflecting safety-policy helpers and safe defaults

- `tests/unit/workflow/generated-workflow-gates.test.ts`
- `tests/unit/workflow/super-ralph-wiring.test.tsx`
- `tests/unit/workflow/patch-regression.test.ts`
- `tests/integration/workflow-gate-policy.integration.test.ts`
- `patches/super-ralph-codex-schema.patch`

## Tests to write (unit + integration)

### Unit tests
- `tests/unit/workflow/agent-safety-policy.test.ts`
  - defaults to safe mode (no risky execution, empty/normalized phase handling)
  - risky mode requires explicit enable signal and preserves configured approval phases
  - unknown/invalid phases are ignored or rejected deterministically (fail-closed)

- `tests/unit/workflow/generated-workflow-gates.test.ts`
  - generated workflow does not contain hardcoded permissive `true` dangerous flags
  - generated workflow contains safety-policy helpers and policy-aware agent constructors
  - generated workflow explicitly sets safe defaults (`yolo: false`) when risky mode is off

- `tests/unit/workflow/super-ralph-wiring.test.tsx`
  - default-safe policy keeps `needsApproval` off for risky phases
  - risky policy enables `needsApproval` for `implement`, `review-fix`, `land`
  - phase allowlist gating only marks specified phases

- `tests/unit/workflow/patch-regression.test.ts`
  - patch includes safety-policy helper/module hunk
  - patch includes `SuperRalph` `needsApproval` gate wiring hunks
  - patch guards against reintroduction of hardcoded permissive defaults

### Integration tests
- `tests/integration/workflow-gate-policy.integration.test.ts`
  - policy integration assertions across gate config + generated workflow artifact
  - confirms safe default posture remains enforced in repo-level workflow wiring
  - confirms risky mode wiring carries explicit approval gates into runtime component config

## Risks and mitigations
1. **Risk:** `BaseCliAgent` defaults `yolo` to `true`; omission could silently stay permissive.
   **Mitigation:** require explicit `yolo: false` in safe mode for all configured coding agents and lock with tests.

2. **Risk:** String-based generated-file assertions can be brittle to template formatting changes.
   **Mitigation:** assert stable policy markers (helper function names/constants) plus semantic absence/presence checks.

3. **Risk:** Approval-gate overreach may block normal workflow runs.
   **Mitigation:** gate only risky phases and only when risky mode is explicitly enabled; keep default-safe mode non-interactive.

4. **Risk:** `node_modules` edits may drift on reinstall.
   **Mitigation:** refresh `patches/super-ralph-codex-schema.patch` and strengthen patch-regression tests for new hunks.

## How to verify against acceptance criteria
1. **Unrestricted defaults removed/gated**
   - `bun test tests/unit/workflow/generated-workflow-gates.test.ts`
   - verifies no hardcoded permissive defaults and policy-aware gating exists.

2. **Risky execution requires explicit approval controls**
   - `bun test tests/unit/workflow/super-ralph-wiring.test.tsx`
   - verifies risky phases require `needsApproval` when risky mode is enabled.

3. **Policy is durable across reinstall/regeneration**
   - `bun test tests/unit/workflow/patch-regression.test.ts`
   - verifies patch contains and preserves safety-gate hunks.

4. **Repo-level workflow policy remains coherent**
   - `bun test tests/integration/workflow-gate-policy.integration.test.ts`
   - validates integrated gate-policy behavior and generated artifact contract.

5. **Type safety for touched slice**
   - `bun run typecheck`

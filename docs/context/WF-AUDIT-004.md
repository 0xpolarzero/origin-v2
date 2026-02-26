# WF-AUDIT-004 Research Context

## Ticket
- ID: `WF-AUDIT-004`
- Title: `Replace no-op verification gates with enforceable checks`
- Category: `architecture`
- Priority: `high`
- Description: Define real `typecheck` and test scripts in `package.json`, then wire `.super-ralph/generated/workflow.tsx` (or its generator) to fail builds when checks fail instead of echoing placeholders.

## Relevant Files Field
- No explicit `relevantFiles` payload is present for `WF-AUDIT-004` in repository ticket metadata.
- Evidence:
  - `.super-ralph/workflow.db` `category_review.suggested_tickets` contains `WF-AUDIT-004` with `id/title/description/category/priority` only.
  - `json_type(ticket, '$.relevantFiles')` resolves to null/empty for `WF-AUDIT-004`.
  - Existing `.super-ralph/workflow.db` rows for `WF-AUDIT-004:research`, `WF-AUDIT-004:plan`, and `WF-AUDIT-004:report` are currently absent.

## Paths Reviewed

| Path | Summary | Relevance to WF-AUDIT-004 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated autonomous prompt (ticket input listed this path twice) requiring per-slice `typecheck + relevant tests` in the delivery loop. | Primary requirement source for enforced verification behavior. |
| `README.md` | Repo overview and source-of-truth docs map. | Confirms canonical docs that define expected gate behavior. |
| `docs/design.spec.md` | Product acceptance bar includes reliability, auditability, and safety-critical workflow behavior. | Motivates strict failing verification gates for workflow correctness. |
| `docs/engineering.choices.md` | Normative quality rule: run `typecheck` + relevant tests per slice; autonomous flow includes validation. | Hard guardrail this ticket must enforce. |
| `docs/references.md` | Reference repo policy; expected `docs/references/*` paths. | Confirms external references policy (local `docs/references/` is currently absent). |
| `docs/super-ralph.prompt.md` | Canonical non-generated prompt mirror of generated prompt constraints. | Reinforces required validation loop behavior. |
| `docs/plans/CORE-REV-004.md` | Prior TDD plan for gate hardening in Super Ralph (gate config, ticket gates, wiring, regression tests). | Closest historical implementation plan for this exact problem area. |
| `docs/context/CORE-REV-004.md` | Prior research documenting no-op fallback risk and required wiring points. | Strong predecessor context; highlights unresolved/stale artifact risks. |
| `.super-ralph/generated/workflow.tsx` | Current generated file has `PACKAGE_SCRIPTS = {}` and fallback commands `echo "No build/typecheck command configured yet"` / `echo "No test command configured yet"`; runtime config uses direct interpreted-or-fallback spread. | Direct artifact named in ticket and current no-op failure mode evidence. |
| `package.json` | Scripts now include real gates: `test`, `typecheck`, and slice scripts (`test:core`, `test:integration:api`, `test:integration:workflow`, `test:integration:db`). | Shows script prerequisites are already in place; wiring/enforcement remains the key issue. |
| `.super-ralph/workflow.db` | Ticket metadata source and persisted `interpret_config` outputs. Recent rows include soft-fail command patterns (for example `... || echo "No tsconfig yet"`). | Confirms metadata and demonstrates current risk of non-failing gate commands at runtime config level. |
| `node_modules/super-ralph/src/cli/index.ts` | Generator template now imports `buildFallbackConfig`, merges interpreted command maps, and resolves runtime pre/post checks. | Primary generator-side implementation point for replacing placeholder behavior in generated workflows. |
| `node_modules/super-ralph/src/cli/fallback-config.ts` | Fallback config built from `buildGateCommandConfig`; derives `preLandChecks`/`postLandChecks` from concrete command maps. | Primary fallback command source used by generator. |
| `node_modules/super-ralph/src/cli/gate-config.ts` | Requires `test` and `typecheck` scripts; maps focus-specific test commands; returns deterministic gate command config. | Core helper that should prevent no-op gate fallback when scripts exist. |
| `node_modules/super-ralph/src/components/InterpretConfig.tsx` | Output schema enforces non-empty `preLandChecks`/`postLandChecks` and prompt hard requirements for gate fields. | Guardrail layer for interpreted config shape. |
| `node_modules/super-ralph/src/components/SuperRalph.tsx` | Resolves ticket-scoped verify/test/validation commands via `resolveTicketGateSelection`; passes `postLandChecks` into merge-queue CI flow. | Runtime wiring point where enforceable commands are consumed. |
| `node_modules/super-ralph/src/components/ticket-gates.ts` | Category-based test selection and verify command composition; unknown default eventually falls back to `echo "No test command configured yet"`. | Secondary no-op fallback risk path if command maps become empty. |
| `node_modules/super-ralph/src/mergeQueue/coordinator.ts` | Executes CI shell commands and fails on non-zero exit code. | Confirms checks are enforceable if command strings are real failing commands (not placeholder echoes). |
| `tests/unit/workflow/gate-config.test.ts` | Verifies deterministic script-derived command maps and required script enforcement. | Unit contract for non-no-op fallback behavior. |
| `tests/unit/workflow/ticket-gates.test.ts` | Verifies typecheck + category-relevant test selection and preLandChecks composition. | Unit contract for per-ticket enforced checks. |
| `tests/unit/workflow/super-ralph-wiring.test.tsx` | Verifies `ImplementPrompt`/`TestPrompt`/`ReviewFixPrompt` receive ticket-scoped gate commands. | Wiring contract for delivery-loop enforcement. |
| `tests/unit/workflow/interpret-config-guardrails.test.tsx` | Verifies schema/prompt guardrails require non-empty gate fields. | Ensures interpret output cannot legally omit gate fields. |
| `tests/unit/workflow/patch-regression.test.ts` | Verifies local patch retains gate helper and wiring hunks. | Drift guard for reinstall/version churn. |
| `tests/integration/workflow-gate-policy.integration.test.ts` | End-to-end config policy assertions against this repo scripts (`bun run typecheck`, category test scripts). | Strongest integration evidence for intended gate policy behavior. |
| `patches/super-ralph-codex-schema.patch` | Local patch defining gate helpers, wiring, exports, and schema guardrails in vendored `super-ralph`. | Persistence mechanism for local gate behavior across installs. |

## Requirements Extracted for This Ticket

### Validation and quality requirements
- `docs/engineering.choices.md` mandates running `typecheck` and relevant tests on each implementation slice.
- `.super-ralph/generated/PROMPT.md` and `docs/super-ralph.prompt.md` require the loop: `plan -> implement -> typecheck + relevant tests -> review/fix -> checkpoint + commit`.
- `AGENTS.md` requires each atomic commit to pass relevant tests/typecheck for the changed slice.

### Architecture requirement implied by ticket
- Verification gates must be executable commands that fail the workflow when checks fail.
- Placeholder echoes are non-compliant because they can return success regardless of code health.

## Current Implementation Snapshot

1. `package.json` already satisfies the script-definition portion of the ticket:
   - `test`
   - `typecheck`
   - `test:core`
   - `test:integration:api`
   - `test:integration:workflow`
   - `test:integration:db`
2. Current generated workflow artifact (`.super-ralph/generated/workflow.tsx`) is stale and still contains no-op placeholders plus empty `PACKAGE_SCRIPTS`.
3. Current `super-ralph` source in `node_modules` appears more strict than the generated artifact:
   - fallback generation is script-driven (`buildFallbackConfig` + `buildGateCommandConfig`),
   - required scripts are enforced,
   - runtime config merging is explicit.
4. Merge queue CI actually enforces exit codes, so replacing no-op commands with real scripts makes failures hard-fail automatically.

## Key Gaps / Risks To Address in WF-AUDIT-004

1. **Generated artifact drift:** `.super-ralph/generated/workflow.tsx` does not reflect current gate-helper logic in `node_modules/super-ralph/src/cli/index.ts`.
2. **Placeholder command survivability:** any path that emits `echo "No ... configured yet"` produces false-green verification.
3. **Interpret output quality:** persisted `interpret_config` rows show permissive command patterns (`|| echo ...`) that can mask failures even when fields are non-empty.
4. **Default fallback in ticket gates:** `defaultTestCommand` can still return placeholder echo when `testCmds` are empty.
5. **Patch/source alignment risk:** behavior is partially maintained via `patches/super-ralph-codex-schema.patch`; drift between patch, installed source, and generated artifact can reintroduce no-op gates.

## Derived File Focus for Implementation
(derived because ticket metadata has no `relevantFiles`)

### Primary targets
- `.super-ralph/generated/workflow.tsx` (if fixing artifact directly)
- `node_modules/super-ralph/src/cli/index.ts` (if fixing generator output template)
- `node_modules/super-ralph/src/cli/fallback-config.ts`
- `node_modules/super-ralph/src/cli/gate-config.ts`
- `node_modules/super-ralph/src/components/ticket-gates.ts`
- `patches/super-ralph-codex-schema.patch`

### Verification/contract files
- `tests/unit/workflow/gate-config.test.ts`
- `tests/unit/workflow/ticket-gates.test.ts`
- `tests/unit/workflow/super-ralph-wiring.test.tsx`
- `tests/unit/workflow/interpret-config-guardrails.test.tsx`
- `tests/unit/workflow/patch-regression.test.ts`
- `tests/integration/workflow-gate-policy.integration.test.ts`

### Supporting config
- `package.json`

## Suggested Verification Commands for the Implementation Phase
- `bun run typecheck`
- `bun test tests/unit/workflow/gate-config.test.ts`
- `bun test tests/unit/workflow/ticket-gates.test.ts`
- `bun test tests/unit/workflow/super-ralph-wiring.test.tsx`
- `bun test tests/unit/workflow/interpret-config-guardrails.test.tsx`
- `bun test tests/unit/workflow/patch-regression.test.ts`
- `bun test tests/integration/workflow-gate-policy.integration.test.ts`

## Research Summary
- The script-definition half of WF-AUDIT-004 is already present in `package.json`.
- The core remaining problem is enforcement consistency across three layers: generated workflow artifact, generator source, and runtime interpreted commands.
- The highest-priority implementation move is to eliminate placeholder/no-op command fallbacks and ensure every verification command path maps to real failing checks.

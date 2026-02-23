# CORE-REV-004 Research Context

## Ticket
- ID: `CORE-REV-004`
- Title: `Establish core-first test/typecheck gates`
- Category: `testing`
- Priority: `high`
- Description: Add `test` and `typecheck` scripts in `package.json`, enforce per-slice gates, and wire them to the delivery loop required by `docs/engineering.choices.md:16-26`.

## Relevant Files Field
- No explicit `relevantFiles` payload is present for `CORE-REV-004` in repository-stored ticket metadata.
- Evidence:
  - `.super-ralph/workflow.db` stores suggested tickets in `category_review.suggested_tickets`.
  - The `CORE-REV-004` ticket object includes `id`, `title`, `description`, `category`, and `priority` only.
  - SQL check of `json_type(ticket, '$.relevantFiles')` for `CORE-REV-004` resolves to null/empty.

## Paths Reviewed

| Path | Summary | Relevance to CORE-REV-004 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated autonomous prompt (ticket input listed this path twice). Requires per-slice flow: plan -> implement -> run typecheck + relevant tests -> review/fix -> checkpoint/commit. | Primary requirement source for delivery-loop gate wiring. |
| `README.md` | Repo overview with canonical source-of-truth docs list. | Confirms required docs for implementation intent and constraints. |
| `AGENTS.md` | Repo agent rules include: commit each atomic piece and pass relevant tests/typecheck for the changed slice. | Direct quality/compliance requirement for per-slice gates. |
| `docs/design.spec.md` | Product/workflow scope and auditability/recovery expectations. | Context for why test gates must remain strict as workflows expand. |
| `docs/engineering.choices.md` | Normative rule set: core-first gate (`16-20`), quality rule to run typecheck + relevant tests each implementation slice (`25`), and autonomous validation expectation (`37-43`). | Directly cited acceptance requirement for this ticket. |
| `docs/references.md` | Expected external reference submodules under `docs/references/*`. | Confirms reference policy; these submodules are absent locally during research. |
| `docs/super-ralph.prompt.md` | Canonical prompt mirror of generated prompt constraints. | Reinforces delivery-loop behavior requirements. |
| `.super-ralph/generated/workflow.tsx` | Current generated workflow has `PACKAGE_SCRIPTS = {}` and fallback no-op commands (`echo "No build/typecheck command configured yet"`, `echo "No test command configured yet"`). Runtime uses interpret-config output when present, otherwise fallback. | Shows current gate-wiring risk if interpret-config output is absent/invalid. |
| `.super-ralph/workflow.db` | Stores `category_review` ticket metadata and actual `interpret_config` outputs used by workflow runs. | Source of truth for missing `relevantFiles` and current runtime gate command behavior. |
| `package.json` | Scripts currently include `test` and `typecheck` plus slice-specific commands (`test:unit:core`, `test:core`, `test:integration:api`, `test:integration:workflow`, `test:integration:db`). | Confirms script baseline is mostly present; remaining work is deterministic per-slice enforcement and loop wiring. |
| `patches/super-ralph-codex-schema.patch` | Patch intentionally changed fallback commands to non-failing no-op echoes when no scripts are detected. | Explains why fallback can silently bypass real gates if config/script detection fails. |
| `node_modules/super-ralph/src/cli/index.ts` | `buildFallbackConfig` derives `buildCmds/testCmds` from `package.json` scripts (`typecheck`, `test`) but defaults to non-failing echo commands if missing. | Identifies where delivery-loop gate commands are generated and where fallback weakens enforcement. |
| `node_modules/super-ralph/src/components/InterpretConfig.tsx` | Interpret-config prompt includes package scripts and fallback config; structured output returns `buildCmds`, `testCmds`, `preLandChecks`, `postLandChecks`. | Shows agent-config layer that must carry test/typecheck gates into runtime. |
| `node_modules/super-ralph/src/components/SuperRalph.tsx` | Implementation phase receives `verifyCommands` from `buildCmds`; test phase uses `testCmds`; merge queue uses `postLandChecks` or `testCmds`. `preLandChecks` is defined in props but not currently used in execution flow. | Key delivery-loop integration points and likely gap for per-slice fast gate enforcement. |
| `node_modules/super-ralph/src/prompts/Implement.mdx` | Implementation prompt includes explicit “Step 4: Verify” command list from `verifyCommands`. | Confirms where typecheck/build gate instructions are injected for each ticket slice. |
| `node_modules/super-ralph/src/prompts/Test.mdx` | Test prompt runs all configured test suites and reports pass/fail and TDD verification notes. | Confirms where per-slice test suites are injected and enforced in agent behavior. |
| `node_modules/super-ralph/src/prompts/BuildVerify.mdx` | Build-verify phase asks for full CI-equivalent verification but depends on provided commands/config. | Relevant for strengthening deterministic typecheck gate behavior. |
| `docs/plans/CORE-REV-001.md` | Earlier plan explicitly included adding `test`/`typecheck` scripts and running per-slice checks. | Historical design intent for this ticket’s scope. |
| `docs/context/CORE-REV-001.md` | Prior research captured initial requirement to run tests/typecheck per atomic slice. | Continuity reference for ticket motivation and quality bar. |
| `docs/context/CORE-REV-002.md` | Notes that typecheck/unit/integration scripts are now present. | Confirms progress from script absence to partial gate infrastructure. |
| `docs/context/CORE-REV-003.md` | Documents persistence ticket using same research format and gate expectations. | Format continuity and workflow compliance baseline. |
| `docs/context/API-001.md` | API ticket research references existing script gates (`test:integration:api`, `typecheck`). | Confirms cross-category reliance on script-based checks. |
| `docs/context/API-002.md` | Data ticket research includes targeted verification command set and typecheck gate. | Pattern reference for per-slice command targeting. |
| `docs/context/WF-AUDIT-001.md` | Workflow audit research references same script/typecheck guardrails. | Pattern reference for workflow slice verification coverage. |
| `docs/context/WF-AUDIT-002.md` | Most recent workflow audit context records script/test gate usage and route/schema validation pattern. | Useful precedent for documenting delivery-loop compliance details. |
| `docs/test-suite-findings.md` | Earlier status report recorded initial setup steps for test scripts and integration suites. | Historical context for why this ticket still exists as explicit gating hardening work. |

## Spec and Guardrail Requirements Extracted for This Ticket

### Core-first and slice validation requirements
From `docs/engineering.choices.md:16-26`:
- UI-facing features must follow core-first order: implement core first, add comprehensive core tests, then integrate UI.
- Each implementation slice must run typecheck and relevant tests.

From `docs/engineering.choices.md:37-43` and prompt docs:
- Super Ralph flow must validate typecheck/tests as part of autonomous execution.
- Delivery loop is explicit: `plan -> implement -> typecheck + relevant tests -> review/fix -> checkpoint + commit`.

From `AGENTS.md`:
- Every atomic commit must pass relevant tests/typecheck for that changed slice.

## Current Gate Baseline (What Already Exists)

1. `package.json` already contains `test` and `typecheck` scripts, plus several slice-focused scripts:
   - `test:unit:core`
   - `test:core`
   - `test:integration:core`
   - `test:integration:db`
   - `test:integration:api`
   - `test:integration:workflow`
2. Super Ralph runtime can consume `buildCmds/testCmds` from interpret-config output, and uses those commands in implementation/test/review-fix flow.
3. Latest `interpret_config` rows in `.super-ralph/workflow.db` include non-empty command sets, so current runs are not strictly limited to static fallback.

## Gaps and Risks Relevant to CORE-REV-004

1. Generated workflow fallback still contains no-op gate commands and empty `PACKAGE_SCRIPTS`; if interpret-config output is missing/fails, gate enforcement degrades silently.
2. `preLandChecks` exists in config/schemas but is not wired into execution in `SuperRalph.tsx`; fast per-slice checks are therefore not enforced by engine-level control flow.
3. Per-slice test enforcement is indirect: test phase runs configured suites, but there is no deterministic mapping from ticket category/focus to mandatory script set in repo config.
4. Typecheck is present but not guaranteed as a hard fail gate at every slice when config degrades to fallback no-op commands.
5. `docs/references.md` required submodules are absent locally, limiting external pattern cross-checking for workflow gate design.

## Derived File Focus for CORE-REV-004 Implementation
(derived because ticket metadata has no `relevantFiles`)

### Primary files
- `package.json`
- `.super-ralph/generated/workflow.tsx` (or regeneration path that produces it)
- `node_modules/super-ralph/src/cli/index.ts` (fallback/buildCmds/testCmds generation behavior)
- `node_modules/super-ralph/src/components/SuperRalph.tsx` (pre/post land check wiring and command execution flow)
- `node_modules/super-ralph/src/components/InterpretConfig.tsx` (config output shape and prompt instructions)
- `patches/super-ralph-codex-schema.patch` (if upstream behavior must stay patched while tightening gates)

### Supporting files
- `docs/engineering.choices.md`
- `docs/super-ralph.prompt.md`
- `.super-ralph/generated/PROMPT.md`
- `AGENTS.md`
- `docs/context/*.md` and `docs/plans/*.md` related to CORE/API/WF tickets for per-slice verification patterns.

## Suggested Verification Matrix for Implementation Phase

- Baseline gate commands:
  - `bun run typecheck`
  - `bun run test`
- Slice-targeted commands (example mapping using existing scripts):
  - Core slice: `bun run test:core`
  - API slice: `bun run test:integration:api`
  - Workflow slice: `bun run test:integration:workflow`
  - DB/data slice: `bun run test:integration:db`
- Enforcement expectation:
  - Typecheck + at least one slice-relevant test command must run and fail the slice if unsuccessful.

## Research Summary
- Ticket metadata for `CORE-REV-004` does not provide `relevantFiles`; implementation focus must be derived from script/gate wiring points.
- `test` and `typecheck` scripts already exist in `package.json`; the main remaining work is reliable, deterministic wiring of those gates into the Super Ralph delivery loop and per-slice enforcement behavior.
- Highest-risk gap is fallback/no-op gate behavior in generated workflow/fallback config paths, combined with currently unused `preLandChecks` wiring.

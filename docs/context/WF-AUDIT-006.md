# WF-AUDIT-006 Research Context

## Ticket
- ID: `WF-AUDIT-006`
- Title: `Add safety gates for automation agent execution`
- Category: `code-quality`
- Priority: `high`
- Description: Remove or gate unrestricted agent settings (`dangerouslySkipPermissions`/`yolo`) behind explicit approval controls for risky operations in the automation pipeline.

## Relevant Files Field
- No explicit `relevantFiles` payload is present for `WF-AUDIT-006` in repository ticket metadata.
- Evidence:
  - `.super-ralph/workflow.db` (`category_review.suggested_tickets`) contains `WF-AUDIT-006` with `id/title/description/category/priority` only.
  - SQL extraction against `json_each(suggested_tickets)` returns:
    - `WF-AUDIT-006|Add safety gates for automation agent execution|...|code-quality||`
    - (`json_type(ticket,'$.relevantFiles')` and `json_extract(ticket,'$.relevantFiles')` are null/empty).
  - Current `research`, `plan`, and `report` tables have no rows for `WF-AUDIT-006` yet.

## Paths Reviewed

| Path | Summary | Relevance to WF-AUDIT-006 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated prompt with hard constraints (core-first, test/typecheck per slice, safety/auditability). Ticket input listed this path twice. | Defines mandatory safety and approval posture for automation behavior. |
| `README.md` | Repo map of canonical docs and Super Ralph run command. | Confirms authoritative source files for this research step. |
| `docs/design.spec.md` | Product goals include explicit user control for risky/outbound actions and auditability/recovery for AI changes. | Core product-level requirement backing safety gates for automation execution. |
| `docs/engineering.choices.md` | Normative delivery/quality guardrails and autonomous execution expectations. | Defines enforcement expectations for workflow automation quality and safety behavior. |
| `docs/references.md` | Required reference repositories policy (`docs/references/*`). | Confirms reference-study requirement; no local reference submodules currently present in this workspace. |
| `docs/super-ralph.prompt.md` | Canonical non-generated prompt mirror of generated prompt constraints. | Reinforces explicit approval/safety expectations in autonomous execution. |
| `.super-ralph/workflow.db` | Ticket metadata and persisted run outputs (`category_review`, `research`, `plan`, `report`, etc.). | Source-of-truth evidence for WF-AUDIT-006 metadata and absence of ticket `relevantFiles`. |
| `.super-ralph/generated/workflow.tsx` | Generated runtime workflow file; currently hardcodes `dangerouslySkipPermissions: true` (Claude) and `yolo: true` (Codex). | Primary in-repo artifact exhibiting the unsafe default behavior named in the ticket. |
| `node_modules/super-ralph/src/cli/index.ts` | Generator template used to render `.super-ralph/generated/workflow.tsx`; same hardcoded risky flags in `createClaude`/`createCodex`. | Primary upstream implementation seam to remove/gate unrestricted agent settings. |
| `node_modules/super-ralph/src/components/SuperRalph.tsx` | Defines main ticket pipeline as many `<Task>` nodes (`research/plan/implement/test/review/report/land`). No `needsApproval` usage on tasks. | Shows where explicit runtime approval gates could be wired in the workflow graph if needed. |
| `node_modules/super-ralph/src/cli/gate-config.ts` | Enforces runnable `test`/`typecheck` command gates for build/test verification. | Useful pattern precedent for strict gate enforcement logic (currently command gates, not agent-safety gates). |
| `node_modules/super-ralph/src/cli/fallback-config.ts` | Builds fallback config from script-derived gate commands and errors if commands are unrunnable. | Another strict-gating pattern that can inform agent-safety config validation. |
| `node_modules/super-ralph/src/components/ticket-gates.ts` | Resolves per-ticket verify/test/validation commands and rejects placeholder/no-op commands. | Demonstrates existing “fail closed” gate style that can be mirrored for risky agent settings. |
| `node_modules/super-ralph/README.md` | Usage examples include `yolo: true` in multiple agent snippets. | Documentation currently normalizes unrestricted execution; may require update when safety gates are added. |
| `node_modules/smithers-orchestrator/src/agents/BaseCliAgent.ts` | Base agent option `yolo` defaults to `true` (`this.yolo = opts.yolo ?? true`). | Important inherited default risk; even omitted `yolo` can remain permissive. |
| `node_modules/smithers-orchestrator/src/agents/CodexAgent.ts` | `yolo` (or bypass option) maps to `--dangerously-bypass-approvals-and-sandbox`. | Confirms actual dangerous CLI flag emitted for Codex when permissive mode is on. |
| `node_modules/smithers-orchestrator/src/agents/ClaudeCodeAgent.ts` | `yolo` adds `--dangerously-skip-permissions` and default `--permission-mode bypassPermissions`. | Confirms permissive execution path for Claude agent with bypass behavior. |
| `node_modules/smithers-orchestrator/src/agents/GeminiAgent.ts` | Supports `approvalMode`; if absent and `yolo` is enabled, adds `--yolo`. | Additional evidence of approval-mode-aware pattern in agent wrappers. |
| `node_modules/smithers-orchestrator/src/components/Task.ts` | `Task` supports `needsApproval?: boolean`. | Existing engine-level primitive for human approval gating in workflows. |
| `node_modules/smithers-orchestrator/src/dom/extract.ts` | Extracts `needsApproval` into `TaskDescriptor`. | Confirms approval metadata is persisted into execution descriptors. |
| `node_modules/smithers-orchestrator/src/TaskDescriptor.ts` | Task descriptor includes `needsApproval` field. | Documents formal runtime contract for approval-gated nodes. |
| `node_modules/smithers-orchestrator/src/engine/index.ts` | `needsApproval` tasks transition to `waiting-approval` until approved/denied; run status can become `waiting-approval`. | Confirms orchestrator already supports explicit approval control semantics. |
| `node_modules/smithers-orchestrator/src/engine/approvals.ts` | `approveNode` / `denyNode` update approval state and emit events. | Shows direct mechanism to grant/deny risky actions. |
| `node_modules/smithers-orchestrator/src/db/ensure.ts` | Defines `_smithers_approvals` table schema. | Confirms durable approval audit trail exists in runtime DB. |
| `node_modules/smithers-orchestrator/src/cli/index.ts` | CLI supports `approve`/`deny` commands for nodes and handles `waiting-approval` run status. | Operational interface for explicit approval workflows if wired by Super Ralph tasks. |
| `package.json` | Pins `super-ralph` as GitHub dependency + local patch; workflow scripts and typecheck scripts defined. | Identifies patch-based customization surface and current dependency pin for agent safety changes. |
| `patches/super-ralph-codex-schema.patch` | Local Super Ralph patch currently covers schema/gate wiring; no hunks for `createClaude/createCodex` safety flags. | Shows persistence mechanism exists but currently does not capture agent safety gate logic. |
| `tests/unit/workflow/generated-workflow-gates.test.ts` | Verifies generated workflow gate command maps and runtime merge wiring. | Strong place to add assertions for safe agent default configuration in generated workflow artifact. |
| `tests/unit/workflow/ticket-gates.test.ts` | Verifies strict no-placeholder command gate behavior. | Pattern for adding strict fail-closed unit tests for risky-agent configuration inputs. |
| `tests/unit/workflow/patch-regression.test.ts` | Validates critical patch hunks are retained across reinstalls. | Should be extended to lock in any new safety-gate patch hunks. |
| `tests/integration/workflow-gate-policy.integration.test.ts` | Integration checks for runnable verification/test command policy. | Candidate integration suite to assert new automation-agent safety policy defaults. |
| `docs/context/WF-AUDIT-004.md` | Prior workflow gate-hardening research context. | Immediate predecessor context; provides structure and adjacent findings on workflow enforcement. |
| `docs/context/WF-AUDIT-005.md` | Prior workflow test-coverage research context. | Provides recent context file style and supporting workflow testing references. |
| `/Users/polarzero/.codex/skills/smithers/SKILL.md` | Smithers skill guidance for pipeline phases, gating patterns, and workflow architecture. | Supporting guidance for researching approval/gate mechanisms in Smithers workflows. |

## Requirements Extracted for WF-AUDIT-006

### Product and prompt safety requirements
- Explicit user control is required for risky/outbound actions.
- Safety and auditability requirements must be implemented, not assumed.
- Autonomous workflow execution should not bypass approval controls by default.

### Engineering and delivery constraints
- Core-first and deterministic behavior are required.
- Enforcement should be fail-closed where possible (existing command-gate pattern already follows this).
- Changes should remain compatible with jj-based, test-backed slice delivery.

## Current Implementation Snapshot (Safety-Relevant)
1. The generated workflow (`.super-ralph/generated/workflow.tsx`) hardcodes unrestricted settings:
   - `ClaudeCodeAgent(... dangerouslySkipPermissions: true)`
   - `CodexAgent(... yolo: true)`
2. The generator source (`node_modules/super-ralph/src/cli/index.ts`) emits those same hardcoded values, so regeneration reproduces the unsafe defaults.
3. Smithers agent wrappers convert these options into dangerous CLI flags:
   - Codex: `--dangerously-bypass-approvals-and-sandbox`
   - Claude: `--dangerously-skip-permissions` (+ bypass permission mode when yolo-enabled)
4. `BaseCliAgent` defaults `yolo` to true when not overridden, which broadens risk surface unless explicit safe values are set.
5. Smithers already has explicit approval infrastructure (`Task.needsApproval`, `_smithers_approvals`, `approve`/`deny`, `waiting-approval`), but Super Ralph workflow tasks currently do not use it.
6. Existing workflow gate tests cover build/test command policy, but there is no dedicated test coverage for automation-agent safety mode defaults or approval gating of risky settings.

## Key Gaps To Close in WF-AUDIT-006
1. Unrestricted execution is currently defaulted both in generated artifact and generator template.
2. No explicit approval control currently guards enabling risky agent flags in the automation pipeline.
3. No regression tests currently fail if risky flags (`dangerouslySkipPermissions`/`yolo`) are reintroduced as defaults.
4. Local patch persistence does not yet include safety-gate logic for agent execution settings.

## Derived File Focus for Implementation
(derived because ticket metadata has no `relevantFiles`)

### Primary implementation files
- `node_modules/super-ralph/src/cli/index.ts`
- `.super-ralph/generated/workflow.tsx` (regenerated artifact)
- `patches/super-ralph-codex-schema.patch`

### Approval/gating integration candidates
- `node_modules/super-ralph/src/components/SuperRalph.tsx`
- `node_modules/smithers-orchestrator/src/components/Task.ts`
- `node_modules/smithers-orchestrator/src/engine/index.ts`
- `node_modules/smithers-orchestrator/src/engine/approvals.ts`

### Test and policy guard files
- `tests/unit/workflow/generated-workflow-gates.test.ts`
- `tests/unit/workflow/ticket-gates.test.ts`
- `tests/unit/workflow/patch-regression.test.ts`
- `tests/integration/workflow-gate-policy.integration.test.ts`

### Supporting policy/docs files
- `node_modules/super-ralph/README.md`
- `docs/context/WF-AUDIT-006.md`

## Suggested Verification Commands for Implementation Phase
- `bun run typecheck`
- `bun test tests/unit/workflow/generated-workflow-gates.test.ts`
- `bun test tests/unit/workflow/ticket-gates.test.ts`
- `bun test tests/unit/workflow/patch-regression.test.ts`
- `bun test tests/integration/workflow-gate-policy.integration.test.ts`

## Research Summary
- `WF-AUDIT-006` has no ticket-provided `relevantFiles`; scope must be derived from Super Ralph generator/runtime sources and Smithers approval primitives.
- Current workflow generation hardcodes permissive agent execution flags, and Smithers defaults amplify this risk (`yolo` default true).
- The orchestration stack already has explicit approval infrastructure (`needsApproval`, approval DB/events/CLI), but it is not currently wired to protect risky agent-mode settings.
- Highest-value implementation direction is to make risky agent mode opt-in with explicit approval gating and to lock behavior with unit/integration + patch-regression coverage.

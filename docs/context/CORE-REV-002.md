# CORE-REV-002 Research Context

## Ticket
- ID: `CORE-REV-002`
- Title: Build required core workflow API surfaces
- Category: `spec-compliance`
- Description: Implement capture/triage/planning/approval workflows defined in `docs/design.spec.md:41-48` and scope rules in `docs/design.spec.md:60-64`, including explicit outbound approval gates.

## Relevant Files Field
- No explicit `relevantFiles` list is present for `CORE-REV-002` in repository-stored ticket metadata.
- Evidence:
  - Ticket metadata for `CORE-REV-002` exists in `.super-ralph/workflow.db` (`category_review.suggested_tickets`) with `id/title/description/category/priority` only.
  - Query result for `json_type(value, '$.relevantFiles')` on `CORE-REV-002` is null/empty.
  - `.super-ralph/generated/PROMPT.md` and `.super-ralph/generated/workflow.tsx` contain orchestration config but no per-ticket `relevantFiles` payload for this ticket.

## Paths Reviewed

| Path | Summary | Relevance to CORE-REV-002 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Build prompt constraints: core-first, Effect preference, explicit outbound approvals, per-slice test/typecheck, jj checkpoints. (Path was provided twice in ticket input.) | Defines non-negotiable workflow implementation and safety constraints. |
| `README.md` | Repo overview and authoritative doc pointers. | Confirms source-of-truth docs for this ticket. |
| `docs/design.spec.md` | Required end-to-end workflows (`5. Required end-to-end workflows`) and scope boundaries (`7. Scope boundaries`). | Primary functional requirements for this ticket. |
| `docs/engineering.choices.md` | Normative stack/guardrails including core-first gate and deterministic testable logic. | Delivery and architecture constraints for implementing workflow API surfaces. |
| `docs/references.md` | Required external reference repos and expected `docs/references/*` locations. | Indicates reference inputs expected before major workflow implementation. |
| `docs/super-ralph.prompt.md` | Canonical autonomous prompt matching generated prompt requirements. | Reinforces constraints for approvals, testing, and completion bar. |
| `.super-ralph/generated/workflow.tsx` | Smithers/Super Ralph generated workflow wiring and fallback config. | Confirms research step context and where prompt/reference paths are sourced. |
| `.super-ralph/workflow.db` | Pipeline state + category review tickets; contains `CORE-REV-002` metadata without `relevantFiles`. | Source evidence for missing `relevantFiles` and ticket provenance. |
| `docs/context/CORE-REV-001.md` | Prior research context format + baseline state narrative. | Useful template and continuity reference for next ticket. |
| `docs/plans/CORE-REV-001.md` | Detailed TDD plan for core domain/services/workflow primitives. | Shows prior intended workflow surfaces and their expected signatures. |
| `docs/tdd/CORE-REV-001.review-fix.md` | Review-fix log of behavior hardening and added tests. | Indicates recently stabilized workflow behavior relevant to this ticket. |
| `docs/test-suite-findings.md` | Historical findings doc showing earlier TODO-era status. | Background only; now partially stale versus current implemented tests. |
| `src/core/app/core-platform.ts` | Composition root exposing workflow APIs (capture/triage/planning/approval/job/checkpoint/etc.) and persistence hooks. | Central API surface file this ticket will likely modify/extend. |
| `src/core/services/entry-service.ts` | Capture, AI suggestion, edit/reject suggestion, accept as task + audit transitions. | Implements capture workflow requirements from spec workflow 1. |
| `src/core/services/signal-service.ts` | Signal triage and conversion to task/event/note/project/outbound draft + audit. | Implements major parts of signal workflow requirements from spec workflow 2. |
| `src/core/services/task-service.ts` | Task planning transitions: complete, defer, reschedule + audit. | Implements planning loop transition requirements from spec workflow 3. |
| `src/core/services/event-service.ts` | Local event to `pending_approval` transition and approval notification generation. | Implements first half of event approval workflow from spec workflow 4. |
| `src/core/services/approval-service.ts` | Explicit approval gate before outbound execution; strict validation for `event_sync`. | Implements outbound approval checks; key surface for explicit gate enforcement. |
| `src/core/services/job-service.ts` | Record inspect/retry job run lifecycle + audit transitions. | Implements automation inspect/retry workflow from spec workflow 6. |
| `src/core/services/checkpoint-service.ts` | Checkpoint create/keep/recover with rollback snapshots and audit records. | Implements AI update keep/recover workflow from spec workflow 7. |
| `src/core/repositories/core-repository.ts` | Repository contract with entity persistence + audit trail APIs. | Boundary used by all workflow services for local-first + auditability. |
| `src/core/repositories/in-memory-core-repository.ts` | Deterministic in-memory persistence implementation with cloned reads/writes. | Baseline local-first behavior for core workflow tests. |
| `src/core/repositories/file-core-repository.ts` | Snapshot persistence/load for restart durability and local-first storage. | Supports scope boundary requirement for local-first authored data durability. |
| `src/core/domain/entry.ts` | Entry states include `captured/suggested/rejected/accepted_as_task`. | State model for capture + suggestion decision workflow. |
| `src/core/domain/signal.ts` | Signal triage states (`untriaged/triaged/converted/rejected`). | State model for signal triage and conversion workflow. |
| `src/core/domain/task.ts` | Task lifecycle state (`planned/completed/deferred`) and schedule fields. | State model for planning loop transitions. |
| `src/core/domain/event.ts` | Event sync states (`local_only/pending_approval/synced`). | State model for approval-gated external sync workflow. |
| `src/core/domain/checkpoint.ts` | Checkpoint status (`created/kept/recovered`) and rollback snapshot data. | State model for auditability/recovery workflow. |
| `src/core/domain/job.ts` | Job run state machine (`idle/running/succeeded/failed/retrying`). | State model for automation inspect/retry workflow. |
| `src/core/domain/common.ts` | Core entity types include `outbound_draft`; shared actor/id/timestamp primitives. | Shared type foundation; outbound draft appears here for approval flows. |
| `tests/integration/core-platform.integration.test.ts` | End-to-end tests for entry->task, planning + checkpoint, and restart persistence. | Validates required core workflow API surfaces at platform level. |
| `tests/integration/api-data.integration.test.ts` | Integration tests for capture persistence, explicit approval enforcement, and restart pending state. | Directly validates approval gate and local-first boundaries for this ticket. |
| `tests/integration/workflow-automation.integration.test.ts` | Integration tests for planning transitions, job inspect/retry, and checkpoint keep/recover. | Validates required planning/automation/recovery workflows in spec section 5. |
| `tests/unit/core/services/entry-service.test.ts` | Unit coverage for capture/suggest/edit/reject/accept entry workflows. | Confirms behavior details for capture workflow API surface. |
| `tests/unit/core/services/signal-service.test.ts` | Unit coverage for triage + conversion targets including `outbound_draft`. | Confirms signal conversion behavior and unsupported-target handling. |
| `tests/unit/core/services/task-service.test.ts` | Unit coverage for complete/defer/reschedule transitions. | Confirms planning loop transition correctness. |
| `tests/unit/core/services/event-service.test.ts` | Unit coverage for event sync request -> pending approval + notification. | Confirms approval precondition generation for event sync. |
| `tests/unit/core/services/approval-service.test.ts` | Unit coverage for explicit approval enforcement + event preconditions. | Confirms outbound gate behavior and validation order. |
| `tests/unit/core/services/job-service.test.ts` | Unit coverage for run recording, inspect, and retry lifecycle. | Confirms automation workflow semantics. |
| `tests/unit/core/services/checkpoint-service.test.ts` | Unit coverage for checkpoint create/keep/recover and rollback behavior. | Confirms auditability/recovery behavior expected by scope boundaries. |
| `package.json` | Scripts for typecheck + unit/integration suites now present. | Confirms available verification commands for this ticket slice. |

## Spec Requirements Extracted (CORE-REV-002 Scope)

### Required workflows (`docs/design.spec.md:41-48`)
- Capture -> persist -> AI suggestion -> user accept/edit/reject -> structured entity.
- Signal ingestion -> triage -> convert to task/event/note/project or outbound draft.
- Planning loop -> adjust schedule -> complete/defer/reschedule.
- Local event -> pending approval -> external sync on explicit approval.
- Outbound draft -> explicit approval -> execute.
- Automation run -> inspect -> retry/fix.
- AI-applied update -> inspect -> keep/recover.

### Scope boundaries (`docs/design.spec.md:60-64`)
- Local-first authored data must exist.
- Core workflows above must be complete and reliable.
- Explicit approval is required for outbound actions.
- AI writes must be auditable and reversible.

## Current Workflow API Coverage (as implemented)

| Spec workflow | Current API surfaces | Status | Notes |
| --- | --- | --- | --- |
| Capture -> persist -> suggest -> accept/edit/reject | `captureEntry`, `suggestEntryAsTask`, `editEntrySuggestion`, `rejectEntrySuggestion`, `acceptEntryAsTask` (service + platform) | Implemented | Covered in unit + integration tests. |
| Signal ingestion -> triage -> convert | `triageSignal`, `convertSignal` (service + platform); `createSignalEntity` exported at service level | Partial | Triage/convert present; ingestion surface is not exposed on `CorePlatform` today. |
| Planning loop transitions | `completeTask`, `deferTask`, `rescheduleTask` | Implemented | Covered by unit + workflow integration tests. |
| Local event -> pending approval -> external sync | `requestEventSync` + `approveOutboundAction` (`event_sync`) | Implemented | Enforces `pending_approval` precondition for event sync. |
| Outbound draft -> explicit approval -> execute | `convertSignal(... targetType: 'outbound_draft')` + `approveOutboundAction` (`outbound_draft`) | Partial | Approval call exists, but no explicit outbound-draft state transition/notification/audit lifecycle analogous to events. |
| Automation run -> inspect -> retry/fix | `recordJobRun`, `inspectJobRun`, `retryJobRun` | Implemented | Covered in unit + integration tests. |
| AI-applied update -> inspect -> keep/recover | `createWorkflowCheckpoint`, `keepCheckpoint`, `recoverCheckpoint` + audit trail queries | Implemented | Recovery path and audit transitions covered in tests. |

## Scope-Boundary Compliance Snapshot
- Local-first authored data: satisfied via in-memory/file repositories and snapshot load/persist paths.
- Core workflows complete/reliable: mostly satisfied; signal ingestion surface and outbound-draft approval lifecycle are still partial.
- Explicit outbound approval gates: event sync path is strongly gated; outbound-draft path currently lacks equivalent pre-execution state gating/audit transition behavior.
- Auditable, reversible AI writes: checkpoint + audit transition model supports keep/recover rollback.

## Gaps to Resolve in CORE-REV-002 Implementation Phase
1. Add/standardize signal ingestion API surface (platform-facing), not just triage/conversion.
2. Define explicit outbound-draft approval lifecycle state(s) and transition(s) before execute.
3. Enforce outbound-draft preconditions in `approveOutboundAction` similar to `event_sync` pending-state checks.
4. Persist outbound-draft approval execution result and append audit transition(s) for traceability.
5. Add/adjust tests for the outbound-draft explicit-approval gate and lifecycle transitions at unit + integration level.

## Proposed File Focus for Implementation (in absence of ticket `relevantFiles`)
- `src/core/app/core-platform.ts`
- `src/core/services/signal-service.ts`
- `src/core/services/approval-service.ts`
- `src/core/domain/common.ts` (or new outbound-draft domain module if introduced)
- `tests/unit/core/services/signal-service.test.ts`
- `tests/unit/core/services/approval-service.test.ts`
- `tests/integration/api-data.integration.test.ts`
- `tests/integration/workflow-automation.integration.test.ts`

## Reference Material Availability Note
- `docs/references.md` lists required external repositories under `docs/references/*`, but `docs/references/` submodules are not present in this workspace at research time.

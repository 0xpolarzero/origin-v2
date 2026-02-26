# WF-AUDIT-005 Research Context

## Ticket
- ID: `WF-AUDIT-005`
- Title: `Create workflow automation test suite with edge cases`
- Category: `test-coverage`
- Priority: `high`
- Description: Add core and integration tests covering empty inputs, approval denial/auth failures, conflict/retry behavior, and recovery correctness for workflow automation.

## Relevant Files Field
- No explicit `relevantFiles` payload is present for `WF-AUDIT-005` in repository ticket metadata.
- Evidence:
  - `.super-ralph/workflow.db` (`category_review.suggested_tickets`) includes `WF-AUDIT-005` with `id/title/description/category/priority` only.
  - SQL check against `json_each(suggested_tickets)` returns `WF-AUDIT-005||` for `json_type(...,'$.relevantFiles')` and `json_extract(...,'$.relevantFiles')`.
  - `.super-ralph/workflow.db` currently has no `WF-AUDIT-005` rows in `research`, `plan`, or `report` tables.

## Paths Reviewed

| Path | Summary | Relevance to WF-AUDIT-005 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated autonomous prompt requiring core-first implementation and per-slice `typecheck + relevant tests`. Ticket input listed this path twice. | Primary delivery/quality constraints for this test-coverage ticket. |
| `.super-ralph/generated/workflow.tsx` | Runtime config references `README.md` and `docs`; workflow gate config maps `test:integration:workflow` to workflow integration suites. | Shows where workflow test coverage is enforced in automation. |
| `.super-ralph/workflow.db` | Source of ticket metadata and historical run outputs. | Source-of-truth evidence for missing `relevantFiles` and ticket status. |
| `README.md` | Repo source-of-truth map for design, engineering, references, and prompt docs. | Confirms authoritative documents for this research phase. |
| `docs/design.spec.md` | Defines required workflows: explicit approvals, automation inspect/retry/fix, AI keep/recover; also requires clear empty/error states and auditable/reversible AI writes. | Functional requirements the edge-case suite must prove. |
| `docs/engineering.choices.md` | Hard core-first rule and requirement for comprehensive core tests and per-slice validation. | Mandates this ticket focus on core and integration tests before UI concerns. |
| `docs/references.md` | Lists expected reference submodules (`docs/references/*`). | Confirms reference policy; local reference submodule files are not present in this workspace. |
| `docs/super-ralph.prompt.md` | Canonical prompt mirror of generated prompt constraints. | Reinforces test and safety requirements for autonomous workflow implementation. |
| `docs/test-suite-findings.md` | Historical workflow testing gap report (initial TODO-era status). | Background for why WF-AUDIT test tickets exist. |
| `docs/context/WF-AUDIT-001.md` | Prior workflow core research context and style baseline. | Historical continuity and file-selection pattern reference. |
| `docs/context/WF-AUDIT-003.md` | Research for Jobs/Activity workflow surfaces and route coverage. | Upstream context for current workflow automation surface behavior. |
| `docs/context/WF-AUDIT-004.md` | Most recent workflow context and gate-enforcement coverage. | Adjacent precedent for documenting derived file focus and verification commands. |
| `docs/plans/WF-AUDIT-002.md` | TDD plan that introduced explicit `job.listHistory` and HTTP dispatch tests. | Historical API/integration pattern reference for workflow automation tests. |
| `docs/plans/WF-AUDIT-003.md` | TDD plan for Jobs/Activity surface orchestration tests. | Pattern reference for integration-level workflow test composition. |
| `tests/integration/workflow-automation.integration.test.ts` | Existing workflow integration suite for planning transitions, job retry flow, and checkpoint recovery consistency. | Primary target suite for this ticket; currently lacks explicit approval/auth edge cases. |
| `tests/integration/workflow-surfaces.integration.test.ts` | End-to-end Jobs/Activity surface orchestration and typed error mapping. | Existing integration coverage for retry and recovery actions from surface layer. |
| `tests/integration/workflow-api.integration.test.ts` | API integration tests for approval denial, duplicate conflict, outbound approval flow, retry/fix, and checkpoint recovery. | Contains several target edge cases but outside `test:integration:workflow` script scope. |
| `tests/integration/workflow-api-http.integration.test.ts` | HTTP integration tests for whitespace invalid input (400), auth/forbidden (403), not found (404), conflict (409), and sanitized error payloads. | Strong edge-case coverage source; also currently outside workflow integration script scope. |
| `tests/unit/core/services/approval-service.test.ts` | Unit tests for approval denial, auth failure, duplicate conflicts, rollback-on-failure, and outbound execution edge cases. | Core behavior baseline for approval denial/auth/conflict coverage. |
| `tests/unit/core/services/job-service.test.ts` | Unit tests for retry metadata, history ordering/filtering, missing-job failures, and transaction boundaries. | Core retry behavior baseline; potential place to add conflict/retry edge semantics. |
| `tests/unit/core/services/checkpoint-service.test.ts` | Unit tests for create/keep/recover transitions, conflict states, invalid snapshot, and restoration correctness. | Core recovery correctness baseline for additional edge-case assertions. |
| `tests/unit/core/services/entry-service.test.ts` | Service tests for capture and conversion flows. | Candidate file to add explicit empty-input service-level coverage. |
| `tests/unit/core/domain/entry.test.ts` | Only happy-path `createEntry` test is present. | Gap indicator: missing domain empty-content negative case despite validator presence. |
| `tests/unit/core/domain/signal.test.ts` | Only happy-path `createSignal` test is present. | Gap indicator: missing empty-source/empty-payload domain negative tests. |
| `tests/unit/core/domain/outbound-draft.test.ts` | Includes explicit empty payload/source validation tests. | Useful pattern for adding missing empty-input cases in other domain tests. |
| `src/core/app/core-platform.ts` | Core facade exposing capture/approval/job/checkpoint methods used by integration tests. | Primary integration harness surface for workflow automation edge-case tests. |
| `src/core/services/approval-service.ts` | Implements explicit approval requirement, actor authorization, conflict checks, and rollback logic. | Core logic under test for denial/auth/conflict edge cases. |
| `src/core/services/job-service.ts` | Implements run record/retry/list/history with validation and transaction boundaries. | Core logic under test for retry behavior and failure-mode assertions. |
| `src/core/services/checkpoint-service.ts` | Implements keep/recover conflict checks and snapshot restoration semantics. | Core logic under test for recovery correctness and invalid snapshot behavior. |
| `src/core/services/entry-service.ts` | Uses `createEntry` domain validation for capture inputs. | Core logic path for empty capture input edge cases. |
| `src/core/domain/common.ts` | `validateNonEmpty` helper used by domain constructors. | Defines expected behavior for empty-input validation assertions. |
| `src/core/domain/entry.ts` | Validates non-empty `content` when creating entries. | Indicates intended empty-input failure behavior not yet tested at domain level. |
| `src/api/workflows/contracts.ts` | Route set includes approval, retry/history, checkpoint recover, and activity list operations. | Defines API surface that integration edge-case tests can exercise. |
| `src/api/workflows/routes.ts` | Validators enforce non-empty strings, actor shape, and date coercion for workflow routes. | Existing route-level empty-input/auth validation behavior for coverage alignment. |
| `src/api/workflows/http-dispatch.ts` | Maps workflow errors to sanitized HTTP responses and status codes (`400/403/404/409`). | Critical for integration assertions on denial/auth/conflict error behavior. |
| `src/api/workflows/errors.ts` | Converts service errors to workflow API error codes and status codes. | Error-shape contract for failure-mode integration tests. |
| `package.json` | Defines `test:integration:workflow` as `workflow-automation` + `workflow-surfaces`; API edge-case suites are under `test:integration:api`. | Reveals coverage split and potential gap for workflow-category gating of edge cases. |
| `/Users/polarzero/.codex/skills/effect-testing/SKILL.md` | Effect testing patterns (`Effect.either/Effect.exit`, service-layer mocking/layers, deterministic error assertions). | Reference patterns for implementing additional Effect-based negative-path tests. |

## Requirements Extracted for WF-AUDIT-005

### From product spec (`docs/design.spec.md`)
- Empty/error-state reliability is required for UX workflows.
- Explicit approval is required before outbound actions.
- Automation flow must support inspect and retry/fix.
- AI-applied updates must support inspect and keep/recover with auditable correctness.

### From engineering and prompt constraints
- Core-first is mandatory: test core/domain workflows before UI integration.
- Core behaviors must be well tested, and each slice must run `typecheck` plus relevant tests.
- Workflow automation safety/auditability requirements must be proven by tests, not inferred.

## Current Coverage Snapshot Against Ticket Criteria

| Ticket criterion | Current coverage | Evidence |
| --- | --- | --- |
| Empty inputs | Partial | HTTP route-level coverage exists for whitespace capture/signal payload (`tests/integration/workflow-api-http.integration.test.ts`); domain-level empty validation exists for outbound draft; entry/signal domain tests currently lack negative empty-input cases. |
| Approval denial + auth failures | Strong in API/unit; weak in workflow integration suite | Covered in `tests/unit/core/services/approval-service.test.ts`, `tests/integration/workflow-api.integration.test.ts`, and `tests/integration/workflow-api-http.integration.test.ts`; not present in `tests/integration/workflow-automation.integration.test.ts`. |
| Conflict/retry behavior | Partial | Duplicate-approval conflicts and missing-resource retry failures are covered; job retry success path is covered; no dedicated integration assertion for repeated/conflicting retry transitions on the same job state. |
| Recovery correctness | Strong baseline | Recovery success/failure and rollback consistency are covered in `tests/unit/core/services/checkpoint-service.test.ts` and `tests/integration/workflow-automation.integration.test.ts`; cross-flow recovery assertions after approval-denial/auth-failure scenarios are not explicitly covered. |

## Key Gaps To Close in WF-AUDIT-005
1. The workflow integration suite (`tests/integration/workflow-automation.integration.test.ts`) does not currently include approval denial/auth failure scenarios named in this ticket.
2. Empty-input coverage is fragmented (mostly API HTTP + outbound draft domain) rather than represented as a cohesive workflow automation edge-case slice.
3. Retry behavior lacks explicit integration tests for conflict-like repeated retry attempts against already-retrying/already-transitioned jobs.
4. Recovery correctness is covered for invalid snapshots and normal transitions, but not explicitly validated after adjacent workflow failures (for example denial/auth-failed outbound approval paths).
5. Workflow-category gate script (`test:integration:workflow`) does not currently run the API edge-case integration suites where many required failures are tested.

## Derived File Focus for Implementation
(derived because ticket metadata has no `relevantFiles`)

### Primary test targets
- `tests/integration/workflow-automation.integration.test.ts`
- `tests/integration/workflow-surfaces.integration.test.ts`
- `tests/unit/core/services/approval-service.test.ts`
- `tests/unit/core/services/job-service.test.ts`
- `tests/unit/core/services/checkpoint-service.test.ts`
- `tests/unit/core/services/entry-service.test.ts`
- `tests/unit/core/domain/entry.test.ts`
- `tests/unit/core/domain/signal.test.ts`

### Supporting API/integration contract files
- `tests/integration/workflow-api.integration.test.ts`
- `tests/integration/workflow-api-http.integration.test.ts`
- `tests/unit/api/workflows/routes.test.ts`
- `tests/unit/api/workflows/http-dispatch.test.ts`

### Core implementation files (only if tests expose behavior gaps)
- `src/core/services/approval-service.ts`
- `src/core/services/job-service.ts`
- `src/core/services/checkpoint-service.ts`
- `src/core/services/entry-service.ts`
- `src/core/domain/entry.ts`
- `src/core/domain/signal.ts`

### Gate/config file to confirm category coverage intent
- `package.json`

## Suggested Verification Commands for the Implementation Phase
- `bun run typecheck`
- `bun run test:integration:workflow`
- `bun run test:integration:api`
- `bun test tests/integration/workflow-automation.integration.test.ts`
- `bun test tests/unit/core/services/approval-service.test.ts`
- `bun test tests/unit/core/services/job-service.test.ts`
- `bun test tests/unit/core/services/checkpoint-service.test.ts`
- `bun test tests/unit/core/domain/entry.test.ts`
- `bun test tests/unit/core/domain/signal.test.ts`

## Research Summary
- `WF-AUDIT-005` has no ticket-provided `relevantFiles`; scope must be derived from current workflow tests/services and spec constraints.
- Many required edge cases already exist in API/unit suites, but workflow integration coverage is uneven for the ticket’s required buckets.
- Highest-value implementation move is to consolidate and expand workflow automation edge-case tests (empty input, denial/auth, conflict/retry, recovery correctness) in the workflow-category test slice while keeping core-first service/domain assertions deterministic.

# CORE-REV-006 Research Context

## Ticket
- ID: `CORE-REV-006`
- Title: `Create baseline core tests for correctness edge cases`
- Category: `test-coverage`
- Description: Add domain/API tests covering empty inputs, auth failures, conflicts, and approval/rejection flows; this coverage is currently absent and explicitly required by review scope.

## Relevant Files Field
- `.super-ralph/generated/PROMPT.md` contains global build/runtime rules but no mention of `CORE-REV-006`.
- Repository search found no `CORE-REV-006` ticket artifact with a populated `relevantFiles` field.
- Prior research docs (`docs/context/CORE-REV-001.md`, `docs/context/CORE-REV-002.md`) indicate earlier CORE-REV tickets also had `relevantFiles: null`.
- Working assumption for implementation: use the existing core/API workflow services + tests listed below as the operational `relevantFiles` set.

## Paths Reviewed
| Path | Summary | Relevance to CORE-REV-006 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Global execution contract (core-first, constraints, output discipline); no explicit CORE-REV-006 metadata. | Defines process guardrails for how this testing slice should be executed. |
| `README.md` | Points to design/engineering/reference docs as source of truth. | Confirms required docs to anchor test requirements. |
| `docs/design.spec.md` | Defines approval-centric workflows, conflict visibility, and explicit empty/error state expectations. | Direct basis for coverage targets: approval/rejection behavior, conflicts, and empty-state robustness. |
| `docs/engineering.choices.md` | Enforces core-first delivery and comprehensive core tests before UI. | Requires baseline correctness tests to be in place for core/domain/API behavior. |
| `docs/references.md` | Lists upstream references (Effect, pi-mono, Super Ralph, jj). | Confirms tool/pattern ecosystem constraints for test implementation. |
| `docs/test-suite-findings.md` | Historical gap analysis for test suites; flagged missing assertions around approvals/execution semantics. | Reinforces need for stronger correctness coverage, though parts appear stale versus current test files. |
| `docs/plans/WF-AUDIT-001.md` | TDD plan emphasizing domain validation and accept/edit/reject transitions. | Supports baseline empty-input and rejection-flow test expectations. |
| `docs/plans/CORE-REV-001.md` | Defines `requestEventSync` and `approveOutboundAction` behavior, including explicit approval gating and notification/audit expectations. | Key approval/rejection requirements to keep covered. |
| `docs/plans/CORE-REV-002.md` | Outbound draft lifecycle + required rejections for missing/wrong state and approval preconditions; integration expectations listed. | Provides concrete conflict/precondition test targets for outbound flows. |
| `docs/context/API-001.md` | Documents API/platform transaction boundaries and approval-gated side effects. | Clarifies where failures should be asserted across API/core boundaries. |
| `docs/context/CORE-REV-001.md` | Existing research context format and scope baseline. | Used as structural template and prior scope reference. |
| `docs/context/CORE-REV-002.md` | Existing research context including `relevantFiles`-null evidence. | Confirms metadata limitations and continuity of research approach. |
| `src/core/domain/outbound-draft.ts` | Domain constructor validates non-empty `payload` and `sourceSignalId`, stamps lifecycle metadata. | Primary location for empty-input domain correctness tests. |
| `tests/unit/core/domain/outbound-draft.test.ts` | Covers happy path and non-empty validation for `payload`/`sourceSignalId`. | Baseline exists; identifies where to extend edge-case matrix if needed. |
| `src/core/services/outbound-draft-service.ts` | Handles draft request transitions, notification/audit writes, and rollback behavior. | Candidate for conflict/precondition and approval-state transition tests. |
| `tests/unit/core/services/outbound-draft-service.test.ts` | Covers missing draft, invalid status, and rollback on dependency failures. | Good base; lacks explicit conflict modeling and auth-like failures. |
| `src/core/services/approval-service.ts` | Implements approval pathway with explicit `approved` checks, status validation, rollback logic, execution id rules. | Core source for approval/rejection correctness tests. |
| `tests/unit/core/services/approval-service.test.ts` | Exercises explicit rejection and status/precondition failures plus success path. | Strong base for approval/rejection; still missing auth/conflict behaviors. |
| `src/api/workflows/workflow-api.ts` | Wraps workflow handlers and normalizes errors into `WorkflowApiError`. | Needs coverage for mapping auth/conflict domain failures once represented. |
| `tests/unit/api/workflows/workflow-api.test.ts` | Verifies delegation and error normalization semantics. | Extend for auth/conflict propagation cases. |
| `src/api/workflows/routes.ts` | Route catalog + input validation/coercion logic. | Empty-input API validation coverage anchor. |
| `tests/unit/api/workflows/routes.test.ts` | Validates route schema and malformed/undefined payload handling. | Existing empty-input base; can be expanded for additional invalid shapes. |
| `src/api/workflows/http-dispatch.ts` | HTTP dispatch + 404/405/400/500 behavior with error sanitization. | Integration point for status mapping (including future 401/403/409 coverage). |
| `tests/unit/api/workflows/http-dispatch.test.ts` | Covers route miss, method mismatch, validation failure, success, and sanitized server errors. | Missing explicit auth/conflict response assertions. |
| `tests/integration/workflow-api.integration.test.ts` | End-to-end workflow coverage including approval-gated execution for event sync and outbound drafts. | Existing approval precondition coverage; useful base for expanded rejection/conflict assertions. |
| `tests/integration/core-platform.integration.test.ts` | Real integration tests for core-platform flows (no TODO placeholders currently). | Lacks negative/edge-case suite for empty/auth/conflict and approval gating paths. |
| `tests/integration/api-data.integration.test.ts` | Integration of API + persistence + approval gate behavior across restarts. | Strong positive coverage, but sparse malformed-input/auth/conflict scenarios. |
| `tests/integration/workflow-automation.integration.test.ts` | Automation workflow integration happy paths. | Missing edge-case matrix for empty/auth/conflict/rejection scenarios. |

## Spec Requirements Extracted
- Approval gating is mandatory: side effects execute only after explicit approval; rejection and precondition failures must be observable.
- Conflict handling is a required workflow concern (pending approvals/conflict visibility in system behavior).
- Empty/loading/error states are explicit product requirements and should be represented at core/API test boundaries.
- Core-first delivery requires correctness in domain/services/API adapters before UI-level work.

## Current Coverage Snapshot
- Empty inputs:
  - Present in domain/API validation hotspots (`outbound-draft`, `routes`, `http-dispatch` tests).
  - Not yet comprehensive across integration-level request variants.
- Auth failures:
  - Broadly absent; current workflow/core layers do not model caller authorization checks.
  - No baseline tests currently assert unauthorized/forbidden behavior.
- Conflicts:
  - Sparse; most tests validate status preconditions but not concurrent/duplicate/conflicting operations.
  - API dispatch/mapping tests do not currently assert conflict-class responses.
- Approval/rejection flows:
  - Strong unit and integration coverage exists for explicit approval requirements and some rejection paths.
  - Additional breadth needed for conflict-adjacent approval races and richer rejection permutations.

## Constraints and Guardrails
- Follow `docs/engineering.choices.md`: core-first, deterministic domain logic, comprehensive tests per slice.
- Respect repo rules from AGENTS: practical Effect usage in core workflows, pi-mono for AI integration, frequent `jj` checkpointing, and passing tests/typecheck for changed slice.
- Keep implementation decisions low-prescription unless explicitly mandated by spec.

## Gaps to Resolve for CORE-REV-006
1. Define and test auth-failure behavior for core/API workflows (or equivalent precondition gate currently representing auth boundary).
2. Add explicit conflict test cases (duplicate/concurrent approval/execution attempts and their expected failures).
3. Expand empty-input coverage beyond current validators into integration scenarios for critical workflow endpoints.
4. Broaden approval/rejection matrix to include edge transitions and regression guards around rollback/error mapping.

## Proposed File/Test Focus
- Unit/domain and services:
  - `tests/unit/core/domain/outbound-draft.test.ts`
  - `tests/unit/core/services/outbound-draft-service.test.ts`
  - `tests/unit/core/services/approval-service.test.ts`
- Unit/API adapters:
  - `tests/unit/api/workflows/routes.test.ts`
  - `tests/unit/api/workflows/workflow-api.test.ts`
  - `tests/unit/api/workflows/http-dispatch.test.ts`
- Integration:
  - `tests/integration/workflow-api.integration.test.ts`
  - `tests/integration/core-platform.integration.test.ts`
  - `tests/integration/api-data.integration.test.ts`
  - `tests/integration/workflow-automation.integration.test.ts`

## Notes
- `docs/test-suite-findings.md` appears partially outdated relative to current integration files (which now contain concrete tests instead of TODO placeholders), but its gap themes remain directionally useful.
- No authoritative ticket-local `relevantFiles` list was found; this context file serves as the operative source map for implementation.

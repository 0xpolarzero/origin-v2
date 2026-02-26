# API-DATA-001 Research Context

## Ticket
- ID: `API-DATA-001`
- Title: `Map Entry/Task/Signal service failures to explicit API codes`
- Category: `api`
- Priority: `high`
- Description: `Add structured code fields to EntryServiceError, TaskTransitionError, and SignalServiceError (at least not_found and conflict where applicable) so toWorkflowApiError returns 404/409 instead of collapsing to 400 unknown.`

## Relevant Files Field
- No ticket-level `relevantFiles` payload is present for `API-DATA-001` in repository ticket metadata.
- Evidence from `.super-ralph/workflow.db`:
  - `json_type(value,'$.relevantFiles')` and `json_extract(value,'$.relevantFiles')` are null/empty.
  - Ticket exists with `id/title/description/category/priority`.

Example queries used:

```sql
SELECT
  json_extract(value, '$.id'),
  json_type(value,'$.relevantFiles'),
  json_extract(value,'$.relevantFiles')
FROM category_review, json_each(category_review.suggested_tickets)
WHERE json_extract(value,'$.id')='API-DATA-001';
```

```sql
SELECT json(value)
FROM category_review, json_each(category_review.suggested_tickets)
WHERE json_extract(value,'$.id')='API-DATA-001';
```

## Paths Reviewed

| Path | Summary | Relevance to API-DATA-001 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated autonomous prompt (input listed this path twice). | Confirms core-first + tests/typecheck + jj process constraints. |
| `README.md` | Repository map and canonical contract pointers. | Confirms authoritative docs and contract locations. |
| `docs/design.spec.md` | Product/workflow requirements and reliability/auditability goals. | High-level behavior baseline for deterministic error behavior. |
| `docs/engineering.choices.md` | Normative delivery/quality guardrails. | Requires deterministic core behavior and per-slice validation. |
| `docs/references.md` | External reference policy for `docs/references/*`. | Reference policy context; no local submodule content available. |
| `docs/super-ralph.prompt.md` | Canonical autonomous prompt mirror. | Reinforces same guardrails as generated prompt. |
| `docs/contracts/workflow-api-schema-contract.md` | Canonical API contract includes service-error -> API status mapping table (`invalid_request/forbidden/conflict/not_found`). | Defines expected 404/409 behavior this ticket restores for Entry/Task/Signal paths. |
| `docs/plans/API-003.md` | Prior plan that established structured API error mapping (`WorkflowApiError.code/statusCode`). | Pattern precedent for this ticket's mapping path. |
| `docs/plans/API-004.md` | Prior plan that added `code` fields for `JobServiceError` and `CheckpointServiceError`. | Direct implementation precedent for adding service-level codes. |
| `docs/context/API-003.md` | Prior research context documenting mapping strategy and tests. | Useful pattern for source/test coverage selection. |
| `.super-ralph/generated/workflow.tsx` | Workflow runtime fallback config (`referenceFiles`: prompt, README, docs). | Confirms this research phase input shape. |
| `.super-ralph/workflow.db` | Ticket metadata source (`category_review.suggested_tickets`). | Source-of-truth evidence for ticket payload and missing `relevantFiles`. |
| `src/api/workflows/errors.ts` | `toWorkflowApiError` maps based on `error.code` only; unknown/no-code maps to `unknown` + `400`. | Core mechanism causing current 400 fallback for uncoded service errors. |
| `src/api/workflows/http-dispatch.ts` | Uses `WorkflowApiError.statusCode` (fallback by `code`) and returns sanitized error body. | Confirms status output is correct once service errors are coded. |
| `src/api/workflows/workflow-api.ts` | `wrapHandler` normalizes platform errors via `toWorkflowApiError`. | Boundary where Entry/Task/Signal service errors become API errors. |
| `src/core/services/entry-service.ts` | `EntryServiceError` has only `message`; `loadEntry` not-found path has no `code`. | Needs explicit `code` tagging for API 404 mapping. |
| `src/core/services/task-service.ts` | `TaskTransitionError` has only `message`; `loadTask` not-found path has no `code`. | Needs explicit `code` tagging for API 404 mapping. |
| `src/core/services/signal-service.ts` | `SignalServiceError` has only `message`; missing signal + conversion precondition failures have no `code`. | Needs explicit `not_found`/`conflict` tags for API 404/409 mapping. |
| `src/core/services/job-service.ts` | `JobServiceError` already includes structured `code` and tags `not_found/conflict/invalid_request`. | Canonical in-repo pattern to follow. |
| `src/core/services/checkpoint-service.ts` | `CheckpointServiceError` already includes structured `code` and tags `not_found/conflict/invalid_request`. | Additional pattern precedent for this ticket. |
| `tests/unit/api/workflows/errors.test.ts` | Asserts mapping for Approval/Event/Job/Checkpoint codes; no Entry/Task/Signal code coverage yet. | Primary unit test to extend for this ticket. |
| `tests/unit/api/workflows/workflow-api.test.ts` | Verifies metadata preservation for selected services; no Entry/Task/Signal mapped metadata assertions yet. | Secondary API wrapper regression coverage target. |
| `tests/unit/core/services/entry-service.test.ts` | Covers happy path + invalid content behavior; no coded not-found assertions. | Candidate for core-level error metadata tests. |
| `tests/unit/core/services/task-service.test.ts` | Covers happy paths only; no missing-task error assertions. | Candidate for core-level not-found code test. |
| `tests/unit/core/services/signal-service.test.ts` | Covers conversion precondition failure via thrown message only; no coded conflict assertion. | Candidate for core-level conflict code test. |
| `tests/integration/workflow-api-http.integration.test.ts` | Asserts 404/409 mapping for approval/job/checkpoint routes; no explicit Entry/Task/Signal status regressions. | Best integration test to add missing route-level status assertions. |
| `tests/integration/workflow-api.integration.test.ts` | Asserts conflict metadata mainly for approval flows. | Optional integration target for Entry/Task/Signal metadata propagation. |
| `tests/integration/api-contract-docs.integration.test.ts` | Enforces contract doc section `Service Error to API Status Mapping`. | Guards contract-level expectation that service codes map to 404/409. |
| `docs/references/` | Directory is absent in workspace (`No such file or directory`). | External reference repos unavailable for this run. |

## Current Behavior Snapshot

1. `toWorkflowApiError(route, error)` in `src/api/workflows/errors.ts` only maps known `error.code` values.
2. If a service error has no `code`, `toCode(...)` returns `unknown`, which yields `statusCode: 400`.
3. `EntryServiceError`, `TaskTransitionError`, and `SignalServiceError` currently carry only `message`, so known domain failures from these services default to `400 unknown` at API boundary.
4. Existing services `JobServiceError` and `CheckpointServiceError` already use explicit `code` metadata and therefore map correctly to `404/409/400`.

## Entry/Task/Signal Failure Points to Tag

- `entry-service`
  - `loadEntry(...)` missing entry: should map to `code: "not_found"`.
- `task-service`
  - `loadTask(...)` missing task: should map to `code: "not_found"`.
- `signal-service`
  - `loadSignal(...)` missing signal: should map to `code: "not_found"`.
  - `convertSignal(...)` when `signal.triageState !== "triaged"`: precondition/state mismatch should map to `code: "conflict"`.
  - `convertSignal(...)` unknown target branch can remain `unknown` behavior unless explicitly expanded to `invalid_request` in follow-on scope.

## Coverage Gap Relevant to Ticket

- Unit mapping coverage currently validates Approval/Event/Job/Checkpoint only, not Entry/Task/Signal.
- HTTP integration coverage currently validates missing-resource/conflict statuses for approval/job/checkpoint routes, not Entry/Task/Signal routes.
- Core service tests for Entry/Task/Signal currently validate messages/happy paths but not structured error `code` metadata.

## Derived File Focus for Implementation
(derived because ticket metadata has no `relevantFiles`)

- `src/core/services/entry-service.ts`
- `src/core/services/task-service.ts`
- `src/core/services/signal-service.ts`
- `tests/unit/api/workflows/errors.test.ts`
- `tests/unit/api/workflows/workflow-api.test.ts`
- `tests/unit/core/services/entry-service.test.ts`
- `tests/unit/core/services/task-service.test.ts`
- `tests/unit/core/services/signal-service.test.ts`
- `tests/integration/workflow-api-http.integration.test.ts`

## Suggested Verification Commands (Implementation Phase)

- `bun test tests/unit/core/services/entry-service.test.ts`
- `bun test tests/unit/core/services/task-service.test.ts`
- `bun test tests/unit/core/services/signal-service.test.ts`
- `bun test tests/unit/api/workflows/errors.test.ts`
- `bun test tests/unit/api/workflows/workflow-api.test.ts`
- `bun test tests/integration/workflow-api-http.integration.test.ts`
- `bun run test:integration:api`
- `bun run typecheck`

## Research Summary
- `API-DATA-001` has no ticket-provided `relevantFiles`; scope is derived from current API/core error mapping seams and related tests.
- Root cause is clear: Entry/Task/Signal service errors are uncoded, and uncoded errors are normalized to `WorkflowApiError { code: "unknown", statusCode: 400 }`.
- In-repo precedent (Job/Checkpoint services) already demonstrates the required structured `code` pattern to restore deterministic `404/409` mapping.

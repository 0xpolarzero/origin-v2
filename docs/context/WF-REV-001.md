# WF-REV-001 Research Context

## Ticket
- ID: `WF-REV-001`
- Title: `Expand HTTP negative-path contract tests across all workflow routes`
- Category: `workflow`
- Priority: `high`
- Description: `Add table-driven HTTP dispatcher tests that assert sanitized 403/404/409 (and 400 where applicable) for every workflow route key, not only approval + retry/checkpoint routes. Start from tests/unit/api/workflows/http-dispatch.test.ts and tests/integration/workflow-api-http.integration.test.ts.`

## Relevant Files Field
- Ticket metadata exists in `.super-ralph/workflow.db` (`category_review.suggested_tickets`) with `id/title/description/category/priority`.
- `relevantFiles` is not present for `WF-REV-001`:
  - `json_type(value,'$.relevantFiles')` is null/empty.
  - `json_extract(value,'$.relevantFiles')` is null/empty.

Example query used:

```sql
SELECT
  category_id,
  json_extract(value,'$.id') AS id,
  json_extract(value,'$.title') AS title,
  json_extract(value,'$.description') AS description,
  json_extract(value,'$.category') AS category,
  json_extract(value,'$.priority') AS priority,
  json_type(value,'$.relevantFiles') AS relevant_type,
  json_extract(value,'$.relevantFiles') AS relevant_files
FROM category_review, json_each(category_review.suggested_tickets)
WHERE json_extract(value,'$.id')='WF-REV-001';
```

## Paths Reviewed

| Path | Summary | Relevance to WF-REV-001 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated build prompt with core-first, test/typecheck, and jj checkpoint constraints. (Ticket input listed this path twice.) | Governs how this testing slice should be delivered. |
| `README.md` | Source-of-truth overview + contract doc pointers. | Confirms canonical contract document location. |
| `docs/design.spec.md` | Workflow requirements include approvals, retries, and recovery/auditability. | Product-level reason for full negative-path coverage across routes. |
| `docs/engineering.choices.md` | Normative quality rules: deterministic behavior, core-first, relevant tests per slice. | Requires focused workflow API tests before UI concerns. |
| `docs/references.md` | Reference policy and expected local submodule paths. | Context only; local `docs/references/` directory is absent. |
| `docs/super-ralph.prompt.md` | Canonical autonomous prompt mirror. | Reinforces testing and checkpointing constraints. |
| `docs/contracts/workflow-api-schema-contract.md` | Canonical route matrix + shared validation + service error/status mapping + dispatcher contract. | Primary contract target for status assertions (`400/403/404/409`) and sanitized body shape. |
| `docs/contracts/workflow-api-routes.md` | Compatibility pointer to canonical contract. | Confirms route details should follow canonical contract only. |
| `docs/contracts/persisted-schema.md` | Compatibility pointer to canonical contract. | Confirms schema doc split is non-authoritative for route behavior. |
| `docs/plans/API-DATA-005.md` | Prior plan focused on extending 404/409 mapping coverage to entry/task/signal routes. | Closest precedent to this ticket's broader negative-path expansion. |
| `docs/context/API-DATA-005.md` | Prior research showing missing status assertions beyond approval/job/checkpoint paths. | Historical gap analysis directly related to this ticket. |
| `src/contracts/workflow-route-keys.ts` | Canonical list of 25 workflow route keys. | Defines full route-key scope this ticket must cover. |
| `src/api/workflows/contracts.ts` | Route definition contract (`WorkflowRouteDefinition`, `WorkflowRouteActorSource`). | Defines trusted-route metadata and dispatcher input/output types. |
| `src/api/workflows/routes.ts` | `WORKFLOW_ROUTE_PATHS`, per-route validators, and route registration. | Source for per-route 400 applicability and route-key/path map. |
| `src/api/workflows/errors.ts` | Service-code to API-code/status mapping (`validation/forbidden/conflict/not_found/unknown`). | Source for expected status behavior when services emit coded failures. |
| `src/api/workflows/http-dispatch.ts` | Dispatcher behavior: 404 unknown path, 405 method mismatch, status mapping, sanitized body shape. | Core implementation under test for this ticket. |
| `src/api/workflows/workflow-api.ts` | Wraps platform methods with `toWorkflowApiError`. | Error-code propagation seam affecting status assertions. |
| `src/core/app/core-platform.ts` | Platform facade with mixed error propagation strategy across methods. | Explains current 400 vs 404 behavior drift on some read/list routes. |
| `src/core/services/entry-service.ts` | `loadEntry` emits `code: "not_found"`. | Basis for 404 scenarios on capture suggestion/edit/reject/accept routes. |
| `src/core/services/task-service.ts` | `loadTask` emits `code: "not_found"`. | Basis for 404 scenarios on planning routes. |
| `src/core/services/signal-service.ts` | `loadSignal` emits `not_found`; precondition emits `conflict`. | Basis for signal route 404/409 scenarios. |
| `src/core/services/event-service.ts` | Request event sync emits `not_found` and `conflict`. | Basis for approval request-event negative statuses. |
| `src/core/services/outbound-draft-service.ts` | Draft approval-request emits `not_found` and `conflict`. | Basis for approval request-draft negative statuses. |
| `src/core/services/job-service.ts` | Job operations emit `not_found`, `conflict`, `invalid_request`. | Basis for job route 400/404/409 scenarios. |
| `src/core/services/checkpoint-service.ts` | Checkpoint operations emit `not_found`, `conflict`, `invalid_request`. | Basis for checkpoint route 400/404/409 scenarios. |
| `src/core/services/activity-service.ts` | Activity listing emits `invalid_request` for limit issues. | Basis for activity route 400 scenarios. |
| `tests/unit/contracts/workflow-route-keys.test.ts` | Asserts canonical route-key set and shared type usage. | Guardrail for route-key completeness in test matrices. |
| `tests/unit/api/workflows/routes.test.ts` | Contains full route-key fixtures (`REQUIRED_ROUTE_KEYS`, `VALID_ROUTE_INPUTS`) and validator negative cases. | Best reusable pattern/source for table-driven route coverage scaffolding. |
| `tests/unit/api/workflows/errors.test.ts` | Verifies mapping behavior for multiple service error types/codes. | Confirms expected status mapping contract independently of HTTP transport. |
| `tests/unit/api/workflows/workflow-api.test.ts` | Route-to-platform mapping and coded error propagation assertions. | Confirms route-level error mapping before dispatcher layer. |
| `tests/unit/api/workflows/http-dispatch.test.ts` | Dispatcher unit tests for path/method, trusted auth, sanitization, and selected route failures. | Primary unit test file to expand with all route-key negative-path assertions. |
| `tests/integration/workflow-api-http.integration.test.ts` | End-to-end dispatcher integration with mixed positive and selected negative assertions. | Primary integration test file to expand across all route keys. |
| `tests/integration/api-contract-docs.integration.test.ts` | Verifies canonical contract includes shared validation, mapping table, and dispatcher contract sections. | Confirms contract expectations that WF-REV-001 should enforce at test level. |

## Spec + Contract Constraints Extracted
- `docs/contracts/workflow-api-schema-contract.md` Route Matrix defines 25 workflow routes.
- Shared validation rules define strict date parsing, non-empty string checks, and trusted-actor behavior.
- Service Error to API Status Mapping defines:
  - `invalid_request -> validation -> 400`
  - `forbidden -> forbidden -> 403`
  - `conflict -> conflict -> 409`
  - `not_found -> not_found -> 404`
- HTTP Dispatcher Contract requires:
  - unknown path `404`
  - unsupported method `405`
  - trusted-route auth failures `403`
  - sanitized mapped failures `{ error, route, message }`
  - defect fallback `500`

## Current Coverage Snapshot

### 1) Canonical route-key scope
- `WORKFLOW_ROUTE_KEYS` contains 25 keys (`src/contracts/workflow-route-keys.ts`).
- `WORKFLOW_ROUTE_PATHS` maps all 25 keys to `/api/workflows/...` paths (`src/api/workflows/routes.ts`).

### 2) Current negative-path assertions in integration HTTP tests
- `tests/integration/workflow-api-http.integration.test.ts` currently asserts sanitized negative statuses for 10/25 route keys:
  - `approval.approveOutboundAction` (`400/403/404/409`)
  - `capture.entry` (`400`)
  - `capture.suggest` (`404`)
  - `checkpoint.keep` (`404`)
  - `checkpoint.recover` (`404`)
  - `job.retry` (`404`)
  - `planning.completeTask` (`404`)
  - `signal.convert` (`409`)
  - `signal.ingest` (`400`)
  - `signal.triage` (`404`)
- Missing route keys in integration negative assertions (15):
  - `capture.editSuggestion`
  - `capture.rejectSuggestion`
  - `capture.acceptAsTask`
  - `planning.deferTask`
  - `planning.rescheduleTask`
  - `approval.requestEventSync`
  - `approval.requestOutboundDraftExecution`
  - `job.create`
  - `job.recordRun`
  - `job.inspectRun`
  - `job.list`
  - `job.listHistory`
  - `checkpoint.create`
  - `checkpoint.inspect`
  - `activity.list`

### 3) Current unit HTTP dispatcher negative coverage is route-selective
- `tests/unit/api/workflows/http-dispatch.test.ts` strongly covers dispatcher mechanics and trusted-actor flows.
- Route-specific negative status assertions are concentrated in `approval.*`, `job.list`, and a generic `capture.entry` validation case.
- There is no table-driven route-key-wide negative contract suite in this file yet.

## Baseline Behavior Probe (Current Implementation)
- A direct route-by-route HTTP probe was run against current code to capture present status outputs.
- Observed negative-path statuses:
  - `capture.entry` -> `400`
  - `capture.suggest` -> `404`
  - `capture.editSuggestion` -> `404`
  - `capture.rejectSuggestion` -> `404`
  - `capture.acceptAsTask` -> `404`
  - `signal.ingest` -> `400`
  - `signal.triage` -> `404`
  - `signal.convert` (missing signal) -> `404`
  - `planning.completeTask` -> `404`
  - `planning.deferTask` -> `404`
  - `planning.rescheduleTask` -> `404`
  - `approval.requestEventSync` -> `404`
  - `approval.requestOutboundDraftExecution` -> `404`
  - `approval.approveOutboundAction` (missing entity) -> `404`
  - `job.create` -> `400`
  - `job.recordRun` -> `404`
  - `job.inspectRun` -> `400` (message indicates not found)
  - `job.list` -> `400`
  - `job.listHistory` -> `400` (message indicates not found)
  - `job.retry` -> `404`
  - `checkpoint.create` -> `400`
  - `checkpoint.inspect` -> `400` (message indicates not found)
  - `checkpoint.keep` -> `404`
  - `checkpoint.recover` -> `404`
  - `activity.list` -> `400`
- Additional seeded conflict probe confirmed current `409` responses for:
  - `signal.convert`
  - `approval.requestEventSync`
  - `approval.requestOutboundDraftExecution`
  - `approval.approveOutboundAction`
  - `job.retry`
  - `checkpoint.keep`
  - `checkpoint.recover`

### Important implementation signal from probe
- `job.inspectRun`, `job.listHistory` (missing job), and `checkpoint.inspect` (missing checkpoint) currently return `400` even when message text indicates missing resource.
- Root cause is likely in `src/core/app/core-platform.ts`, where `inspectJobRun`, `listJobRunHistory`, and `inspectWorkflowCheckpoint` map service errors to plain `Error`, dropping structured `code` metadata before `toWorkflowApiError`.
- Expanding negative-path tests route-wide will likely expose this drift against the canonical `not_found -> 404` mapping intent.

## Route-Key Negative Scenario Matrix for WF-REV-001

| Route Key | Primary negative scenario to assert | Expected status family |
| --- | --- | --- |
| `capture.entry` | invalid payload (`content` blank) | `400` |
| `capture.suggest` | missing `entryId` resource | `404` |
| `capture.editSuggestion` | missing `entryId` resource | `404` |
| `capture.rejectSuggestion` | missing `entryId` resource | `404` |
| `capture.acceptAsTask` | missing `entryId` resource | `404` |
| `signal.ingest` | invalid payload (`payload` blank) | `400` |
| `signal.triage` | missing `signalId` resource | `404` |
| `signal.convert` | precondition conflict (untriaged signal) | `409` |
| `planning.completeTask` | missing `taskId` resource | `404` |
| `planning.deferTask` | missing `taskId` resource | `404` |
| `planning.rescheduleTask` | missing `taskId` resource | `404` |
| `approval.requestEventSync` | conflict on non-`local_only` event | `409` (and `404` missing case) |
| `approval.requestOutboundDraftExecution` | conflict on non-`draft` outbound draft | `409` (and `404` missing case) |
| `approval.approveOutboundAction` | trusted actor/auth failures + missing/conflict + invalid payload | `403/404/409/400` |
| `job.create` | invalid payload (`name` blank) | `400` |
| `job.recordRun` | missing `jobId` resource | `404` |
| `job.inspectRun` | missing `jobId` resource | contract intends `404` |
| `job.list` | invalid filter (`limit <= 0`) | `400` |
| `job.listHistory` | missing `jobId` resource | contract intends `404` (also `400` invalid limit) |
| `job.retry` | wrong state (not failed) | `409` (and `404` missing case) |
| `checkpoint.create` | invalid payload (`rollbackTarget` blank) | `400` |
| `checkpoint.inspect` | missing `checkpointId` resource | contract intends `404` |
| `checkpoint.keep` | invalid transition | `409` (and `404` missing case) |
| `checkpoint.recover` | invalid transition | `409` (and `404` missing case) |
| `activity.list` | invalid filter (`limit <= 0` / bad actor kind) | `400` |

## Implementation Guidance for Next Phase
- Reuse table-driven fixtures from `tests/unit/api/workflows/routes.test.ts`:
  - `REQUIRED_ROUTE_KEYS`
  - `VALID_ROUTE_INPUTS`
- Build route-key-indexed negative-case fixtures in:
  - `tests/unit/api/workflows/http-dispatch.test.ts`
  - `tests/integration/workflow-api-http.integration.test.ts`
- Keep assertions contract-focused:
  - status code
  - sanitized body shape `{ error, route, message }`
  - absence of `_tag` and `cause`
- Use valid payloads when targeting `404`/`409` to avoid falling into validator `400` branches.
- Expect follow-up code changes in `src/core/app/core-platform.ts` if route-wide tests enforce `404` for `job.inspectRun`, `job.listHistory`, and `checkpoint.inspect`.

## Suggested Verification Commands (Implementation Phase)
- `bun test tests/unit/api/workflows/http-dispatch.test.ts`
- `bun test tests/integration/workflow-api-http.integration.test.ts`
- `bun test tests/unit/api/workflows/workflow-api.test.ts`
- `bun test tests/unit/api/workflows/errors.test.ts`
- `bun test tests/unit/api/workflows/routes.test.ts`
- `bun test tests/integration/api-contract-docs.integration.test.ts`
- `bun run test:integration:api`
- `bun run typecheck`

## Research Summary
- `WF-REV-001` has no ticket-provided `relevantFiles`; scope is derived from workflow route contracts, dispatcher implementation, and current HTTP/unit integration tests.
- Canonical contract requires deterministic `400/403/404/409` mapping plus sanitized dispatcher failures, but current negative assertions only cover 10 of 25 route keys.
- Route-wide expansion will likely expose at least one real mapping gap (`job.inspectRun`, `job.listHistory`, `checkpoint.inspect` currently returning `400` on missing resources), making this ticket both coverage expansion and probable behavior-correction work.

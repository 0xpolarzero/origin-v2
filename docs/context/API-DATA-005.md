# API-DATA-005 Research Context

## Ticket
- ID: `API-DATA-005`
- Title: `Add missing status-mapping regression suite for entry/task/signal routes`
- Category: `testing`
- Priority: `high`
- Description: `Add unit+integration tests that assert sanitized 404 for missing entry/task/signal resources and 409 for signal conversion precondition conflicts. Cover both makeWorkflowApi mapping and HTTP dispatcher responses.`

## Relevant Files Field
- No ticket-level `relevantFiles` payload is present for `API-DATA-005` in repository ticket metadata.
- Evidence from `.super-ralph/workflow.db`:
  - `json_type(ticket, '$.relevantFiles')` is null/empty.
  - `json_extract(ticket, '$.relevantFiles')` is null/empty.
  - `json_type(ticket, '$.referenceFiles')` is null/empty.

Example query used:

```sql
SELECT
  json_extract(ticket,'$.id') AS id,
  json_type(ticket,'$.relevantFiles') AS relevant_type,
  json_extract(ticket,'$.relevantFiles') AS relevant_files,
  json_type(ticket,'$.referenceFiles') AS reference_type,
  json_extract(ticket,'$.referenceFiles') AS reference_files
FROM (
  SELECT json_each.value AS ticket
  FROM category_review, json_each(suggested_tickets)
)
WHERE id='API-DATA-005';
```

## Spec + Contract Constraints
- `docs/design.spec.md`: requires reliable core workflows for capture, signal triage/conversion, and planning transitions.
- `docs/engineering.choices.md`: core-first testing is mandatory for behavior slices.
- `docs/contracts/workflow-api-schema-contract.md`:
  - Service error mapping requires `not_found -> 404` and `conflict -> 409`.
  - HTTP dispatcher errors must be sanitized to `{ error, route, message }`.
- `docs/test-suite-findings.md`: current API suite passes, but status-mapping examples primarily cover approval/job/checkpoint paths.

## Paths Reviewed

| Path | Summary | Relevance to API-DATA-005 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated autonomous prompt with core-first and test validation constraints. | Confirms this ticket should be test-focused and deterministic. |
| `README.md` | Repo map and canonical contract pointers. | Identifies authoritative contract doc and integration test locations. |
| `docs/design.spec.md` | Product workflows requiring reliable capture/signal/planning behavior. | Missing-resource and precondition status mapping must be stable across these flows. |
| `docs/engineering.choices.md` | Normative quality/testing gate. | Reinforces regression-test-first scope for this ticket. |
| `docs/references.md` | External reference policy. | Context only; no local `docs/references/*` content present. |
| `docs/super-ralph.prompt.md` | Canonical prompt mirror. | Confirms same execution constraints as generated prompt. |
| `docs/contracts/workflow-api-schema-contract.md` | Canonical route + error/status + dispatcher contract. | Authoritative expected behavior for 404/409 + sanitized error body. |
| `docs/contracts/workflow-api-routes.md` | Compatibility pointer to canonical contract. | Confirms route details live in canonical contract only. |
| `docs/contracts/persisted-schema.md` | Compatibility pointer for schema details. | Confirms no duplicated API behavior spec here. |
| `docs/test-suite-findings.md` | Current integration status summary. | Shows passing suites but highlights where status tests currently concentrate. |
| `.super-ralph/generated/workflow.tsx` | Runtime fallback config with `referenceFiles` and command map. | Confirms research inputs (`PROMPT`, `README`, `docs`) for this phase. |
| `.super-ralph/workflow.db` | Source of ticket metadata (`category_review.suggested_tickets`). | Source-of-truth evidence for ticket details and missing `relevantFiles`. |
| `src/api/workflows/errors.ts` | `toWorkflowApiError` maps by `error.code`; unknown/no-code => `unknown` + `400`. | Direct mapping seam this regression suite targets. |
| `src/api/workflows/workflow-api.ts` | `wrapHandler` normalizes service errors using `toWorkflowApiError`. | Required unit-test target for `makeWorkflowApi` error mapping assertions. |
| `src/api/workflows/http-dispatch.ts` | Dispatcher returns sanitized error bodies and status from mapped `WorkflowApiError`. | Required integration-test target for route-level sanitized 404/409 assertions. |
| `src/api/workflows/routes.ts` | Route keys and paths for capture/planning/signal endpoints. | Needed for HTTP dispatcher test route selection. |
| `src/core/services/entry-service.ts` | `EntryServiceError` has `message` only; missing-entry path in `loadEntry` has no `code`. | Current root cause for entry missing-resource mapping drift. |
| `src/core/services/task-service.ts` | `TaskTransitionError` has `message` only; missing-task path in `loadTask` has no `code`. | Current root cause for task missing-resource mapping drift. |
| `src/core/services/signal-service.ts` | `SignalServiceError` has `message` only; missing-signal and untriaged-convert failures have no `code`. | Current root cause for signal 404 and precondition 409 mapping drift. |
| `src/core/services/job-service.ts` | `JobServiceError` includes structured `code` (`not_found`, `conflict`, `invalid_request`). | In-repo pattern for properly coded service failures. |
| `src/core/services/checkpoint-service.ts` | `CheckpointServiceError` includes structured `code` (`not_found`, `conflict`, `invalid_request`). | Additional pattern for deterministic API status mapping. |
| `tests/unit/api/workflows/errors.test.ts` | Verifies mapping for approval/event/job/checkpoint only. | Missing entry/task/signal mapping assertions. |
| `tests/unit/api/workflows/workflow-api.test.ts` | Verifies handler delegation + mapped metadata for approval/job/checkpoint paths. | Required `makeWorkflowApi` regression target for entry/task/signal statuses. |
| `tests/unit/api/workflows/http-dispatch.test.ts` | Verifies sanitized 404/409 with synthetic `WorkflowApiError` routes. | Useful pattern for sanitized-body assertions; not route-specific for entry/task/signal. |
| `tests/integration/workflow-api.integration.test.ts` | End-to-end API handler flows and some approval conflict mapping checks. | Optional secondary integration seam; currently not covering requested entry/task/signal failures. |
| `tests/integration/workflow-api-http.integration.test.ts` | Real dispatcher integration with sanitized status checks (currently approval/job/checkpoint focused). | Primary integration target for route-specific entry/task/signal 404 + signal conflict 409 coverage. |
| `tests/integration/api-contract-docs.integration.test.ts` | Enforces contract doc includes mapping table and dispatcher section. | Confirms expected contract exists; does not enforce entry/task/signal route-level regressions. |
| `tests/unit/core/services/entry-service.test.ts` | Core happy paths and invalid content checks. | No structured error-code assertions for missing entry resource. |
| `tests/unit/core/services/task-service.test.ts` | Core task transitions happy paths. | No missing-task error metadata assertions. |
| `tests/unit/core/services/signal-service.test.ts` | Core signal flows; untriaged conversion currently asserted by message throw only. | No explicit conflict-code assertion for conversion precondition. |
| `docs/context/API-DATA-001.md` | Prior research for service error code mapping ticket. | Historical context and file targeting precedent for this regression suite. |
| `docs/references/` | Directory absent in workspace (`No such file or directory`). | No local external reference repos available for this run. |

## Current Behavior Snapshot (Route-Mapping Relevant)
1. `toWorkflowApiError` maps only recognized `error.code` values (`invalid_request`, `forbidden`, `conflict`, `not_found`).
2. Entry/task/signal service errors currently omit `code`; these normalize to `code: "unknown"` and `statusCode: 400`.
3. HTTP dispatcher sanitizes mapped failures correctly, but status correctness depends on upstream mapping metadata.
4. Existing high-confidence status regression coverage is concentrated on approval/job/checkpoint flows.

## Coverage Gap Matrix For This Ticket

| Required regression coverage | Current state | Gap |
| --- | --- | --- |
| `makeWorkflowApi` maps missing entry resources to 404 | Not asserted | Missing |
| `makeWorkflowApi` maps missing task resources to 404 | Not asserted | Missing |
| `makeWorkflowApi` maps missing signal resources to 404 | Not asserted | Missing |
| `makeWorkflowApi` maps signal conversion precondition conflicts to 409 | Not asserted for signal precondition | Missing |
| HTTP dispatcher returns sanitized 404 for missing entry/task/signal resources | No route-specific entry/task/signal assertions | Missing |
| HTTP dispatcher returns sanitized 409 for signal conversion precondition conflicts | Not asserted | Missing |

## Derived File Focus For Implementation
(derived because ticket metadata has no `relevantFiles`)

Primary:
- `tests/unit/api/workflows/workflow-api.test.ts`
- `tests/integration/workflow-api-http.integration.test.ts`

Likely supporting:
- `tests/unit/api/workflows/errors.test.ts`
- `src/core/services/entry-service.ts`
- `src/core/services/task-service.ts`
- `src/core/services/signal-service.ts`

Reference/pattern sources:
- `src/api/workflows/errors.ts`
- `src/api/workflows/http-dispatch.ts`
- `src/core/services/job-service.ts`
- `src/core/services/checkpoint-service.ts`
- `tests/unit/api/workflows/http-dispatch.test.ts`

## Suggested Test Scenario Set (for implementation phase)
1. `makeWorkflowApi` unit regression: entry route failure with service `not_found` maps to `WorkflowApiError { code: "not_found", statusCode: 404 }`.
2. `makeWorkflowApi` unit regression: task route failure with service `not_found` maps to `404`.
3. `makeWorkflowApi` unit regression: signal route missing-resource failure maps to `404`.
4. `makeWorkflowApi` unit regression: signal conversion precondition conflict maps to `409`.
5. HTTP integration regression: missing entry/task/signal route operations return sanitized `404` payloads (`{ error, route, message }`, no `cause`/`_tag`).
6. HTTP integration regression: `signal.convert` against untriaged signal returns sanitized `409` payload.

## Suggested Verification Commands (implementation phase)
- `bun test tests/unit/api/workflows/workflow-api.test.ts`
- `bun test tests/unit/api/workflows/errors.test.ts`
- `bun test tests/integration/workflow-api-http.integration.test.ts`
- `bun run test:integration:api`
- `bun run typecheck`

## Research Summary
- `API-DATA-005` metadata is present with `high` priority and no ticket-provided `relevantFiles`.
- Contract docs already define the expected mapping (`not_found -> 404`, `conflict -> 409`) and sanitized dispatcher body shape.
- Current source/tests reveal a focused regression gap: entry/task/signal status mapping assertions are missing in both `makeWorkflowApi` unit coverage and HTTP dispatcher integration coverage.

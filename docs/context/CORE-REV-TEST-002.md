# CORE-REV-TEST-002 Research Context

## Ticket
- ID: `CORE-REV-TEST-002`
- Title: `Add HTTP integration test for invalid actor.kind validation`
- Category: `testing`
- Priority: `medium`
- Description: `Extend workflow HTTP integration tests with invalid \`actor.kind\` payloads and assert sanitized \`400\` responses for affected routes.`

## Relevant Files Field
- Ticket metadata is stored in `.super-ralph/workflow.db` (`category_review.suggested_tickets`).
- `relevantFiles` is absent/null for `CORE-REV-TEST-002`.
- `referenceFiles` is absent/null for `CORE-REV-TEST-002`.
- Effective implementation scope is derived from workflow HTTP dispatcher, route validators, and existing integration test coverage.

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
WHERE json_extract(value,'$.id')='CORE-REV-TEST-002';
```

## Paths Reviewed

| Path | Summary | Relevance to CORE-REV-TEST-002 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated workflow prompt requiring core-first slices, relevant tests, and jj checkpointing. | Confirms process constraints for this testing ticket. |
| `README.md` | Repo map that points to canonical workflow API contract docs. | Confirms where authoritative workflow route/schema behavior is documented. |
| `docs/design.spec.md` | Product-level workflow requirements and reliability expectations. | Validates need for strict input validation and safe error boundaries. |
| `docs/engineering.choices.md` | Core-first testing policy; deterministic behavior and relevant tests per slice. | Supports adding targeted HTTP integration regression coverage. |
| `docs/references.md` | Reference repository policy and expected local submodule paths. | Context-only; local `docs/references/` directory is not present in this workspace. |
| `docs/super-ralph.prompt.md` | Canonical prompt mirror for implementation/testing loop expectations. | Reinforces test/typecheck/checkpoint expectations for this slice. |
| `docs/contracts/workflow-api-routes.md` | Compatibility pointer to canonical workflow API contract. | Confirms route behavior should follow canonical schema contract. |
| `docs/contracts/workflow-api-schema-contract.md` | Canonical route matrix, actor schema, trusted actor rules, and status mapping contract. | Primary contract source for `actor.kind` validation and sanitized HTTP failures. |
| `src/core/domain/common.ts` | Defines `ActorKind` and `ActorRef`; allowed kinds are `user`, `system`, `ai`. | Source of truth for valid `actor.kind` values. |
| `src/api/workflows/routes.ts` | Route validators parse `actor` payload via shared actor-field parser and convert validation failures to coded API errors. | Primary validation surface that should emit `400` for invalid `actor.kind`. |
| `src/api/workflows/http-dispatch.ts` | Dispatcher maps coded errors to HTTP status and returns sanitized client error bodies. | Defines the `400` response shape expected by integration tests. |
| `tests/unit/api/workflows/http-dispatch.test.ts` | Unit tests assert sanitized `400` for invalid payload validation in dispatcher path. | Existing unit-level evidence for sanitized validation behavior. |
| `tests/integration/workflow-api-http.integration.test.ts` | End-to-end HTTP integration tests for sanitizer behavior and selected negative paths. | Primary file to extend with invalid `actor.kind` payload tests. |
| `.super-ralph/workflow.db` | Source-of-truth ticket metadata row for this ticket. | Confirms ticket details and missing `relevantFiles`. |
| `.smithers/executions/sr-mm3ezpkt-ec0eed7d/logs/stream.ndjson` | Smithers execution log includes node start for `CORE-REV-TEST-002:research`. | Confirms ticket phase wiring in automation pipeline. |

## Spec + Contract Constraints Extracted
- Actor schema contract (`docs/contracts/workflow-api-schema-contract.md`) requires actor objects with:
  - `id: string`
  - `kind` in `{ "user", "system", "ai" }`
- Shared validation contract requires malformed request payloads to fail before handler logic.
- Service/API mapping contract requires validation failures to map to `400`.
- HTTP dispatcher contract requires sanitized error output body shape (no internal error metadata leaks).

## Existing Implementation Findings

### 1) `actor.kind` validation path
- `ActorKind` union is defined in `src/core/domain/common.ts`.
- Workflow route validators use shared actor parsing in `src/api/workflows/routes.ts`:
  - actor `id` must be a non-empty string
  - actor `kind` must be in the allowed `ACTOR_KINDS` set
- Invalid actor payloads become `WorkflowApiError` with validation code and `statusCode: 400`.

### 2) Sanitized HTTP `400` behavior
- `src/api/workflows/http-dispatch.ts` converts coded validation errors to HTTP `400`.
- Response body is sanitized by dispatcher-level client error shaping:
  - includes high-level fields like `error`, `route`, and `message`
  - excludes internal fields such as `_tag` and `cause`

### 3) Routes affected by payload actor validation
Routes with validator-level payload actor parsing (directly affected by invalid `actor.kind` payload tests):
- Capture:
  - `capture.entry`
  - `capture.suggest`
  - `capture.editSuggestion`
  - `capture.rejectSuggestion`
  - `capture.acceptAsTask`
- Signal:
  - `signal.ingest`
  - `signal.triage`
  - `signal.convert`
- Planning:
  - `planning.completeTask`
  - `planning.deferTask`
  - `planning.rescheduleTask`
- Approval:
  - `approval.requestEventSync`
  - `approval.requestOutboundDraftExecution`
  - `approval.approveOutboundAction` (with trusted-actor constraints)
- Job:
  - `job.create` (optional actor, but validated when provided)
  - `job.recordRun`
  - `job.retry`
- Checkpoint:
  - `checkpoint.create`
  - `checkpoint.keep`
  - `checkpoint.recover`

## Current Test Coverage Snapshot
- Unit coverage:
  - `tests/unit/api/workflows/http-dispatch.test.ts` already asserts sanitized `400` on invalid request payloads.
- Integration coverage (`tests/integration/workflow-api-http.integration.test.ts`):
  - has sanitized `400` checks for invalid whitespace payload fields (`capture.entry`, `signal.ingest`, and an approval payload validation case).
  - has sanitized `403` checks around approval actor authorization/trusted actor mismatch cases.
  - does not explicitly cover invalid `actor.kind` payload values across the affected route set.

## Testing Patterns to Reuse
- Reuse `expectSanitizedError(...)` helper in `tests/integration/workflow-api-http.integration.test.ts`.
- Follow existing assertions for:
  - expected status code
  - route identifier in error payload
  - minimal/sanitized payload shape
  - explicit absence of `_tag` and `cause`

## Derived Implementation Focus for Next Phase
- Primary edit target:
  - `tests/integration/workflow-api-http.integration.test.ts`
- Read-only behavioral anchors:
  - `src/api/workflows/routes.ts`
  - `src/api/workflows/http-dispatch.ts`
  - `src/core/domain/common.ts`

## Verification Commands for Implementation Phase
- `bun test tests/integration/workflow-api-http.integration.test.ts`
- `bun run test:integration:api`
- `bun run typecheck`

## Research Summary
- `CORE-REV-TEST-002` has no ticket-specified `relevantFiles`, so scope is derived from contract + validator + dispatcher + integration test surfaces.
- The codebase already enforces enum validation for `actor.kind` and already sanitizes `400` failures; the gap is explicit HTTP integration coverage for invalid `actor.kind` payloads on affected routes.
- Highest-value implementation is to extend `workflow-api-http.integration.test.ts` with invalid `actor.kind` cases that assert sanitized `400` responses using existing helper patterns.

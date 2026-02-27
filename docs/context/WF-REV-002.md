# WF-REV-002 Research Context

## Ticket
- ID: `WF-REV-002`
- Title: `Add route-specific validation failure tests for uncovered workflow route keys`
- Category: `workflow`
- Priority: `medium`
- Description: `In tests/unit/api/workflows/routes.test.ts, add explicit malformed/empty payload assertions for currently uncovered route keys including capture.suggest/editSuggestion/acceptAsTask, signal.triage/convert, planning.completeTask/rescheduleTask, job.recordRun/inspectRun.`

## Relevant Files Field
- Ticket metadata source: `.super-ralph/workflow.db` (`category_review.suggested_tickets`).
- `relevantFiles` for `WF-REV-002` is not present (`json_type` and `json_extract` return null/empty).

Query used:

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
WHERE json_extract(value,'$.id')='WF-REV-002';
```

## Paths Reviewed

| Path | Summary | Relevance to WF-REV-002 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Build constraints: core-first, tests/typecheck discipline, `jj` checkpoints. | Defines delivery constraints for this test-only slice. |
| `README.md` | Repo map and canonical workflow contract pointer. | Confirms contract docs to align test expectations. |
| `docs/design.spec.md` | Workflow reliability and auditability are required product behaviors. | Justifies strict validation coverage across route handlers. |
| `docs/engineering.choices.md` | Normative quality rules: deterministic core behavior and targeted tests. | Requires route-level validator assertions in unit tests. |
| `docs/references.md` | External reference policy; no direct implementation guidance for this ticket. | Background only. |
| `docs/super-ralph.prompt.md` | Mirrors autonomous delivery constraints and verification loop expectations. | Reinforces test-first execution behavior. |
| `docs/contracts/workflow-api-schema-contract.md` | Canonical route matrix + route payload schema matrix. | Source of required/optional fields for malformed/empty payload cases. |
| `docs/plans/WF-REV-001.md` | Previous route-complete negative-path expansion strategy. | Pattern reference for route-key completeness mindset. |
| `docs/context/WF-REV-001.md` | Prior research shows route-key coverage auditing style and sanitized error focus. | Template/style reference for documenting this ticket context. |
| `docs/tdd/WF-REV-001.review-fix.md` | Prior RED/GREEN evidence for workflow route error mapping fixes. | Confirms recent route-level testing process conventions. |
| `src/api/workflows/routes.ts` | Per-route validators + route registration for all workflow keys. | Ground truth for exactly what malformed/empty payloads should fail. |
| `tests/unit/api/workflows/routes.test.ts` | Current validator-focused unit coverage for workflow routes. | Primary file to modify for this ticket. |

## Spec + Contract Constraints Extracted
- `docs/contracts/workflow-api-schema-contract.md` defines all route payload required/optional fields.
- Validators in `src/api/workflows/routes.ts` enforce:
  - object body required for these routes (no optional-body behavior):
    `capture.suggest`, `capture.editSuggestion`, `capture.acceptAsTask`, `signal.triage`, `signal.convert`, `planning.completeTask`, `planning.rescheduleTask`, `job.recordRun`, `job.inspectRun`.
  - strict field checks including string/enum/date/actor validation.
- Error shape expectation in `routes.test.ts` pattern:
  - `Either.isLeft(result) === true`
  - `WorkflowApiError` with matching `route`
  - message includes failing field name or `invalid request payload`.

## Existing Coverage in `tests/unit/api/workflows/routes.test.ts`
Current file already includes:
- global route-key/path/method checks,
- all-route invocation checks with valid payloads,
- generic `undefined` payload rejection for all non-optional-body routes,
- selected route-specific validator negatives for other keys (examples: `capture.entry`, `signal.ingest`, `job.create`, `job.retry`, `checkpoint.*`, `job.list*`, `activity.list`).

Current uncovered route-specific malformed/empty assertions (ticket scope):
- `capture.suggest`
- `capture.editSuggestion`
- `capture.acceptAsTask`
- `signal.triage`
- `signal.convert`
- `planning.completeTask`
- `planning.rescheduleTask`
- `job.recordRun`
- `job.inspectRun`

## Validator-Derived Negative Case Candidates
Derived from `src/api/workflows/routes.ts` validators for each uncovered key:

| Route key | Empty payload candidate | Malformed payload candidate |
| --- | --- | --- |
| `capture.suggest` | `{}` -> missing `entryId`/`actor` | `{ suggestedTitle: "   " }` with otherwise valid fields -> `suggestedTitle` non-empty check |
| `capture.editSuggestion` | `{}` -> missing `entryId` | `suggestedTitle: 123` (non-string) or missing `actor` |
| `capture.acceptAsTask` | `{}` -> missing `entryId` | `actor.kind: "robot"` or `entryId: 123` |
| `signal.triage` | `{}` -> missing `signalId`/`decision` | `decision: 1` (non-string) or invalid actor payload |
| `signal.convert` | `{}` -> missing required fields | `targetType: "invalid"` enum violation |
| `planning.completeTask` | `{}` -> missing `taskId` | `taskId: 1` (non-string) or invalid actor payload |
| `planning.rescheduleTask` | `{}` -> missing `taskId`/`nextAt` | `nextAt: "not-a-date"` |
| `job.recordRun` | `{}` -> missing required fields | `outcome: "partial"` enum violation or `jobId: "   "` non-empty violation |
| `job.inspectRun` | `{}` -> missing `jobId` | `jobId: "   "` non-empty violation |

## Implementation Notes for Next Phase
- Target file: `tests/unit/api/workflows/routes.test.ts`.
- Prefer table-driven additions for the nine uncovered keys to avoid repetitive test bodies and improve future maintainability.
- Keep assertions aligned with existing style in the same file:
  - validate left-side `WorkflowApiError`
  - assert `route` equals tested key
  - assert message contains specific field token (`entryId`, `targetType`, `nextAt`, `jobId`, etc.).

## Suggested Verification Commands (Implementation Phase)
- `bun test tests/unit/api/workflows/routes.test.ts`
- Optional guardrails if adjacent files are touched:
  - `bun test tests/unit/api/workflows/http-dispatch.test.ts`
  - `bun run typecheck`

## Research Summary
- WF-REV-002 is a focused unit-test coverage ticket with no `relevantFiles` metadata.
- Canonical payload constraints are clear in `src/api/workflows/routes.ts` and contract docs.
- The nine listed route keys are currently missing explicit route-specific malformed/empty payload assertions in `tests/unit/api/workflows/routes.test.ts`; this is the concrete gap to implement next.

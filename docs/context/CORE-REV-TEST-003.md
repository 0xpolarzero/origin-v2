# CORE-REV-TEST-003 Research Context

## Ticket
- ID: `CORE-REV-TEST-003`
- Title: `Add HTTP integration tests for activity.list invalid parameter combinations`
- Category: `testing`
- Priority: `medium`
- Description: `Cover invalid/non-boolean aiOnly, unsupported actorKind, non-positive limit, and malformed beforeAt to verify validator and sanitized error responses.`

## Relevant Files Field
- Ticket metadata exists in `.super-ralph/workflow.db` (`category_review.suggested_tickets`) with `id/title/description/category/priority`.
- `relevantFiles` and `referenceFiles` are not present for `CORE-REV-TEST-003`.

Evidence query used:

```sql
SELECT
  json_extract(value,'$.id') AS id,
  json_type(value,'$.relevantFiles') AS relevant_type,
  json_extract(value,'$.relevantFiles') AS relevant_files,
  json_type(value,'$.referenceFiles') AS reference_type,
  json_extract(value,'$.referenceFiles') AS reference_files
FROM category_review, json_each(category_review.suggested_tickets)
WHERE json_extract(value,'$.id')='CORE-REV-TEST-003';
```

## Paths Reviewed

| Path | Summary | Relevance to CORE-REV-TEST-003 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated autonomous prompt with core-first/test/typecheck/jj constraints. | Governs delivery expectations for this testing ticket. |
| `.super-ralph/generated/workflow.tsx` | Generated workflow run config; this research phase references `.super-ralph/generated/PROMPT.md`, `README.md`, and `docs`. | Confirms required research inputs and run behavior. |
| `.super-ralph/workflow.db` | Source of ticket metadata in `category_review.suggested_tickets`. | Provides ticket payload and confirms missing `relevantFiles`. |
| `README.md` | Repo map and canonical contract pointers. | Confirms `docs/contracts/workflow-api-schema-contract.md` as source for route/validation contract. |
| `docs/design.spec.md` | Product requires reliable, auditable workflow behavior and explicit failure visibility. | Supports adding missing negative-path integration coverage. |
| `docs/engineering.choices.md` | Normative quality rules: deterministic behavior and test-backed slices. | Requires this change to be test-first and focused. |
| `docs/references.md` | External reference policy. | Context only; local `docs/references/` directory is absent in this workspace. |
| `docs/super-ralph.prompt.md` | Prompt mirror of generated guardrails. | Reinforces research and delivery constraints for this ticket. |
| `docs/contracts/workflow-api-schema-contract.md` | Canonical activity route contract, shared validator rules, and dispatcher sanitization contract. | Primary contract for `activity.list` invalid-input behavior and sanitized `400` response expectations. |
| `docs/plans/WF-REV-001.md` | Prior TDD plan enumerating route-wide negative HTTP integration coverage, including `activity.list -> 400`. | Precedent for adding `activity.list` invalid-filter integration assertions. |
| `docs/context/WF-REV-001.md` | Prior research showing route-negative coverage matrix and existing `activity.list` gap. | Historical context that this ticket is closing a known coverage gap. |
| `docs/context/API-DATA-002.md` | Prior research around `activity.list` body handling and validator behavior. | Relevant baseline: `activity.list` now accepts omitted body, while still enforcing field validation. |
| `docs/test-suite-findings.md` | Integration API suite currently passing with broad sanitized error coverage. | Confirms existing suite health and that this ticket is additive regression coverage. |
| `src/api/workflows/routes.ts` | `validateListActivityRequest` enforces `actorKind`, `aiOnly`, `limit`, and `beforeAt`; validator returns `WorkflowApiError` validation failures. | Direct behavior under test for the four invalid parameter combinations. |
| `src/api/workflows/http-dispatch.ts` | Dispatcher maps `WorkflowApiError` to status and sanitizes response body to `{ error, route, message }`. | Defines exact sanitized response shape expected in integration assertions. |
| `tests/unit/api/workflows/routes.test.ts` | Unit coverage already asserts `activity.list` invalid `actorKind`, non-boolean `aiOnly`, non-positive `limit`, and malformed `beforeAt` fail validation. | Confirms validator behavior already exists at unit layer; missing piece is HTTP integration coverage. |
| `tests/unit/api/workflows/http-dispatch.test.ts` | Dispatcher unit tests include list-route bodyless cases and sanitized error examples. | Provides reusable assertion patterns for sanitized error body expectations. |
| `tests/integration/workflow-api-http.integration.test.ts` | Integration suite has `activity.list` omitted-body success and happy-path AI filter flow, but no invalid-parameter activity tests. | Primary file to implement this ticket. |

## Contract + Runtime Constraints To Preserve
1. `activity.list` request has no required fields; optional filters are `entityType`, `entityId`, `actorKind`, `aiOnly`, `limit`, `beforeAt`.
2. `actorKind` must be one of `user | system | ai`.
3. `aiOnly` must be boolean when provided.
4. `limit` must be a positive integer (`> 0`).
5. Date-like values must be `Date` or strict ISO-8601 with timezone; malformed or timezone-less strings are invalid.
6. Validation failures map to HTTP `400` with sanitized body shape `{ error, route, message }` and no internal fields (`_tag`, `cause`).

## Current Coverage Snapshot
- `tests/unit/api/workflows/routes.test.ts` already covers all four invalid `activity.list` parameters.
- `tests/integration/workflow-api-http.integration.test.ts` currently covers:
  - bodyless `activity.list` success (`200`), and
  - a valid `activity.list` flow using `aiOnly`, `beforeAt`, and `limit`.
- Missing integration assertions (ticket scope):
  - invalid/non-boolean `aiOnly`
  - unsupported `actorKind`
  - non-positive `limit`
  - malformed `beforeAt`
- Existing helper `expectSanitizedError(...)` in the integration test file already matches required sanitized-error assertions.

## Derived File Focus For Implementation
(derived because ticket metadata has no `relevantFiles`)

Primary:
- `tests/integration/workflow-api-http.integration.test.ts`

Reference/behavior sources:
- `src/api/workflows/routes.ts`
- `src/api/workflows/http-dispatch.ts`
- `tests/unit/api/workflows/routes.test.ts`

## Suggested Integration Cases For This Ticket
1. `activity.list` with `actorKind: "robot"` -> `400` sanitized error, route `activity.list`, message includes `actorKind`.
2. `activity.list` with `aiOnly: "true"` (string) -> `400` sanitized error, message includes `aiOnly`.
3. `activity.list` with `limit: 0` or `limit: -1` -> `400` sanitized error, message includes `limit`.
4. `activity.list` with malformed `beforeAt` (for example `"not-a-date"`) -> `400` sanitized error, message includes `beforeAt`.

Optional hardening variant:
- timezone-less `beforeAt` such as `"2026-02-23T10:00:00"` -> `400` (strict ISO-with-timezone rule).

## Suggested Verification Commands (implementation phase)
- `bun test tests/integration/workflow-api-http.integration.test.ts`
- `bun run test:integration:api`
- `bun run typecheck`

## Research Summary
- `CORE-REV-TEST-003` has no ticket-provided `relevantFiles`; scope is derived from contract docs, route validator code, dispatcher sanitization behavior, and existing integration tests.
- Validator logic for all requested invalid `activity.list` combinations already exists and is unit-tested.
- The missing work is focused HTTP integration coverage asserting `400` plus sanitized error body for those invalid combinations.

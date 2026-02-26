# API-DATA-002 Research Context

## Ticket
- ID: `API-DATA-002`
- Title: `Allow omitted JSON body for list routes with no required fields`
- Category: `api`
- Priority: `high`
- Description: `Update route validation for job.list and activity.list to accept undefined/empty body as valid input, consistent with contract rows that declare request required fields as none. Add dispatcher-level regression tests for bodyless POST requests.`

## Relevant Files Field
- No ticket-level `relevantFiles` payload is present for `API-DATA-002` in repository ticket metadata.
- Evidence from `.super-ralph/workflow.db`:
  - Ticket row exists with `id/title/description/category/priority`.
  - `json_type(value,'$.relevantFiles')` and `json_extract(value,'$.relevantFiles')` are null/empty.

Example queries used:

```sql
SELECT json(value)
FROM category_review, json_each(category_review.suggested_tickets)
WHERE json_extract(value,'$.id')='API-DATA-002';
```

```sql
SELECT json_type(value,'$.relevantFiles'), json_extract(value,'$.relevantFiles')
FROM category_review, json_each(category_review.suggested_tickets)
WHERE json_extract(value,'$.id')='API-DATA-002';
```

## Paths Reviewed

| Path | Summary | Relevance to API-DATA-002 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated autonomous prompt with core-first/test/jj constraints (input listed this path twice). | Confirms delivery/quality constraints for this ticket. |
| `.super-ralph/generated/workflow.tsx` | Super Ralph generated workflow config; `referenceFiles` includes generated prompt, `README.md`, and `docs`. | Confirms expected research input scope for this phase. |
| `.super-ralph/workflow.db` | Ticket metadata source (`category_review.suggested_tickets`). | Source of truth for ticket payload and missing `relevantFiles`. |
| `README.md` | Repository map and canonical contract pointers. | Confirms authoritative docs and contract location. |
| `AGENTS.md` | Repo guardrails (core-first, Effect preference, jj commits, concise commit types). | Governs implementation process and commit expectations. |
| `docs/design.spec.md` | Product goals include reliable planning/execution and auditable workflows. | Reliability baseline for API input-handling consistency. |
| `docs/engineering.choices.md` | Normative quality rules: deterministic core behavior + targeted tests/typecheck per slice. | Requires test-backed behavior change for this ticket. |
| `docs/references.md` | External reference policy for `docs/references/*`. | Reference policy context; local references directory unavailable. |
| `docs/super-ralph.prompt.md` | Canonical prompt mirror of generated constraints. | Confirms same run constraints as generated prompt. |
| `docs/contracts/workflow-api-schema-contract.md` | Canonical route payload contract; `job.list` and `activity.list` declare required fields as `none`. | Primary contract requiring bodyless list requests to be valid. |
| `docs/contracts/workflow-api-routes.md` | Compatibility pointer to canonical contract doc. | Confirms single source of truth for route payload rules. |
| `docs/context/API-DATA-001.md` | Prior API-DATA research format and evidence pattern. | Template/reference for writing this context file. |
| `docs/context/API-006.md` | Contract-doc parity context linking routes, validator rules, and dispatcher behavior. | Reinforces contract-first interpretation of request validation behavior. |
| `docs/plans/WF-AUDIT-003.md` | Historical TDD plan where `job.list` and `activity.list` validators and dispatcher tests were introduced. | Precedent for extending validator/dispatcher coverage in this exact area. |
| `src/api/workflows/contracts.ts` | `ListJobsRequest` and `ListActivityRequest` contain only optional fields. | Type-level signal that empty payloads should be acceptable. |
| `src/api/workflows/routes.ts` | `validateListJobsRequest` and `validateListActivityRequest` call `parseRecord(route, input)` and currently reject `undefined`. | Current implementation seam causing bodyless POST failures. |
| `src/api/workflows/workflow-api.ts` | `listJobs` and `listActivity` wrappers simply forward validated input. | Confirms behavior is decided at route-validation layer. |
| `src/api/workflows/http-dispatch.ts` | Dispatcher passes `request.body` directly to route handlers; missing body means `undefined`. | Shows bodyless POST currently reaches validators as `undefined`. |
| `src/ui/workflows/workflow-surface-client.ts` | `listJobs` and `listActivity` default to `{}` when client omits input. | Explains why UI path may not surface the bodyless bug while dispatcher calls can. |
| `tests/unit/api/workflows/routes.test.ts` | Contains global test asserting every route rejects `undefined` payload and per-route validation tests for `job.list`/`activity.list`. | Must be updated to allow `undefined` for list routes with no required fields. |
| `tests/unit/api/workflows/http-dispatch.test.ts` | Dispatcher tests cover `job.list`/`activity.list` only with object bodies; no bodyless regression coverage. | Primary test file to add bodyless POST regression tests per ticket. |
| `tests/integration/workflow-api-http.integration.test.ts` | HTTP integration coverage currently always supplies a `body` object. | Optional integration extension point (ticket explicitly requires dispatcher-level tests). |
| `tests/integration/api-contract-docs.integration.test.ts` | Enforces route payload matrix existence and parity with runtime route registry. | Ensures contract row (`none`) remains authoritative and visible. |
| `src/core/tooling/contract-doc-policy.ts` | Parses authoritative contract markdown tables and required sections. | Contract tooling context; runtime behavior still controlled by route validators. |
| `docs/references/` | Directory is absent in workspace (`No such file or directory`). | External reference repos unavailable for this run. |

## Contract vs Implementation Snapshot

1. Canonical contract rows state:
   - `job.list` request required fields: `none`.
   - `activity.list` request required fields: `none`.
2. Runtime type contracts match this shape (`ListJobsRequest` and `ListActivityRequest` are all-optional fields).
3. Current route validators for both list routes call `parseRecord(route, input)`, which rejects non-object input, including `undefined`.
4. Dispatcher forwards `request.body` as-is; omitted body (`{ method, path }` with no `body`) reaches route handler as `undefined`.
5. Result: bodyless POST requests to `/api/workflows/job/list` and `/api/workflows/activity/list` currently fail validation (`400`) even though contract required fields are `none`.
6. Existing unit test `route handlers reject undefined payloads with WorkflowApiError` currently enforces the old behavior for every route, including these two list routes.

## Existing Test/Pattern Gaps
- `tests/unit/api/workflows/http-dispatch.test.ts` has no regression asserting success for bodyless POST on `job.list`/`activity.list`.
- `tests/unit/api/workflows/routes.test.ts` has no positive assertion that these two validators accept `undefined` and normalize to optional-filter input.
- Integration tests are already broad but currently always send object bodies; this ticket scope can be satisfied at dispatcher unit-test level.

## Derived File Focus for Implementation
(derived because ticket metadata has no `relevantFiles`)

Primary:
- `src/api/workflows/routes.ts`
- `tests/unit/api/workflows/routes.test.ts`
- `tests/unit/api/workflows/http-dispatch.test.ts`

Secondary/optional:
- `tests/integration/workflow-api-http.integration.test.ts` (if additional bodyless end-to-end guard is desired)

## Expected Implementation Shape (for next phase)
- Update list-route validation so `job.list` and `activity.list` treat `undefined` input as an empty object payload.
- Keep validation strict for malformed values (`runState`, `actorKind`, `aiOnly`, date fields, limits).
- Preserve existing behavior for routes with required fields.
- Add dispatcher-level regression tests for bodyless POST requests on both list routes.
- Update/adjust the global undefined-payload route test so only routes with required request fields must reject `undefined`.

## Open Decisions / Assumptions
1. `null` body handling: contract says omitted/empty body; assumed `undefined` and `{}` should be valid, while `null` can remain invalid unless explicitly expanded.
2. Test scope: ticket explicitly requests dispatcher-level regressions; integration-level additions are optional.

## Suggested Verification Commands (implementation phase)
- `bun test tests/unit/api/workflows/routes.test.ts`
- `bun test tests/unit/api/workflows/http-dispatch.test.ts`
- `bun test tests/integration/workflow-api-http.integration.test.ts`
- `bun run typecheck`

## Research Summary
- Contract docs already declare `job.list` and `activity.list` required request fields as `none`.
- Current validator implementation still rejects omitted bodies because both validators require `input` to be an object.
- Dispatcher currently passes omitted request bodies as `undefined`, so bodyless POST requests regress to `400` for these routes.
- Implementation should be a small validator adjustment plus focused route/dispatcher regression tests.

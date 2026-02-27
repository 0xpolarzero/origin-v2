# API-DATA-003 Research Context

## Ticket
- ID: `API-DATA-003`
- Title: `Relax date-like parser to full ISO-8601 timezone support`
- Category: `api`
- Priority: `medium`
- Description: `Replace or broaden ISO_8601_PATTERN in workflow route parsing to accept valid ISO-8601 timezone forms (for example 2026-02-23T10:00Z) while still rejecting timezone-less values. Add route-level tests for accepted/rejected variants.`

## Relevant Files Field
- No ticket-level `relevantFiles` payload is present for `API-DATA-003` in repository ticket metadata.
- Evidence from `.super-ralph/workflow.db`:
  - Ticket row exists with `id/title/description/category/priority`.
  - `json_type(value,'$.relevantFiles')` and `json_extract(value,'$.relevantFiles')` are null/empty.

Example queries used:

```sql
WITH latest AS (
  SELECT suggested_tickets
  FROM category_review
  WHERE category_id='api'
  ORDER BY rowid DESC
  LIMIT 1
)
SELECT json(value)
FROM latest, json_each(latest.suggested_tickets)
WHERE json_extract(value,'$.id')='API-DATA-003';
```

```sql
WITH latest AS (
  SELECT suggested_tickets
  FROM category_review
  WHERE category_id='api'
  ORDER BY rowid DESC
  LIMIT 1
)
SELECT
  json_type(value,'$.relevantFiles'),
  json_extract(value,'$.relevantFiles')
FROM latest, json_each(latest.suggested_tickets)
WHERE json_extract(value,'$.id')='API-DATA-003';
```

## Paths Reviewed

| Path | Summary | Relevance to API-DATA-003 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated autonomous build prompt (listed twice in request input). | Confirms core-first/testing/jj constraints for ticket work. |
| `.super-ralph/generated/workflow.tsx` | Generated workflow config with `referenceFiles` set to `.super-ralph/generated/PROMPT.md`, `README.md`, and `docs`. | Confirms expected research input scope and commit policy (`feat|fix|docs|chore`). |
| `.super-ralph/workflow.db` | Source of ticket metadata in `category_review.suggested_tickets`. | Source-of-truth evidence for ticket payload and missing `relevantFiles`. |
| `README.md` | Repo overview and canonical contract pointers. | Confirms where normative API contract docs live. |
| `AGENTS.md` | Local agent rules and source-of-truth doc list. | Governs this phase behavior and constraints. |
| `docs/design.spec.md` | Product goals emphasize reliable planning/execution and auditability. | Reliability requirement supports strict-but-correct date input validation. |
| `docs/engineering.choices.md` | Normative quality rules: deterministic behavior and focused tests per slice. | Requires test-backed parser behavior updates. |
| `docs/references.md` | External reference repo policy under `docs/references/*`. | Reference policy context; local `docs/references/` directory is absent in this workspace. |
| `docs/super-ralph.prompt.md` | Canonical prompt mirror of generated prompt constraints. | Reconfirms delivery expectations and validation bar. |
| `docs/contracts/workflow-api-schema-contract.md` | Canonical route contract says date-like fields accept `Date` or ISO-8601 strings with timezone (`Z` or offset). | Primary contract requirement for timezone-bearing acceptance + timezone-less rejection. |
| `docs/contracts/workflow-api-routes.md` | Compatibility pointer to canonical contract doc. | Confirms single source of truth for route payload/date rules. |
| `docs/contracts/persisted-schema.md` | Compatibility pointer to canonical contract doc. | Confirms schema docs are consolidated and route contract is canonical. |
| `src/api/workflows/contracts.ts` | Route request types carry `Date` fields (`at`, `beforeAt`, `beforeUpdatedAt`, etc.). | Type-level expectation that parser should coerce valid date-like strings to `Date`. |
| `src/api/workflows/routes.ts` | Date parser seam: `ISO_8601_PATTERN` + `parseDateLike` + `parseDateField` used by route validators. | Primary implementation target for broadening accepted timezone forms. |
| `tests/unit/api/workflows/routes.test.ts` | Route-level validator coverage includes date coercion, offset acceptance (`+01:00`), and timezone-less rejection. | Primary test target for new accepted/rejected ISO variant coverage required by ticket. |
| `tests/unit/api/workflows/http-dispatch.test.ts` | Dispatcher-level validation/error-mapping tests for route handlers. | Secondary regression surface; ticket explicitly asks route-level tests, so this is optional. |
| `tests/integration/workflow-api-http.integration.test.ts` | End-to-end HTTP route coverage with many timestamp payloads and malformed-date checks. | Optional higher-level regression surface if broader confidence is desired later. |
| `docs/context/API-DATA-002.md` | Prior API-DATA research doc pattern. | Template reference for context-file structure and evidence style. |

## Current Implementation Snapshot (Date Parsing)

1. `src/api/workflows/routes.ts` defines:
   - `ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/`
   - This requires seconds (`:ss`) and only accepts offsets shaped `+HH:MM`.
2. `parseDateLike` accepts either:
   - a real `Date` instance, or
   - a string matching `ISO_8601_PATTERN`, then `new Date(value)` if valid.
3. Because seconds are mandatory, valid ISO timestamp forms like `2026-02-23T10:00Z` are currently rejected before `Date` parsing.

Observed probe from current code path:

```bash
bun -e '... route=job.listHistory ... beforeAt:"2026-02-23T10:00Z" ...'
```

Result:
- `WorkflowApiError`
- message includes `beforeAt must be a valid Date`

## Existing Route-Level Tests and Gap

Existing coverage in `tests/unit/api/workflows/routes.test.ts` already includes:
- Coercion of ISO string timestamps to `Date`.
- Acceptance of an offset form with seconds: `2026-02-23T10:00:00+01:00`.
- Rejection of timezone-less value: `2026-02-23T10:00:00`.

Gap relative to ticket:
- No acceptance test for timezone-bearing ISO forms without seconds (example in ticket: `2026-02-23T10:00Z`).
- No broader variant matrix at route level documenting accepted/rejected timezone forms.

## Candidate Accepted/Rejected Variant Set for Implementation Tests

Recommended accepted variants (timezone present):
- `2026-02-23T10:00Z`
- `2026-02-23T10:00+01:00`
- `2026-02-23T10:00-05:30`
- `2026-02-23T10:00:00Z`
- `2026-02-23T10:00:00.123456789+01:00`

Recommended rejected variants (timezone missing or malformed):
- `2026-02-23T10:00`
- `2026-02-23T10:00:00`
- `2026-02-23T10:00:00+01` (offset minutes missing)
- `2026-02-23T10:00:00+` (incomplete timezone)
- `not-a-date`

## Derived File Focus for Implementation
(derived because ticket metadata has no `relevantFiles`)

Primary:
- `src/api/workflows/routes.ts`
- `tests/unit/api/workflows/routes.test.ts`

Secondary/optional:
- `tests/integration/workflow-api-http.integration.test.ts`
- `tests/unit/api/workflows/http-dispatch.test.ts`

## Expected Implementation Shape (for next phase)

- Broaden the date-like string gate in `parseDateLike` so timezone-bearing ISO timestamps without seconds are accepted.
- Preserve strict rejection for timezone-less timestamps.
- Keep current behavior of parsing accepted strings through `new Date(...)` and rejecting invalid resulting dates.
- Add route-level tests with explicit accepted/rejected variant arrays to prevent regressions.

## Open Decisions / Assumptions

1. Ticket example clearly requires supporting minute-precision timezone forms (`YYYY-MM-DDTHH:mmZ` / `YYYY-MM-DDTHH:mm±HH:MM`).
2. Scope beyond that (for example basic offsets like `+0100` or lowercase `z`) is not explicit; keep route tests aligned to explicit contract language (`Z` or offset) unless widened intentionally.
3. Route-level tests are mandatory per ticket text; dispatcher/integration extensions are optional.

## Suggested Verification Commands (implementation phase)

- `bun test tests/unit/api/workflows/routes.test.ts`
- `bun test tests/unit/api/workflows/http-dispatch.test.ts`
- `bun test tests/integration/workflow-api-http.integration.test.ts`
- `bun run typecheck`

## Research Summary

- Contract docs require date-like route fields to accept ISO-8601 strings that include timezone (`Z` or offset).
- Current parser regex is stricter than that requirement because it requires seconds, so values like `2026-02-23T10:00Z` fail today.
- Existing route tests already cover one offset form and timezone-less rejection, but they do not cover no-seconds timezone forms highlighted by the ticket.
- Implementation should be a focused parser broadening plus route-level accepted/rejected variant tests.

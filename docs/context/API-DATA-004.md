# API-DATA-004 Research Context

## Ticket
- ID: `API-DATA-004`
- Title: `Enforce integer invariant for checkpoint auditCursor`
- Category: `data`
- Priority: `medium`
- Description: `Reject non-integer auditCursor in checkpoint.create validation/service logic, and add repository/schema guardrails/tests so persisted checkpoint audit_cursor cannot be fractional.`

## Relevant Files Field
- No ticket-level `relevantFiles` payload is present for `API-DATA-004` in repository ticket metadata.
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
WHERE json_extract(value,'$.id')='API-DATA-004';
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
WHERE json_extract(value,'$.id')='API-DATA-004';
```

## Spec + Contract Constraints
- `docs/design.spec.md`: auditability/recovery for AI-applied changes is a core product goal.
- `docs/engineering.choices.md`: deterministic, test-backed core behavior is required per slice.
- `docs/contracts/workflow-api-schema-contract.md`:
  - `checkpoint.create` currently documents `auditCursor:number (required)`.
  - persisted schema documents `checkpoint.audit_cursor:INTEGER(required)`.
- SQLite `INTEGER` affinity alone is not strict typing; guardrails are needed if fractional values must be impossible.

## Paths Reviewed

| Path | Summary | Relevance to API-DATA-004 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated autonomous prompt with core-first/testing/jj constraints (listed twice in request). | Confirms delivery constraints for this ticket. |
| `.super-ralph/generated/workflow.tsx` | Workflow fallback config includes `referenceFiles` (`PROMPT`, `README`, `docs`) and commit policy (`feat|fix|docs|chore`). | Confirms research scope and commit constraints. |
| `.super-ralph/workflow.db` | Source-of-truth ticket metadata (`category_review.suggested_tickets`). | Confirms ticket payload and missing `relevantFiles`. |
| `README.md` | Repo map and canonical contract pointers. | Identifies normative docs and contract test surfaces. |
| `docs/design.spec.md` | Product goals include explicit auditability and recovery. | Integer cursor invariant supports reliable audit/recovery semantics. |
| `docs/engineering.choices.md` | Normative quality rules (deterministic behavior + tests/typecheck per slice). | Requires test-first invariant enforcement across layers. |
| `docs/references.md` | External reference-repo policy (`docs/references/*`). | Reference policy context only; local `docs/references/` is absent. |
| `docs/super-ralph.prompt.md` | Canonical prompt mirror of generated constraints. | Reconfirms run/validation expectations. |
| `docs/contracts/workflow-api-schema-contract.md` | Canonical API + persisted schema contract. | Primary contract source for `checkpoint.create` and `checkpoint.audit_cursor`. |
| `docs/contracts/workflow-api-routes.md` | Compatibility pointer to canonical contract. | Confirms no alternate route contract source. |
| `docs/contracts/persisted-schema.md` | Compatibility pointer to canonical contract. | Confirms no alternate schema contract source. |
| `src/api/workflows/routes.ts` | `checkpoint.create` uses `parseNumberField(...)` for `auditCursor`; parser allows any finite number. | Primary API validation seam for rejecting fractional input. |
| `src/core/services/checkpoint-service.ts` | Forwards `input.auditCursor` into domain create call; no integer guard. | Service-level invariant seam requested by ticket. |
| `src/core/domain/checkpoint.ts` | `createCheckpoint` validates name/rollback only; copies `auditCursor` as-is. | Central domain seam to enforce integer invariant for all callers. |
| `src/core/domain/common.ts` | Shared domain validation utilities (`DomainValidationError`, `validateNonEmpty`). | Pattern source for adding integer validation error. |
| `src/core/repositories/sqlite/sqlite-core-repository.ts` | Generic encoder persists numeric fields directly to sqlite bindings. | Repository path can currently persist fractional `audit_cursor`. |
| `src/core/database/migrations/001_core_schema.sql` | Defines `checkpoint.audit_cursor INTEGER NOT NULL`. | Column affinity exists but does not block REAL values. |
| `src/core/database/migrations/002_core_constraints_indexes.sql` | Has `checkpoint_status_check_*` triggers only; no `audit_cursor` type trigger. | Schema guardrail gap for fractional persistence. |
| `src/core/repositories/sqlite/migrations.ts` | Ordered `CORE_DB_MIGRATIONS` currently `001..005`. | Any new schema guard should be a new migration (likely `006_*`). |
| `src/core/repositories/sqlite/migration-runner.ts` | Migration checksums/ledger enforce immutable historical migrations. | Confirms guardrails should not mutate existing applied migration SQL. |
| `tests/unit/api/workflows/routes.test.ts` | Covers many checkpoint validations, but no non-integer `auditCursor` rejection case. | Primary route-level regression target. |
| `tests/unit/core/domain/checkpoint.test.ts` | Happy-path checkpoint creation only. | Add domain-level invalid `auditCursor` case here (or equivalent service case). |
| `tests/unit/core/services/checkpoint-service.test.ts` | Broad checkpoint service coverage, no fractional `auditCursor` rejection. | Service-level regression target requested by ticket. |
| `tests/unit/core/repositories/sqlite-schema.test.ts` | Extensive trigger/integrity tests, no checkpoint `audit_cursor` type guard assertions. | Primary schema-guard regression target. |
| `tests/unit/core/repositories/sqlite-migrations.test.ts` | Asserts exact migration ID list/order (`001..005`). | Must update if new migration is added for guardrail trigger(s). |
| `tests/integration/database-core-platform.integration.test.ts` | Database-backed checkpoint integration flow coverage. | Optional integration seam to assert persisted integer storage behavior. |
| `tests/integration/api-contract-docs.integration.test.ts` | Enforces canonical contract parity with migration IDs/triggers/indexes. | Contract docs must be updated if migration/trigger set changes. |
| `src/core/tooling/contract-doc-policy.ts` | Parses migration/trigger/index tables from contract markdown. | Explains why contract docs must reflect any new migration/trigger names exactly. |
| `docs/context/API-DATA-003.md` | Prior API-DATA context format. | Template reference for research file structure/evidence style. |
| `docs/context/API-DATA-005.md` | Prior API-DATA context format including `workflow.db` evidence and gap matrix style. | Template reference for this context slice. |
| `docs/references/` | Directory absent (`No such file or directory`). | No local external references available in this run. |

## Current Implementation Snapshot
1. Route validation currently accepts fractional `auditCursor`:
   - `validateCreateWorkflowCheckpointRequest` calls `parseNumberField(...)`.
   - `parseNumberField(...)` accepts any finite number (integer or fractional).
2. Service/domain currently accept and propagate fractional values:
   - `createWorkflowCheckpoint(...)` forwards `auditCursor` into `createCheckpoint(...)`.
   - `createCheckpoint(...)` does not validate integer-ness.
3. SQLite persistence currently allows REAL values in `checkpoint.audit_cursor`:
   - Column is declared `INTEGER`, but no strict typing trigger/check exists.
   - Encoder writes numeric values directly, so `1.5` can persist.
4. Existing schema triggers cover checkpoint lifecycle status only:
   - `checkpoint_status_check_insert`
   - `checkpoint_status_check_update`
   - no trigger for numeric storage class on `audit_cursor`.

## Evidence Probes (Current Behavior)

Route accepts fractional `auditCursor`:
```bash
bun -e '... makeWorkflowRoutes(...).find("checkpoint.create").handle({ auditCursor: 1.5, ... })'
```
Result: handler succeeds and forwards `auditCursor: 1.5`.

Service accepts fractional `auditCursor`:
```bash
bun -e '... createWorkflowCheckpoint(repository, { auditCursor: 1.5, ... })'
```
Result: checkpoint created with `checkpoint.auditCursor === 1.5`.

SQLite persists fractional value in `INTEGER` column:
```bash
sqlite3 :memory: "CREATE TABLE checkpoint(audit_cursor INTEGER NOT NULL); INSERT INTO checkpoint(audit_cursor) VALUES (1.5); SELECT audit_cursor, typeof(audit_cursor) FROM checkpoint;"
```
Result: `1.5|real`.

Database-backed platform probe:
- `createWorkflowCheckpoint({ auditCursor: 1.5, ... })` persisted row with `typeof(audit_cursor) = 'real'`.

## Coverage Gap Matrix

| Required ticket coverage | Current state | Gap |
| --- | --- | --- |
| `checkpoint.create` rejects non-integer `auditCursor` | No route test or validator guard for integer-only | Missing |
| Service/domain rejects fractional `auditCursor` | No integer validation in `checkpoint-service` or `createCheckpoint` | Missing |
| Persisted `checkpoint.audit_cursor` cannot be fractional | No trigger/check guard for storage type | Missing |
| Schema-level regression tests for `audit_cursor` integer invariant | No checkpoint `audit_cursor` tests in sqlite schema suite | Missing |
| Migration ledger/docs parity for added guardrails | Migration IDs and trigger names are contract-locked | Needs coordinated updates if migration/trigger changes |

## Derived File Focus For Implementation
(derived because ticket metadata has no `relevantFiles`)

Primary implementation:
- `src/api/workflows/routes.ts`
- `src/core/domain/checkpoint.ts`
- `src/core/services/checkpoint-service.ts`
- `src/core/database/migrations/006_checkpoint_audit_cursor_integer.sql` (new)
- `src/core/repositories/sqlite/migrations.ts`

Primary tests:
- `tests/unit/api/workflows/routes.test.ts`
- `tests/unit/core/domain/checkpoint.test.ts`
- `tests/unit/core/services/checkpoint-service.test.ts`
- `tests/unit/core/repositories/sqlite-schema.test.ts`
- `tests/unit/core/repositories/sqlite-migrations.test.ts`

Supporting/contract parity:
- `docs/contracts/workflow-api-schema-contract.md`
- `tests/integration/api-contract-docs.integration.test.ts`
- `tests/integration/database-core-platform.integration.test.ts` (optional but useful for end-to-end persistence assertion)

## Expected Implementation Shape (for next phase)
1. API validation:
   - Replace checkpoint `auditCursor` parsing from generic finite number to integer-only numeric validation.
2. Service/domain guardrail:
   - Enforce integer invariant in domain/service path so non-route callers cannot bypass invariant.
   - Surface as `invalid_request`/validation error path.
3. SQLite schema guardrail:
   - Add insert/update trigger(s) enforcing integer storage class for `checkpoint.audit_cursor` (for example `typeof(NEW.audit_cursor) = 'integer'`).
   - Keep this in a new migration file to preserve migration immutability/checksum history.
4. Tests:
   - Route-level: non-integer `auditCursor` -> sanitized `400`.
   - Domain/service: non-integer `auditCursor` rejected.
   - Schema-level: direct SQL insert/update with fractional `audit_cursor` aborts.
   - Migration suite: include new migration ID and order.
5. Contract parity:
   - Update canonical contract migration ledger/trigger tables (and any `auditCursor` field wording) if runtime schema adds trigger/migration objects.

## Open Decisions / Assumptions
1. Numeric domain beyond integer-ness (for example non-negative constraint) is not explicit in ticket; scope minimum is integer-only invariant.
2. Schema guard should cover both INSERT and UPDATE so repository writes cannot introduce fractional drift later.
3. Domain-level validation is the most reliable service guardrail because all service call paths converge there.

## Suggested Verification Commands (implementation phase)
- `bun test tests/unit/api/workflows/routes.test.ts`
- `bun test tests/unit/core/domain/checkpoint.test.ts`
- `bun test tests/unit/core/services/checkpoint-service.test.ts`
- `bun test tests/unit/core/repositories/sqlite-schema.test.ts`
- `bun test tests/unit/core/repositories/sqlite-migrations.test.ts`
- `bun test tests/integration/database-core-platform.integration.test.ts`
- `bun test tests/integration/api-contract-docs.integration.test.ts`
- `bun run typecheck`

## Research Summary
- `API-DATA-004` has no ticket-provided `relevantFiles`, so implementation scope must be derived from code/docs.
- Current route/service/domain/repository behavior allows fractional `auditCursor` end-to-end.
- SQLite `INTEGER` affinity does not prevent fractional storage (`REAL`) without explicit trigger/check guardrails.
- Implementation will require coordinated changes across validation, domain/service invariants, schema migration, and regression tests, with contract-doc parity updates if migration/trigger sets change.

# API-002 review fix TDD log

This log records red-green verification for review fixes after `ba1b61d`.

## 1) Signal -> task SQLite regression

Test-first change:
- Added integration case in `tests/integration/database-core-platform.integration.test.ts`:
  `database backend converts triaged signals into tasks without entry links`

Red run before service fix:
- `bun test tests/integration/database-core-platform.integration.test.ts`
- Failure included: `failed to persist task:task-db-from-signal-1: invalid task.source_entry_id`

Green run after fix in `src/core/services/signal-service.ts`:
- `bun test tests/integration/database-core-platform.integration.test.ts`
- Result: all tests passed.

## 2) Delete-side referential integrity + redundant index

Test-first changes in `tests/unit/core/repositories/sqlite-schema.test.ts`:
- Relation index assertion updated to require no `idx_audit_transitions_entity_ref`
- Added `linked references reject parent deletes that would orphan child rows`

Red run before migration fix:
- `bun test tests/unit/core/repositories/sqlite-schema.test.ts`
- Failures included:
  - `idx_audit_transitions_entity_ref` unexpectedly present
  - parent delete did not abort for linked references

Green run after fix in `src/core/database/migrations/003_relation_integrity.sql`:
- `bun test tests/unit/core/repositories/sqlite-schema.test.ts`
- Result: all tests passed.

## 3) entity_versions.updated_at monotonicity on out-of-order inserts

Test-first change in `tests/unit/core/repositories/sqlite-schema.test.ts`:
- Added `entity_versions.updated_at keeps max transition timestamp for out-of-order inserts`

Red run before trigger fix:
- `bun test tests/unit/core/repositories/sqlite-schema.test.ts`
- Failure included updated_at regression from `2026-02-23T00:00:02.000Z` to `2026-02-23T00:00:00.000Z`

Green run after fix in `src/core/database/migrations/004_audit_entity_versions.sql`:
- `bun test tests/unit/core/repositories/sqlite-schema.test.ts`
- Result: all tests passed.

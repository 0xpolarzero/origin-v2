# CORE-REV-003 Plan: App-Level Database Schema and Migrations (TDD First)

## Overview
Implement a SQLite-backed app-level storage layer with explicit migrations, covering all core entities from `docs/design.spec.md:14-25` and scope requirements in `docs/design.spec.md:60-65` (local-first durability, explicit approval support, auditable/reversible AI writes).

Approach:
1. Add deterministic migration primitives and a migration ledger.
2. Add baseline SQL schema and indexes/check constraints for core entities + audit trail.
3. Add a SQLite `CoreRepository` implementation that preserves existing repository semantics.
4. Wire `buildCorePlatform` to initialize SQLite + migrations at app startup.
5. Add restart and workflow integration coverage on the database backend.
6. Keep snapshot compatibility via an optional one-time import path to reduce migration risk.

## TDD Step Order (tests first, then implementation)

1. **Test:** `tests/unit/core/repositories/sqlite-migrations.test.ts` -> `CORE_DB_MIGRATIONS contains unique, increasing ids and non-empty SQL`.
   **Implement:** `src/core/repositories/sqlite/migrations.ts` -> `export interface SqliteMigration` and `export const CORE_DB_MIGRATIONS: ReadonlyArray<SqliteMigration>`.
2. **Test:** `tests/unit/core/repositories/sqlite-migrations.test.ts` -> `runSqliteMigrations creates schema_migrations ledger on empty database`.
   **Implement:** `src/core/repositories/sqlite/migration-runner.ts` -> `ensureMigrationLedger(db: Database): Effect.Effect<void, MigrationRunnerError>`.
3. **Test:** `tests/unit/core/repositories/sqlite-migrations.test.ts` -> `runSqliteMigrations applies pending migrations in id order and records checksum`.
   **Implement:** `src/core/repositories/sqlite/migration-runner.ts` -> `applyPendingMigrations(db: Database, migrations: ReadonlyArray<SqliteMigration>): Effect.Effect<void, MigrationRunnerError>`.
4. **Test:** `tests/unit/core/repositories/sqlite-migrations.test.ts` -> `runSqliteMigrations is idempotent when run multiple times`.
   **Implement:** `src/core/repositories/sqlite/migration-runner.ts` -> `runSqliteMigrations(db: Database, migrations: ReadonlyArray<SqliteMigration>): Effect.Effect<void, MigrationRunnerError>`.
5. **Test:** `tests/unit/core/repositories/sqlite-schema.test.ts` -> `baseline migration creates tables for entry/task/event/project/note/signal/job/notification/view/memory/checkpoint/outbound_draft plus audit_transitions and memory_key_index`.
   **Implement:** `src/core/database/migrations/001_core_schema.sql`.
6. **Test:** `tests/unit/core/repositories/sqlite-schema.test.ts` -> `schema enforces critical constraints/indexes (lifecycle states, audit lookup, memory key uniqueness)`.
   **Implement:** `src/core/database/migrations/002_core_constraints_indexes.sql`.
7. **Test:** `tests/unit/core/repositories/sqlite-core-repository.test.ts` -> `saveEntity persists row to the mapped table for a core entity`.
   **Implement:** `src/core/repositories/sqlite/sqlite-core-repository.ts` -> `saveEntity(entityType: EntityType | string, entityId: string, entity: unknown): Effect.Effect<void, SqliteCoreRepositoryError>`.
8. **Test:** `tests/unit/core/repositories/sqlite-core-repository.test.ts` -> `getEntity returns undefined for missing rows and parsed entity for existing rows`.
   **Implement:** `src/core/repositories/sqlite/sqlite-core-repository.ts` -> `getEntity<T>(entityType: EntityType | string, entityId: string): Effect.Effect<T | undefined, SqliteCoreRepositoryError>`.
9. **Test:** `tests/unit/core/repositories/sqlite-core-repository.test.ts` -> `listEntities returns deterministic rows for a single entity type`.
   **Implement:** `src/core/repositories/sqlite/sqlite-core-repository.ts` -> `listEntities<T>(entityType: EntityType | string): Effect.Effect<ReadonlyArray<T>, SqliteCoreRepositoryError>`.
10. **Test:** `tests/unit/core/repositories/sqlite-core-repository.test.ts` -> `deleteEntity removes persisted rows and supports auxiliary memory_key_index records`.
    **Implement:** `src/core/repositories/sqlite/sqlite-core-repository.ts` -> `deleteEntity(entityType: EntityType | string, entityId: string): Effect.Effect<void, SqliteCoreRepositoryError>` and internal entityType->table mapping helper.
11. **Test:** `tests/unit/core/repositories/sqlite-core-repository.test.ts` -> `appendAuditTransition persists actor/reason/state metadata as append-only rows`.
    **Implement:** `src/core/repositories/sqlite/sqlite-core-repository.ts` -> `appendAuditTransition(transition: AuditTransition): Effect.Effect<void, SqliteCoreRepositoryError>`.
12. **Test:** `tests/unit/core/repositories/sqlite-core-repository.test.ts` -> `listAuditTrail filters by entityType/entityId and preserves insertion order`.
    **Implement:** `src/core/repositories/sqlite/sqlite-core-repository.ts` -> `listAuditTrail(filter?: AuditTrailFilter): Effect.Effect<ReadonlyArray<AuditTransition>, SqliteCoreRepositoryError>`.
13. **Integration Test:** `tests/integration/database-core-platform.integration.test.ts` -> `buildCorePlatform({ databasePath }) runs migrations and executes existing workflow routes on SQLite backend`.
    **Implement:** `src/core/app/core-platform.ts` -> `BuildCorePlatformOptions.databasePath?: string` and repository selection route wiring for `makeSqliteCoreRepository`.
14. **Integration Test:** `tests/integration/database-core-platform.integration.test.ts` -> `database-backed platform preserves local-first authored data and pending approval state across restart`.
    **Implement:** `src/core/repositories/sqlite/sqlite-core-repository.ts` -> `close(): Effect.Effect<void, SqliteCoreRepositoryError>` and `src/core/app/core-platform.ts` -> optional `close()` passthrough on `CorePlatform` for clean restart tests.
15. **Integration Test:** `tests/integration/database-core-platform.integration.test.ts` -> `database-backed checkpoint keep/recover remains auditable and reversible`.
    **Implement:** `src/core/repositories/sqlite/sqlite-core-repository.ts` -> JSON encode/decode helpers for complex fields (`view.filters`, `note.linkedEntityRefs`, `checkpoint.snapshotEntityRefs`, `checkpoint.snapshotEntities`, `audit.metadata`).
16. **Integration Test:** `tests/integration/database-core-platform.integration.test.ts` -> `legacy snapshot import can hydrate empty SQLite database once when snapshotPath is supplied`.
    **Implement:** `src/core/app/core-platform.ts` -> `importSnapshotIntoDatabase?: boolean` option + one-time import bootstrap path guarded to empty-DB-only behavior.

## Files to Create/Modify (with specific function signatures)

### Create
- `src/core/database/migrations/001_core_schema.sql`
- `src/core/database/migrations/002_core_constraints_indexes.sql`
- `src/core/repositories/sqlite/migrations.ts`
  - `export interface SqliteMigration { id: string; name: string; sql: string; checksum: string }`
  - `export const CORE_DB_MIGRATIONS: ReadonlyArray<SqliteMigration>`
- `src/core/repositories/sqlite/migration-runner.ts`
  - `export class MigrationRunnerError extends Data.TaggedError("MigrationRunnerError")<{ message: string }>`
  - `export const ensureMigrationLedger: (db: Database) => Effect.Effect<void, MigrationRunnerError>`
  - `export const runSqliteMigrations: (db: Database, migrations: ReadonlyArray<SqliteMigration>) => Effect.Effect<void, MigrationRunnerError>`
- `src/core/repositories/sqlite/sqlite-core-repository.ts`
  - `export class SqliteCoreRepositoryError extends Data.TaggedError("SqliteCoreRepositoryError")<{ message: string }>`
  - `export interface SqliteCoreRepositoryOptions { databasePath: string; runMigrationsOnInit?: boolean; migrations?: ReadonlyArray<SqliteMigration> }`
  - `export const makeSqliteCoreRepository: (options: SqliteCoreRepositoryOptions) => Effect.Effect<CoreRepository & { close: () => Effect.Effect<void, SqliteCoreRepositoryError> }, SqliteCoreRepositoryError>`
- `tests/unit/core/repositories/sqlite-migrations.test.ts`
- `tests/unit/core/repositories/sqlite-schema.test.ts`
- `tests/unit/core/repositories/sqlite-core-repository.test.ts`
- `tests/integration/database-core-platform.integration.test.ts`

### Modify
- `src/core/repositories/core-repository.ts`
  - add optional lifecycle hook: `close?: () => Effect.Effect<void, Error>`
- `src/core/app/core-platform.ts`
  - add `databasePath?: string`
  - add `runMigrationsOnInit?: boolean`
  - add `importSnapshotIntoDatabase?: boolean`
  - add optional platform lifecycle passthrough: `close?: () => Effect.Effect<void, Error>`
- `package.json`
  - include new integration file in scripts or add a dedicated script (for example `test:integration:db`)

## Tests to Write

### Unit tests
- `tests/unit/core/repositories/sqlite-migrations.test.ts`
  - migration ids/checksums are deterministic and ordered.
  - migration ledger table is created automatically.
  - pending migrations are applied once and tracked.
  - rerun is idempotent and does not duplicate ledger rows.
- `tests/unit/core/repositories/sqlite-schema.test.ts`
  - baseline tables exist for all core entities and audit requirements.
  - status/lifecycle check constraints reject invalid states.
  - required indexes exist (`audit_transitions(entity_type, entity_id, at)`, memory key uniqueness, key lookup indexes for common query paths).
- `tests/unit/core/repositories/sqlite-core-repository.test.ts`
  - CRUD parity with in-memory repository contract.
  - audit append/list behavior parity and ordering.
  - JSON field round-trip for note/view/checkpoint/audit metadata.
  - support for auxiliary `memory_key_index` entity type used by `memory-service`.

### Integration tests
- `tests/integration/database-core-platform.integration.test.ts`
  - app init with `databasePath` runs migrations and routes through workflow APIs.
  - restart durability for captured entries and `pending_approval` outbound entities.
  - explicit approval workflows remain enforced on DB backend.
  - checkpoint keep/recover persists and audit trail remains queryable.
  - optional one-time import from legacy snapshot path hydrates empty DB and avoids duplicate imports.

## Risks and Mitigations

1. **Risk:** Schema drift from domain models (new fields added later without migration updates).
   **Mitigation:** keep migration tests asserting required columns and add a migration-template checklist for every domain change.
2. **Risk:** Multi-entity writes are still non-transactional at service level.
   **Mitigation:** add repository-level transaction helper in follow-up ticket; for this ticket, prioritize append-only audit durability and restart correctness tests.
3. **Risk:** JSON column serialization bugs for complex fields (checkpoint snapshots, view filters, audit metadata).
   **Mitigation:** add dedicated round-trip unit tests for each complex field before integration tests.
4. **Risk:** Legacy snapshot compatibility regressions.
   **Mitigation:** keep optional one-time import path guarded by `importSnapshotIntoDatabase` and verify no duplicate imports on second startup.
5. **Risk:** New DB backend increases test flakiness due to open file handles.
   **Mitigation:** expose repository/platform `close` hook and always clean up temp directories in integration tests.

## How to Verify Against Acceptance Criteria

1. **Concrete app-level schema exists for core entities and audit storage**
   - prove with `sqlite-schema` unit tests and migration files under `src/core/database/migrations`.
2. **Migrations exist and are deterministic/idempotent**
   - prove with `sqlite-migrations` unit tests (ordered apply + rerun no-op).
3. **Storage supports local-first + approval/audit workflows**
   - prove with DB-backed integration tests covering restart durability, pending approval states, explicit approval paths, and audit trail reads.
4. **Core platform can initialize DB backend at app level**
   - prove with `buildCorePlatform({ databasePath })` integration route tests.
5. **Quality gates for changed slice pass**
   - run:
     - `bun test tests/unit/core/repositories/sqlite-migrations.test.ts`
     - `bun test tests/unit/core/repositories/sqlite-schema.test.ts`
     - `bun test tests/unit/core/repositories/sqlite-core-repository.test.ts`
     - `bun test tests/integration/database-core-platform.integration.test.ts`
     - `bun run typecheck`

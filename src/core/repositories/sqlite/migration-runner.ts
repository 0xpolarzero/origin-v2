import { Database } from "bun:sqlite";
import { Data, Effect } from "effect";

import { SqliteMigration } from "./migrations";

export class MigrationRunnerError extends Data.TaggedError(
  "MigrationRunnerError",
)<{
  message: string;
}> {}

interface LedgerRow {
  id: string;
  checksum: string;
}

const toErrorMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

const createRunnerError = (
  message: string,
  cause?: unknown,
): MigrationRunnerError =>
  new MigrationRunnerError({
    message: cause ? `${message}: ${toErrorMessage(cause)}` : message,
  });

const executeSql = (
  db: Database,
  sql: string,
  failureMessage: string,
): Effect.Effect<void, MigrationRunnerError> =>
  Effect.try({
    try: () => {
      db.exec(sql);
    },
    catch: (cause) => createRunnerError(failureMessage, cause),
  });

const readLedgerRows = (
  db: Database,
): Effect.Effect<Array<LedgerRow>, MigrationRunnerError> =>
  Effect.try({
    try: () =>
      db
        .query("SELECT id, checksum FROM schema_migrations")
        .all() as Array<LedgerRow>,
    catch: (cause) =>
      createRunnerError("failed to read migration ledger rows", cause),
  });

const sortedMigrations = (
  migrations: ReadonlyArray<SqliteMigration>,
): Effect.Effect<Array<SqliteMigration>, MigrationRunnerError> =>
  Effect.sync(() =>
    [...migrations].sort((left, right) => left.id.localeCompare(right.id)),
  ).pipe(
    Effect.flatMap((ordered) => {
      const seen = new Set<string>();
      for (const migration of ordered) {
        if (seen.has(migration.id)) {
          return Effect.fail(
            createRunnerError(
              `duplicate migration id detected: ${migration.id}`,
            ),
          );
        }
        seen.add(migration.id);
      }

      return Effect.succeed(ordered);
    }),
  );

export const ensureMigrationLedger = (
  db: Database,
): Effect.Effect<void, MigrationRunnerError> =>
  executeSql(
    db,
    `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `,
    "failed to create schema_migrations ledger",
  );

const applyMigration = (
  db: Database,
  migration: SqliteMigration,
): Effect.Effect<void, MigrationRunnerError> =>
  Effect.try({
    try: () => {
      db.exec("BEGIN");
      try {
        db.exec(migration.sql);
        db.query(
          `
            INSERT INTO schema_migrations (
              id,
              name,
              checksum,
              applied_at
            ) VALUES (?, ?, ?, ?)
          `,
        ).run(
          migration.id,
          migration.name,
          migration.checksum,
          new Date().toISOString(),
        );
        db.exec("COMMIT");
      } catch (cause) {
        db.exec("ROLLBACK");
        throw cause;
      }
    },
    catch: (cause) =>
      createRunnerError(`failed to apply migration ${migration.id}`, cause),
  });

export const applyPendingMigrations = (
  db: Database,
  migrations: ReadonlyArray<SqliteMigration>,
): Effect.Effect<void, MigrationRunnerError> =>
  Effect.gen(function* () {
    const ordered = yield* sortedMigrations(migrations);
    const existingRows = yield* readLedgerRows(db);
    const existingById = new Map(
      existingRows.map((row) => [row.id, row.checksum] as const),
    );

    for (const migration of ordered) {
      const existingChecksum = existingById.get(migration.id);
      if (existingChecksum !== undefined) {
        if (existingChecksum !== migration.checksum) {
          return yield* Effect.fail(
            createRunnerError(
              `checksum mismatch for migration ${migration.id}: expected ${existingChecksum}, received ${migration.checksum}`,
            ),
          );
        }
        continue;
      }

      yield* applyMigration(db, migration);
    }
  });

export const runSqliteMigrations = (
  db: Database,
  migrations: ReadonlyArray<SqliteMigration>,
): Effect.Effect<void, MigrationRunnerError> =>
  Effect.gen(function* () {
    yield* ensureMigrationLedger(db);
    yield* applyPendingMigrations(db, migrations);
  });

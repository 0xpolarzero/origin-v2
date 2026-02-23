import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { CORE_DB_MIGRATIONS } from "../../../../src/core/repositories/sqlite/migrations";
import { runSqliteMigrations } from "../../../../src/core/repositories/sqlite/migration-runner";

interface LedgerRow {
  id: string;
  checksum: string;
}

const listLedgerRows = (db: Database): Array<LedgerRow> =>
  db
    .query("SELECT id, checksum FROM schema_migrations ORDER BY id ASC")
    .all() as Array<LedgerRow>;

describe("sqlite migration runner", () => {
  test("CORE_DB_MIGRATIONS contains unique, ordered ids and SQL payload", () => {
    expect(CORE_DB_MIGRATIONS.length).toBeGreaterThan(0);

    const ids = CORE_DB_MIGRATIONS.map((migration) => migration.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));

    for (const migration of CORE_DB_MIGRATIONS) {
      expect(migration.id.trim().length).toBeGreaterThan(0);
      expect(migration.name.trim().length).toBeGreaterThan(0);
      expect(migration.sql.trim().length).toBeGreaterThan(0);
      expect(migration.checksum.trim().length).toBeGreaterThan(0);
    }
  });

  test("runSqliteMigrations creates schema_migrations ledger on empty database", async () => {
    const db = new Database(":memory:");

    try {
      await Effect.runPromise(runSqliteMigrations(db, []));

      const ledger = db
        .query(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
        )
        .get();

      expect(ledger).toBeDefined();
    } finally {
      db.close();
    }
  });

  test("runSqliteMigrations applies pending migrations in id order and records checksum", async () => {
    const db = new Database(":memory:");
    const testMigrations = [
      {
        id: "002_record_second",
        name: "record second step",
        sql: "INSERT INTO migration_apply_log (step) VALUES ('002');",
        checksum: "checksum-002",
      },
      {
        id: "001_create_and_record_first",
        name: "create apply log and record first step",
        sql: `
          CREATE TABLE migration_apply_log (
            step TEXT NOT NULL
          );
          INSERT INTO migration_apply_log (step) VALUES ('001');
        `,
        checksum: "checksum-001",
      },
    ];

    try {
      await Effect.runPromise(runSqliteMigrations(db, testMigrations));

      const applyOrder = db
        .query("SELECT step FROM migration_apply_log ORDER BY rowid ASC")
        .all() as Array<{ step: string }>;

      const ledgerRows = listLedgerRows(db);

      expect(applyOrder.map((row) => row.step)).toEqual(["001", "002"]);
      expect(ledgerRows).toEqual([
        { id: "001_create_and_record_first", checksum: "checksum-001" },
        { id: "002_record_second", checksum: "checksum-002" },
      ]);
    } finally {
      db.close();
    }
  });

  test("runSqliteMigrations is idempotent when run multiple times", async () => {
    const db = new Database(":memory:");
    const testMigrations = [
      {
        id: "001_idempotency_check",
        name: "create table and insert one row",
        sql: `
          CREATE TABLE idempotency_probe (
            value TEXT NOT NULL
          );
          INSERT INTO idempotency_probe (value) VALUES ('once');
        `,
        checksum: "checksum-idempotency",
      },
    ];

    try {
      await Effect.runPromise(runSqliteMigrations(db, testMigrations));
      await Effect.runPromise(runSqliteMigrations(db, testMigrations));

      const ledgerRows = listLedgerRows(db);
      const rowCount = db
        .query("SELECT COUNT(*) AS count FROM idempotency_probe")
        .get() as { count: number };

      expect(ledgerRows).toEqual([
        { id: "001_idempotency_check", checksum: "checksum-idempotency" },
      ]);
      expect(rowCount.count).toBe(1);
    } finally {
      db.close();
    }
  });
});

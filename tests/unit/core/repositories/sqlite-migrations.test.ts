import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { CORE_DB_MIGRATIONS } from "../../../../src/core/repositories/sqlite/migrations";
import { runSqliteMigrations } from "../../../../src/core/repositories/sqlite/migration-runner";

interface LedgerRow {
  id: string;
  checksum: string;
}

const EXPECTED_CORE_MIGRATION_IDS = [
  "001_core_schema",
  "002_core_constraints_indexes",
  "003_relation_integrity",
  "004_audit_entity_versions",
  "005_job_run_history",
  "006_checkpoint_audit_cursor_integer",
];

const listLedgerRows = (db: Database): Array<LedgerRow> =>
  db
    .query("SELECT id, checksum FROM schema_migrations ORDER BY id ASC")
    .all() as Array<LedgerRow>;

describe("sqlite migration runner", () => {
  test("CORE_DB_MIGRATIONS contains unique, ordered ids and SQL payload", () => {
    expect(CORE_DB_MIGRATIONS.length).toBeGreaterThan(0);

    const ids = CORE_DB_MIGRATIONS.map((migration) => migration.id);
    expect(ids).toEqual(EXPECTED_CORE_MIGRATION_IDS);
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

  test("runSqliteMigrations applies only pending core migrations when upgrading from 001/002", async () => {
    const db = new Database(":memory:");
    const baselineMigrations = CORE_DB_MIGRATIONS.filter(
      (migration) =>
        migration.id.startsWith("001_") || migration.id.startsWith("002_"),
    );

    try {
      await Effect.runPromise(runSqliteMigrations(db, baselineMigrations));
      expect(listLedgerRows(db).map((row) => row.id)).toEqual([
        "001_core_schema",
        "002_core_constraints_indexes",
      ]);

      await Effect.runPromise(runSqliteMigrations(db, CORE_DB_MIGRATIONS));

      const fullLedger = listLedgerRows(db);
      const checksumsById = new Map(
        CORE_DB_MIGRATIONS.map((migration) => [
          migration.id,
          migration.checksum,
        ]),
      );
      expect(fullLedger.map((row) => row.id)).toEqual(
        EXPECTED_CORE_MIGRATION_IDS,
      );
      for (const row of fullLedger) {
        const expectedChecksum = checksumsById.get(row.id);
        if (expectedChecksum === undefined) {
          throw new Error(`missing checksum for migration ${row.id}`);
        }
        expect(row.checksum).toBe(expectedChecksum);
      }

      await Effect.runPromise(runSqliteMigrations(db, CORE_DB_MIGRATIONS));
      expect(listLedgerRows(db)).toEqual(fullLedger);
    } finally {
      db.close();
    }
  });

  test("runSqliteMigrations remediates legacy fractional checkpoint audit_cursor rows when applying 006", async () => {
    const db = new Database(":memory:");
    const migrationsBefore006 = CORE_DB_MIGRATIONS.filter(
      (migration) => migration.id < "006_checkpoint_audit_cursor_integer",
    );

    try {
      await Effect.runPromise(runSqliteMigrations(db, migrationsBefore006));

      db.query(
        `
          INSERT INTO checkpoint (
            id,
            name,
            snapshot_entity_refs,
            snapshot_entities,
            audit_cursor,
            rollback_target,
            status,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "checkpoint-legacy-fractional",
        "Legacy checkpoint",
        "[]",
        "[]",
        12.75,
        "audit-legacy",
        "created",
        "2026-02-23T00:00:00.000Z",
        "2026-02-23T00:00:00.000Z",
      );

      await Effect.runPromise(runSqliteMigrations(db, CORE_DB_MIGRATIONS));

      const row = db
        .query(
          "SELECT audit_cursor, typeof(audit_cursor) AS storage_type FROM checkpoint WHERE id = ?",
        )
        .get("checkpoint-legacy-fractional") as
        | { audit_cursor: number; storage_type: string }
        | null;

      expect(row).not.toBeNull();
      expect(row?.storage_type).toBe("integer");
      expect(Number.isInteger(row?.audit_cursor)).toBe(true);
    } finally {
      db.close();
    }
  });

  test("runSqliteMigrations remains idempotent for the full core migration manifest", async () => {
    const db = new Database(":memory:");

    try {
      await Effect.runPromise(runSqliteMigrations(db, CORE_DB_MIGRATIONS));
      await Effect.runPromise(runSqliteMigrations(db, CORE_DB_MIGRATIONS));

      const ledgerRows = listLedgerRows(db);
      const checksumsById = new Map(
        CORE_DB_MIGRATIONS.map((migration) => [
          migration.id,
          migration.checksum,
        ]),
      );

      expect(ledgerRows.map((row) => row.id)).toEqual(
        EXPECTED_CORE_MIGRATION_IDS,
      );
      for (const row of ledgerRows) {
        const expectedChecksum = checksumsById.get(row.id);
        if (expectedChecksum === undefined) {
          throw new Error(`missing checksum for migration ${row.id}`);
        }
        expect(row.checksum).toBe(expectedChecksum);
      }
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

  test("runSqliteMigrations rolls back partial migration SQL and ledger writes when a migration fails", async () => {
    const db = new Database(":memory:");
    const failingMigrations = [
      {
        id: "001_rollback_probe",
        name: "create probe table then fail",
        sql: `
          CREATE TABLE rollback_probe (
            id TEXT NOT NULL
          );
          INSERT INTO rollback_probe (id) VALUES ('probe-1');
          INSERT INTO missing_table (id) VALUES ('boom');
        `,
        checksum: "checksum-rollback-probe",
      },
    ];

    try {
      await expect(
        Effect.runPromise(runSqliteMigrations(db, failingMigrations)),
      ).rejects.toThrow("failed to apply migration 001_rollback_probe");

      const probeTable = db
        .query(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'rollback_probe'",
        )
        .get();
      const ledgerRows = listLedgerRows(db);

      expect(probeTable).toBeNull();
      expect(ledgerRows).toEqual([]);
    } finally {
      db.close();
    }
  });

  test("runSqliteMigrations rejects when an existing migration id has a different checksum", async () => {
    const db = new Database(":memory:");
    const initialMigrations = [
      {
        id: "001_checksum_guard",
        name: "create checksum guard table",
        sql: `
          CREATE TABLE checksum_guard (
            id TEXT NOT NULL
          );
        `,
        checksum: "checksum-original",
      },
    ];
    const mismatchedMigrations = [
      {
        ...initialMigrations[0],
        checksum: "checksum-mutated",
      },
    ];

    try {
      await Effect.runPromise(runSqliteMigrations(db, initialMigrations));

      await expect(
        Effect.runPromise(runSqliteMigrations(db, mismatchedMigrations)),
      ).rejects.toThrow("checksum mismatch for migration 001_checksum_guard");
    } finally {
      db.close();
    }
  });
});

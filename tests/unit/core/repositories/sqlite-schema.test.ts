import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { CORE_DB_MIGRATIONS } from "../../../../src/core/repositories/sqlite/migrations";
import { runSqliteMigrations } from "../../../../src/core/repositories/sqlite/migration-runner";

describe("sqlite baseline schema migrations", () => {
  test("baseline migration creates required core, audit, and auxiliary tables", async () => {
    const db = new Database(":memory:");

    try {
      await Effect.runPromise(runSqliteMigrations(db, CORE_DB_MIGRATIONS));

      const tableRows = db
        .query("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all() as Array<{ name: string }>;

      const tableNames = new Set(tableRows.map((row) => row.name));
      const requiredTables = [
        "entry",
        "task",
        "event",
        "project",
        "note",
        "signal",
        "job",
        "notification",
        "view",
        "memory",
        "checkpoint",
        "outbound_draft",
        "audit_transitions",
        "memory_key_index",
      ];

      for (const requiredTable of requiredTables) {
        expect(tableNames.has(requiredTable)).toBe(true);
      }
    } finally {
      db.close();
    }
  });

  test("schema enforces lifecycle constraints and critical indexes", async () => {
    const db = new Database(":memory:");

    try {
      await Effect.runPromise(runSqliteMigrations(db, CORE_DB_MIGRATIONS));

      expect(() => {
        db.query(
          `
            INSERT INTO task (
              id,
              title,
              status,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?)
          `,
        ).run(
          "task-invalid-status",
          "Invalid task",
          "invalid_state",
          "2026-02-23T00:00:00.000Z",
          "2026-02-23T00:00:00.000Z",
        );
      }).toThrow();

      expect(() => {
        db.query(
          `
            INSERT INTO event (
              id,
              title,
              start_at,
              sync_state,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `,
        ).run(
          "event-invalid-sync",
          "Invalid sync state",
          "2026-02-23T00:00:00.000Z",
          "invalid_state",
          "2026-02-23T00:00:00.000Z",
          "2026-02-23T00:00:00.000Z",
        );
      }).toThrow();

      db.query(
        `
          INSERT INTO memory_key_index (
            id,
            key,
            memory_id,
            updated_at
          )
          VALUES (?, ?, ?, ?)
        `,
      ).run(
        "memory-key-index-1",
        "favorite_coffee",
        "memory-1",
        "2026-02-23T00:00:00.000Z",
      );

      expect(() => {
        db.query(
          `
            INSERT INTO memory_key_index (
              id,
              key,
              memory_id,
              updated_at
            )
            VALUES (?, ?, ?, ?)
          `,
        ).run(
          "memory-key-index-2",
          "favorite_coffee",
          "memory-2",
          "2026-02-23T00:00:01.000Z",
        );
      }).toThrow();

      const auditIndex = db
        .query(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_audit_transitions_entity_at'",
        )
        .get();

      expect(auditIndex).toBeDefined();

      const auditIndexColumns = db
        .query("PRAGMA index_info('idx_audit_transitions_entity_at')")
        .all() as Array<{ name: string }>;
      expect(auditIndexColumns.map((column) => column.name)).toEqual([
        "entity_type",
        "entity_id",
        "at",
      ]);
    } finally {
      db.close();
    }
  });
});

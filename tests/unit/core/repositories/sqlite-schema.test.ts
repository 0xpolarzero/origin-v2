import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { CORE_DB_MIGRATIONS } from "../../../../src/core/repositories/sqlite/migrations";
import { runSqliteMigrations } from "../../../../src/core/repositories/sqlite/migration-runner";

const ISO_1 = "2026-02-23T00:00:00.000Z";
const ISO_2 = "2026-02-23T00:00:01.000Z";
const ISO_3 = "2026-02-23T00:00:02.000Z";

const applyCoreMigrations = (db: Database): Promise<void> =>
  Effect.runPromise(runSqliteMigrations(db, CORE_DB_MIGRATIONS));

const expectAbort = (fn: () => void, messageFragment: string): void => {
  let thrown: unknown;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }

  if (!thrown) {
    throw new Error(`expected sqlite abort containing: ${messageFragment}`);
  }

  expect(thrown).toBeInstanceOf(Error);
  expect((thrown as Error).message).toContain(messageFragment);
};

const expectIndex = (
  db: Database,
  indexName: string,
  expectedColumns: Array<string>,
): void => {
  const indexRow = db
    .query("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?")
    .get(indexName);
  expect(indexRow).not.toBeNull();

  const indexColumns = db
    .query(`PRAGMA index_info('${indexName}')`)
    .all() as Array<{
    name: string;
  }>;
  expect(indexColumns.map((column) => column.name)).toEqual(expectedColumns);
};

const expectNoIndex = (db: Database, indexName: string): void => {
  const indexRow = db
    .query("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?")
    .get(indexName);
  expect(indexRow).toBeNull();
};

describe("sqlite baseline schema migrations", () => {
  test("baseline migration creates required core, audit, and auxiliary tables", async () => {
    const db = new Database(":memory:");

    try {
      await applyCoreMigrations(db);

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
        "entity_versions",
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
      await applyCoreMigrations(db);

      expectAbort(() => {
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
          ISO_1,
          ISO_1,
        );
      }, "invalid task.status");

      expectAbort(() => {
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
          ISO_1,
          "invalid_state",
          ISO_1,
          ISO_1,
        );
      }, "invalid event.sync_state");

      db.query(
        `
          INSERT INTO memory (
            id,
            key,
            value,
            source,
            confidence,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "memory-1",
        "favorite_coffee",
        "flat_white",
        "user",
        0.9,
        ISO_1,
        ISO_1,
      );

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
      ).run("memory-key-index-1", "favorite_coffee", "memory-1", ISO_1);

      expectAbort(() => {
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
        ).run("memory-key-index-2", "favorite_coffee", "memory-1", ISO_2);
      }, "UNIQUE constraint failed: memory_key_index.key");

      expectIndex(db, "idx_audit_transitions_entity_at", [
        "entity_type",
        "entity_id",
        "at",
      ]);
      expectIndex(db, "idx_audit_transitions_entity_id_at", [
        "entity_id",
        "at",
      ]);
    } finally {
      db.close();
    }
  });

  test("schema creates relation lookup indexes for linked entity fields", async () => {
    const db = new Database(":memory:");

    try {
      await applyCoreMigrations(db);

      expectIndex(db, "idx_task_project_id", ["project_id"]);
      expectIndex(db, "idx_task_source_entry_id", ["source_entry_id"]);
      expectIndex(db, "idx_entry_accepted_task_id", ["accepted_task_id"]);
      expectIndex(db, "idx_signal_converted_entity", [
        "converted_entity_type",
        "converted_entity_id",
      ]);
      expectIndex(db, "idx_notification_related_entity", [
        "related_entity_type",
        "related_entity_id",
      ]);
      expectIndex(db, "idx_outbound_draft_source_signal_id", [
        "source_signal_id",
      ]);
      expectIndex(db, "idx_memory_key_index_memory_id", ["memory_id"]);
      expectNoIndex(db, "idx_audit_transitions_entity_ref");
    } finally {
      db.close();
    }
  });

  test("task.project_id rejects non-existent project ids on insert and update", async () => {
    const db = new Database(":memory:");

    try {
      await applyCoreMigrations(db);

      expectAbort(() => {
        db.query(
          `
            INSERT INTO task (id, title, status, project_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
        ).run(
          "task-project-bad-insert",
          "Task",
          "planned",
          "project-missing",
          ISO_1,
          ISO_1,
        );
      }, "invalid task.project_id");

      db.query(
        `
          INSERT INTO task (id, title, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `,
      ).run("task-project-update", "Task", "planned", ISO_1, ISO_1);

      expectAbort(() => {
        db.query(
          "UPDATE task SET project_id = ?, updated_at = ? WHERE id = ?",
        ).run("project-missing", ISO_2, "task-project-update");
      }, "invalid task.project_id");

      db.query(
        `
          INSERT INTO project (id, name, lifecycle, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `,
      ).run("project-1", "Main", "active", ISO_1, ISO_1);

      db.query(
        "UPDATE task SET project_id = ?, updated_at = ? WHERE id = ?",
      ).run("project-1", ISO_2, "task-project-update");
    } finally {
      db.close();
    }
  });

  test("task.source_entry_id rejects non-existent entry ids on insert and update", async () => {
    const db = new Database(":memory:");

    try {
      await applyCoreMigrations(db);

      expectAbort(() => {
        db.query(
          `
            INSERT INTO task (id, title, status, source_entry_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
        ).run(
          "task-entry-bad-insert",
          "Task",
          "planned",
          "entry-missing",
          ISO_1,
          ISO_1,
        );
      }, "invalid task.source_entry_id");

      db.query(
        `
          INSERT INTO task (id, title, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `,
      ).run("task-entry-update", "Task", "planned", ISO_1, ISO_1);

      expectAbort(() => {
        db.query(
          "UPDATE task SET source_entry_id = ?, updated_at = ? WHERE id = ?",
        ).run("entry-missing", ISO_2, "task-entry-update");
      }, "invalid task.source_entry_id");

      db.query(
        `
          INSERT INTO entry (
            id,
            content,
            source,
            status,
            captured_at,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      ).run("entry-1", "Entry", "manual", "captured", ISO_1, ISO_1, ISO_1);

      db.query(
        "UPDATE task SET source_entry_id = ?, updated_at = ? WHERE id = ?",
      ).run("entry-1", ISO_2, "task-entry-update");
    } finally {
      db.close();
    }
  });

  test("entry.accepted_task_id rejects non-existent task ids on insert and update", async () => {
    const db = new Database(":memory:");

    try {
      await applyCoreMigrations(db);

      expectAbort(() => {
        db.query(
          `
            INSERT INTO entry (
              id,
              content,
              source,
              status,
              captured_at,
              created_at,
              updated_at,
              accepted_task_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
        ).run(
          "entry-bad-task-insert",
          "Entry",
          "manual",
          "accepted_as_task",
          ISO_1,
          ISO_1,
          ISO_1,
          "task-missing",
        );
      }, "invalid entry.accepted_task_id");

      db.query(
        `
          INSERT INTO entry (
            id,
            content,
            source,
            status,
            captured_at,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "entry-task-update",
        "Entry",
        "manual",
        "captured",
        ISO_1,
        ISO_1,
        ISO_1,
      );

      expectAbort(() => {
        db.query(
          "UPDATE entry SET accepted_task_id = ?, status = ?, updated_at = ? WHERE id = ?",
        ).run("task-missing", "accepted_as_task", ISO_2, "entry-task-update");
      }, "invalid entry.accepted_task_id");

      db.query(
        `
          INSERT INTO task (id, title, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `,
      ).run("task-accepted-1", "Task", "planned", ISO_1, ISO_1);

      db.query(
        "UPDATE entry SET accepted_task_id = ?, status = ?, updated_at = ? WHERE id = ?",
      ).run("task-accepted-1", "accepted_as_task", ISO_2, "entry-task-update");
    } finally {
      db.close();
    }
  });

  test("outbound_draft.source_signal_id rejects missing signal rows", async () => {
    const db = new Database(":memory:");

    try {
      await applyCoreMigrations(db);

      expectAbort(() => {
        db.query(
          `
            INSERT INTO outbound_draft (
              id,
              payload,
              source_signal_id,
              status,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `,
        ).run(
          "draft-bad-signal",
          "Send update",
          "signal-missing",
          "draft",
          ISO_1,
          ISO_1,
        );
      }, "invalid outbound_draft.source_signal_id");

      db.query(
        `
          INSERT INTO signal (
            id,
            source,
            payload,
            triage_state,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
      ).run("signal-1", "email", "Payload", "untriaged", ISO_1, ISO_1);

      db.query(
        `
          INSERT INTO outbound_draft (
            id,
            payload,
            source_signal_id,
            status,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "draft-good-signal",
        "Send update",
        "signal-1",
        "draft",
        ISO_1,
        ISO_1,
      );
    } finally {
      db.close();
    }
  });

  test("memory_key_index.memory_id rejects missing memory rows", async () => {
    const db = new Database(":memory:");

    try {
      await applyCoreMigrations(db);

      expectAbort(() => {
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
          "memory-index-missing",
          "favorite_color",
          "memory-missing",
          ISO_1,
        );
      }, "invalid memory_key_index.memory_id");

      db.query(
        `
          INSERT INTO memory (
            id,
            key,
            value,
            source,
            confidence,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      ).run("memory-2", "favorite_color", "blue", "user", 0.8, ISO_1, ISO_1);

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
      ).run("memory-index-good", "favorite_color", "memory-2", ISO_1);
    } finally {
      db.close();
    }
  });

  test("linked references reject parent deletes that would orphan child rows", async () => {
    const db = new Database(":memory:");

    try {
      await applyCoreMigrations(db);

      db.query(
        `
          INSERT INTO project (id, name, lifecycle, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `,
      ).run("project-delete-task-ref", "Project", "active", ISO_1, ISO_1);
      db.query(
        `
          INSERT INTO task (
            id,
            title,
            status,
            project_id,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "task-delete-project-ref",
        "Task",
        "planned",
        "project-delete-task-ref",
        ISO_1,
        ISO_1,
      );
      expectAbort(() => {
        db.query("DELETE FROM project WHERE id = ?").run(
          "project-delete-task-ref",
        );
      }, "project.id referenced by task.project_id");

      db.query(
        `
          INSERT INTO task (id, title, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `,
      ).run("task-delete-entry-ref", "Task", "planned", ISO_1, ISO_1);
      db.query(
        `
          INSERT INTO entry (
            id,
            content,
            source,
            status,
            captured_at,
            created_at,
            updated_at,
            accepted_task_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "entry-delete-task-ref",
        "Entry",
        "manual",
        "accepted_as_task",
        ISO_1,
        ISO_1,
        ISO_1,
        "task-delete-entry-ref",
      );
      expectAbort(() => {
        db.query("DELETE FROM task WHERE id = ?").run("task-delete-entry-ref");
      }, "task.id referenced by entry.accepted_task_id");

      db.query(
        `
          INSERT INTO signal (
            id,
            source,
            payload,
            triage_state,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "signal-delete-outbound-ref",
        "email",
        "Payload",
        "untriaged",
        ISO_1,
        ISO_1,
      );
      db.query(
        `
          INSERT INTO outbound_draft (
            id,
            payload,
            source_signal_id,
            status,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "outbound-delete-signal-ref",
        "Draft payload",
        "signal-delete-outbound-ref",
        "draft",
        ISO_1,
        ISO_1,
      );
      expectAbort(() => {
        db.query("DELETE FROM signal WHERE id = ?").run(
          "signal-delete-outbound-ref",
        );
      }, "signal.id referenced by outbound_draft.source_signal_id");

      db.query(
        `
          INSERT INTO project (id, name, lifecycle, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `,
      ).run("project-delete-signal-ref", "Project", "active", ISO_1, ISO_1);
      db.query(
        `
          INSERT INTO signal (
            id,
            source,
            payload,
            triage_state,
            converted_entity_type,
            converted_entity_id,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "signal-delete-converted-ref",
        "email",
        "Payload",
        "converted",
        "project",
        "project-delete-signal-ref",
        ISO_1,
        ISO_1,
      );
      expectAbort(() => {
        db.query("DELETE FROM project WHERE id = ?").run(
          "project-delete-signal-ref",
        );
      }, "project.id referenced by signal.converted_entity");

      db.query(
        `
          INSERT INTO task (id, title, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `,
      ).run("task-delete-notification-ref", "Task", "planned", ISO_1, ISO_1);
      db.query(
        `
          INSERT INTO notification (
            id,
            type,
            message,
            status,
            related_entity_type,
            related_entity_id,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "notification-delete-task-ref",
        "approval_required",
        "Needs approval",
        "pending",
        "task",
        "task-delete-notification-ref",
        ISO_1,
        ISO_1,
      );
      expectAbort(() => {
        db.query("DELETE FROM task WHERE id = ?").run(
          "task-delete-notification-ref",
        );
      }, "task.id referenced by notification.related_entity");

      db.query(
        `
          INSERT INTO memory (
            id,
            key,
            value,
            source,
            confidence,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "memory-delete-index-ref",
        "favorite_food",
        "ramen",
        "user",
        0.8,
        ISO_1,
        ISO_1,
      );
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
        "memory-index-delete-ref",
        "favorite_food",
        "memory-delete-index-ref",
        ISO_1,
      );
      expectAbort(() => {
        db.query("DELETE FROM memory WHERE id = ?").run(
          "memory-delete-index-ref",
        );
      }, "memory.id referenced by memory_key_index.memory_id");
    } finally {
      db.close();
    }
  });

  test("signal.converted_entity_type/id enforces pair completeness and supported types", async () => {
    const db = new Database(":memory:");

    try {
      await applyCoreMigrations(db);

      expectAbort(() => {
        db.query(
          `
            INSERT INTO signal (
              id,
              source,
              payload,
              triage_state,
              converted_entity_type,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
        ).run(
          "signal-pair-missing-id",
          "email",
          "Payload",
          "converted",
          "task",
          ISO_1,
          ISO_1,
        );
      }, "invalid signal.converted_entity_ref");

      expectAbort(() => {
        db.query(
          `
            INSERT INTO signal (
              id,
              source,
              payload,
              triage_state,
              converted_entity_id,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
        ).run(
          "signal-pair-missing-type",
          "email",
          "Payload",
          "converted",
          "task-1",
          ISO_1,
          ISO_1,
        );
      }, "invalid signal.converted_entity_ref");

      expectAbort(() => {
        db.query(
          `
            INSERT INTO signal (
              id,
              source,
              payload,
              triage_state,
              converted_entity_type,
              converted_entity_id,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
        ).run(
          "signal-bad-type",
          "email",
          "Payload",
          "converted",
          "unknown",
          "target-1",
          ISO_1,
          ISO_1,
        );
      }, "invalid signal.converted_entity_type");

      db.query(
        `
          INSERT INTO signal (
            id,
            source,
            payload,
            triage_state,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
      ).run("signal-unlinked", "email", "Payload", "untriaged", ISO_1, ISO_1);
    } finally {
      db.close();
    }
  });

  test("signal.converted_entity_type/id rejects unknown target ids per supported target type", async () => {
    const db = new Database(":memory:");

    try {
      await applyCoreMigrations(db);

      const supportedTypes = [
        "task",
        "event",
        "note",
        "project",
        "outbound_draft",
      ];

      for (const entityType of supportedTypes) {
        expectAbort(() => {
          db.query(
            `
              INSERT INTO signal (
                id,
                source,
                payload,
                triage_state,
                converted_entity_type,
                converted_entity_id,
                created_at,
                updated_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
          ).run(
            `signal-missing-target-${entityType}`,
            "email",
            "Payload",
            "converted",
            entityType,
            `${entityType}-missing-id`,
            ISO_1,
            ISO_1,
          );
        }, "invalid signal.converted_entity_target");
      }
    } finally {
      db.close();
    }
  });

  test("notification.related_entity_type/id enforces pair completeness, type support, and target existence", async () => {
    const db = new Database(":memory:");

    try {
      await applyCoreMigrations(db);

      expectAbort(() => {
        db.query(
          `
            INSERT INTO notification (
              id,
              type,
              message,
              status,
              related_entity_type,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
        ).run(
          "notification-missing-id",
          "approval_required",
          "Needs approval",
          "pending",
          "task",
          ISO_1,
          ISO_1,
        );
      }, "invalid notification.related_entity_ref");

      expectAbort(() => {
        db.query(
          `
            INSERT INTO notification (
              id,
              type,
              message,
              status,
              related_entity_id,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
        ).run(
          "notification-missing-type",
          "approval_required",
          "Needs approval",
          "pending",
          "task-1",
          ISO_1,
          ISO_1,
        );
      }, "invalid notification.related_entity_ref");

      expectAbort(() => {
        db.query(
          `
            INSERT INTO notification (
              id,
              type,
              message,
              status,
              related_entity_type,
              related_entity_id,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
        ).run(
          "notification-bad-type",
          "approval_required",
          "Needs approval",
          "pending",
          "unsupported",
          "x",
          ISO_1,
          ISO_1,
        );
      }, "invalid notification.related_entity_type");

      expectAbort(() => {
        db.query(
          `
            INSERT INTO notification (
              id,
              type,
              message,
              status,
              related_entity_type,
              related_entity_id,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
        ).run(
          "notification-missing-target",
          "approval_required",
          "Needs approval",
          "pending",
          "task",
          "task-missing",
          ISO_1,
          ISO_1,
        );
      }, "invalid notification.related_entity_target");

      db.query(
        `
          INSERT INTO task (id, title, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `,
      ).run("task-notification-1", "Task", "planned", ISO_1, ISO_1);

      db.query(
        `
          INSERT INTO notification (
            id,
            type,
            message,
            status,
            related_entity_type,
            related_entity_id,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "notification-good",
        "approval_required",
        "Needs approval",
        "pending",
        "task",
        "task-notification-1",
        ISO_1,
        ISO_1,
      );
    } finally {
      db.close();
    }
  });

  test("audit_transitions.entity_type/id enforces supported types and existing targets", async () => {
    const db = new Database(":memory:");

    try {
      await applyCoreMigrations(db);

      expectAbort(() => {
        db.query(
          `
            INSERT INTO audit_transitions (
              id,
              entity_type,
              entity_id,
              from_state,
              to_state,
              actor_id,
              actor_kind,
              reason,
              at,
              metadata
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        ).run(
          "audit-unknown-type",
          "unknown",
          "entity-1",
          "none",
          "created",
          "user-1",
          "user",
          "Test",
          ISO_1,
          null,
        );
      }, "invalid audit_transitions.entity_type");

      expectAbort(() => {
        db.query(
          `
            INSERT INTO audit_transitions (
              id,
              entity_type,
              entity_id,
              from_state,
              to_state,
              actor_id,
              actor_kind,
              reason,
              at,
              metadata
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        ).run(
          "audit-missing-target",
          "task",
          "task-missing",
          "none",
          "planned",
          "user-1",
          "user",
          "Test",
          ISO_1,
          null,
        );
      }, "invalid audit_transitions.entity_ref");

      db.query(
        `
          INSERT INTO task (id, title, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `,
      ).run("task-audit-1", "Task", "planned", ISO_1, ISO_1);

      db.query(
        `
          INSERT INTO audit_transitions (
            id,
            entity_type,
            entity_id,
            from_state,
            to_state,
            actor_id,
            actor_kind,
            reason,
            at,
            metadata
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "audit-valid-target",
        "task",
        "task-audit-1",
        "none",
        "planned",
        "user-1",
        "user",
        "Task created",
        ISO_1,
        null,
      );
    } finally {
      db.close();
    }
  });

  test("schema includes entity_versions table with composite PK and lookup index", async () => {
    const db = new Database(":memory:");

    try {
      await applyCoreMigrations(db);

      const columns = db
        .query("PRAGMA table_info('entity_versions')")
        .all() as Array<{
        name: string;
        pk: number;
      }>;

      expect(columns.map((column) => column.name)).toEqual([
        "entity_type",
        "entity_id",
        "latest_version",
        "updated_at",
      ]);

      const pkByColumn = new Map(
        columns.map((column) => [column.name, column.pk] as const),
      );
      expect(pkByColumn.get("entity_type")).toBe(1);
      expect(pkByColumn.get("entity_id")).toBe(2);

      expectIndex(db, "idx_entity_versions_updated_at", ["updated_at"]);
    } finally {
      db.close();
    }
  });

  test("migration backfills entity_versions from existing audit_transitions", async () => {
    const db = new Database(":memory:");
    const baselineMigrations = CORE_DB_MIGRATIONS.filter(
      (migration) =>
        migration.id.startsWith("001_") || migration.id.startsWith("002_"),
    );

    try {
      await Effect.runPromise(runSqliteMigrations(db, baselineMigrations));

      db.query(
        `
          INSERT INTO task (id, title, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `,
      ).run("task-backfill-1", "Task", "planned", ISO_1, ISO_1);
      db.query(
        `
          INSERT INTO signal (
            id,
            source,
            payload,
            triage_state,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
      ).run("signal-backfill-1", "email", "Payload", "untriaged", ISO_1, ISO_1);

      db.query(
        `
          INSERT INTO audit_transitions (
            id,
            entity_type,
            entity_id,
            from_state,
            to_state,
            actor_id,
            actor_kind,
            reason,
            at,
            metadata
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "audit-backfill-1",
        "task",
        "task-backfill-1",
        "none",
        "planned",
        "user-1",
        "user",
        "Task created",
        ISO_1,
        null,
      );
      db.query(
        `
          INSERT INTO audit_transitions (
            id,
            entity_type,
            entity_id,
            from_state,
            to_state,
            actor_id,
            actor_kind,
            reason,
            at,
            metadata
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "audit-backfill-2",
        "task",
        "task-backfill-1",
        "planned",
        "completed",
        "user-1",
        "user",
        "Task completed",
        ISO_2,
        null,
      );
      db.query(
        `
          INSERT INTO audit_transitions (
            id,
            entity_type,
            entity_id,
            from_state,
            to_state,
            actor_id,
            actor_kind,
            reason,
            at,
            metadata
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "audit-backfill-3",
        "signal",
        "signal-backfill-1",
        "none",
        "untriaged",
        "user-1",
        "user",
        "Signal ingested",
        ISO_1,
        null,
      );

      await applyCoreMigrations(db);

      const versionRows = db
        .query(
          `
            SELECT
              entity_type AS entityType,
              entity_id AS entityId,
              latest_version AS latestVersion,
              updated_at AS updatedAt
            FROM entity_versions
            ORDER BY entity_type ASC, entity_id ASC
          `,
        )
        .all() as Array<{
        entityType: string;
        entityId: string;
        latestVersion: number;
        updatedAt: string;
      }>;

      expect(versionRows).toEqual([
        {
          entityType: "signal",
          entityId: "signal-backfill-1",
          latestVersion: 1,
          updatedAt: ISO_1,
        },
        {
          entityType: "task",
          entityId: "task-backfill-1",
          latestVersion: 2,
          updatedAt: ISO_2,
        },
      ]);
    } finally {
      db.close();
    }
  });

  test("new audit transitions increment entity_versions.latest_version monotonically", async () => {
    const db = new Database(":memory:");

    try {
      await applyCoreMigrations(db);

      db.query(
        `
          INSERT INTO task (id, title, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `,
      ).run("task-version-1", "Task", "planned", ISO_1, ISO_1);

      db.query(
        `
          INSERT INTO audit_transitions (
            id,
            entity_type,
            entity_id,
            from_state,
            to_state,
            actor_id,
            actor_kind,
            reason,
            at,
            metadata
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "audit-version-1",
        "task",
        "task-version-1",
        "none",
        "planned",
        "user-1",
        "user",
        "Task created",
        ISO_1,
        null,
      );

      db.query(
        `
          INSERT INTO audit_transitions (
            id,
            entity_type,
            entity_id,
            from_state,
            to_state,
            actor_id,
            actor_kind,
            reason,
            at,
            metadata
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "audit-version-2",
        "task",
        "task-version-1",
        "planned",
        "deferred",
        "user-1",
        "user",
        "Task deferred",
        ISO_2,
        null,
      );

      let versionRow = db
        .query(
          `
            SELECT
              latest_version AS latestVersion,
              updated_at AS updatedAt
            FROM entity_versions
            WHERE entity_type = 'task' AND entity_id = 'task-version-1'
          `,
        )
        .get() as {
        latestVersion: number;
        updatedAt: string;
      };

      expect(versionRow).toEqual({
        latestVersion: 2,
        updatedAt: ISO_2,
      });

      db.query(
        `
          INSERT INTO audit_transitions (
            id,
            entity_type,
            entity_id,
            from_state,
            to_state,
            actor_id,
            actor_kind,
            reason,
            at,
            metadata
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "audit-version-3",
        "task",
        "task-version-1",
        "deferred",
        "completed",
        "user-1",
        "user",
        "Task completed",
        ISO_3,
        null,
      );

      versionRow = db
        .query(
          `
            SELECT
              latest_version AS latestVersion,
              updated_at AS updatedAt
            FROM entity_versions
            WHERE entity_type = 'task' AND entity_id = 'task-version-1'
          `,
        )
        .get() as {
        latestVersion: number;
        updatedAt: string;
      };

      expect(versionRow).toEqual({
        latestVersion: 3,
        updatedAt: ISO_3,
      });
    } finally {
      db.close();
    }
  });

  test("entity_versions.updated_at keeps max transition timestamp for out-of-order inserts", async () => {
    const db = new Database(":memory:");

    try {
      await applyCoreMigrations(db);

      db.query(
        `
          INSERT INTO task (id, title, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `,
      ).run("task-version-out-of-order", "Task", "planned", ISO_1, ISO_1);

      db.query(
        `
          INSERT INTO audit_transitions (
            id,
            entity_type,
            entity_id,
            from_state,
            to_state,
            actor_id,
            actor_kind,
            reason,
            at,
            metadata
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "audit-version-out-of-order-1",
        "task",
        "task-version-out-of-order",
        "none",
        "planned",
        "user-1",
        "user",
        "Task created",
        ISO_2,
        null,
      );

      db.query(
        `
          INSERT INTO audit_transitions (
            id,
            entity_type,
            entity_id,
            from_state,
            to_state,
            actor_id,
            actor_kind,
            reason,
            at,
            metadata
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "audit-version-out-of-order-2",
        "task",
        "task-version-out-of-order",
        "planned",
        "deferred",
        "user-1",
        "user",
        "Task deferred",
        ISO_3,
        null,
      );

      db.query(
        `
          INSERT INTO audit_transitions (
            id,
            entity_type,
            entity_id,
            from_state,
            to_state,
            actor_id,
            actor_kind,
            reason,
            at,
            metadata
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "audit-version-out-of-order-3",
        "task",
        "task-version-out-of-order",
        "deferred",
        "completed",
        "user-1",
        "user",
        "Task replayed",
        ISO_1,
        null,
      );

      const versionRow = db
        .query(
          `
            SELECT
              latest_version AS latestVersion,
              updated_at AS updatedAt
            FROM entity_versions
            WHERE entity_type = 'task' AND entity_id = 'task-version-out-of-order'
          `,
        )
        .get() as {
        latestVersion: number;
        updatedAt: string;
      };

      expect(versionRow).toEqual({
        latestVersion: 3,
        updatedAt: ISO_3,
      });
    } finally {
      db.close();
    }
  });

  test("schema includes job_run_history table and lookup indexes", async () => {
    const db = new Database(":memory:");

    try {
      await applyCoreMigrations(db);

      const columns = db
        .query("PRAGMA table_info('job_run_history')")
        .all() as Array<{ name: string }>;
      expect(columns.map((column) => column.name)).toEqual([
        "id",
        "job_id",
        "outcome",
        "diagnostics",
        "retry_count",
        "actor_id",
        "actor_kind",
        "at",
        "created_at",
      ]);

      expectIndex(db, "idx_job_run_history_job_id_at", ["job_id", "at"]);
      expectIndex(db, "idx_job_run_history_created_at", ["created_at"]);
    } finally {
      db.close();
    }
  });

  test("job_run_history enforces valid job references and outcomes", async () => {
    const db = new Database(":memory:");

    try {
      await applyCoreMigrations(db);

      expectAbort(() => {
        db.query(
          `
            INSERT INTO job_run_history (
              id,
              job_id,
              outcome,
              diagnostics,
              retry_count,
              actor_id,
              actor_kind,
              at,
              created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        ).run(
          "job-run-history-missing-job",
          "job-missing",
          "failed",
          "timeout",
          0,
          "system-1",
          "system",
          ISO_1,
          ISO_1,
        );
      }, "invalid job_run_history.job_id");

      db.query(
        `
          INSERT INTO job (
            id,
            name,
            run_state,
            retry_count,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
      ).run("job-history-1", "Job history", "idle", 0, ISO_1, ISO_1);

      expectAbort(() => {
        db.query(
          `
            INSERT INTO job_run_history (
              id,
              job_id,
              outcome,
              diagnostics,
              retry_count,
              actor_id,
              actor_kind,
              at,
              created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        ).run(
          "job-run-history-invalid-outcome",
          "job-history-1",
          "unknown",
          "timeout",
          0,
          "system-1",
          "system",
          ISO_2,
          ISO_2,
        );
      }, "invalid job_run_history.outcome");

      db.query(
        `
          INSERT INTO job_run_history (
            id,
            job_id,
            outcome,
            diagnostics,
            retry_count,
            actor_id,
            actor_kind,
            at,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "job-run-history-valid",
        "job-history-1",
        "failed",
        "timeout",
        0,
        "system-1",
        "system",
        ISO_2,
        ISO_2,
      );
    } finally {
      db.close();
    }
  });

  test("migration backfills job_run_history rows from historical audit_transitions", async () => {
    const db = new Database(":memory:");
    const baselineMigrations = CORE_DB_MIGRATIONS.filter(
      (migration) => migration.id !== "005_job_run_history",
    );
    const historyMigration = CORE_DB_MIGRATIONS.filter(
      (migration) => migration.id === "005_job_run_history",
    );

    try {
      await Effect.runPromise(runSqliteMigrations(db, baselineMigrations));

      db.query(
        `
          INSERT INTO job (
            id,
            name,
            run_state,
            retry_count,
            last_run_at,
            last_failure_at,
            diagnostics,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "job-backfill-1",
        "Backfill job",
        "failed",
        1,
        ISO_3,
        ISO_3,
        "latest failure",
        ISO_1,
        ISO_3,
      );

      db.query(
        `
          INSERT INTO audit_transitions (
            id,
            entity_type,
            entity_id,
            from_state,
            to_state,
            actor_id,
            actor_kind,
            reason,
            at,
            metadata
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "audit-job-run-1",
        "job",
        "job-backfill-1",
        "idle",
        "failed",
        "system-1",
        "system",
        "Job run recorded (failed)",
        ISO_1,
        JSON.stringify({ diagnostics: "first failure" }),
      );

      db.query(
        `
          INSERT INTO audit_transitions (
            id,
            entity_type,
            entity_id,
            from_state,
            to_state,
            actor_id,
            actor_kind,
            reason,
            at,
            metadata
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "audit-job-retry-1",
        "job",
        "job-backfill-1",
        "failed",
        "retrying",
        "user-1",
        "user",
        "Job retry requested",
        ISO_2,
        JSON.stringify({ previousFailure: "first failure" }),
      );

      db.query(
        `
          INSERT INTO audit_transitions (
            id,
            entity_type,
            entity_id,
            from_state,
            to_state,
            actor_id,
            actor_kind,
            reason,
            at,
            metadata
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        "audit-job-run-2",
        "job",
        "job-backfill-1",
        "retrying",
        "succeeded",
        "system-1",
        "system",
        "Job run recorded (succeeded)",
        ISO_3,
        JSON.stringify({ diagnostics: "recovered" }),
      );

      await Effect.runPromise(runSqliteMigrations(db, historyMigration));

      const rows = db
        .query(
          `
            SELECT
              job_id AS jobId,
              outcome,
              diagnostics,
              retry_count AS retryCount,
              actor_id AS actorId,
              actor_kind AS actorKind,
              at
            FROM job_run_history
            WHERE job_id = ?
            ORDER BY at ASC
          `,
        )
        .all("job-backfill-1") as Array<{
        jobId: string;
        outcome: string;
        diagnostics: string;
        retryCount: number;
        actorId: string;
        actorKind: string;
        at: string;
      }>;

      expect(rows.map((row) => row.outcome)).toEqual(["failed", "succeeded"]);
      expect(rows.map((row) => row.diagnostics)).toEqual([
        "first failure",
        "recovered",
      ]);
      expect(rows.map((row) => row.actorId)).toEqual(["system-1", "system-1"]);
      expect(rows.map((row) => row.actorKind)).toEqual(["system", "system"]);
      expect(rows.map((row) => row.at)).toEqual([ISO_1, ISO_3]);
      expect(rows[1]!.retryCount).toBeGreaterThanOrEqual(rows[0]!.retryCount);
    } finally {
      db.close();
    }
  });
});

import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Either, Effect } from "effect";

import { createAuditTransition } from "../../../../src/core/domain/audit-transition";
import { createEntry } from "../../../../src/core/domain/entry";
import { createTask } from "../../../../src/core/domain/task";
import { makeSqliteCoreRepository } from "../../../../src/core/repositories/sqlite/sqlite-core-repository";

const makeTempDatabasePath = (): { tempDir: string; databasePath: string } => {
  const tempDir = mkdtempSync(join(tmpdir(), "origin-sqlite-core-repo-"));
  return {
    tempDir,
    databasePath: join(tempDir, "core.sqlite"),
  };
};

describe("makeSqliteCoreRepository", () => {
  test("closes the opened database handle when initialization fails during migrations", async () => {
    let closed = false;
    const fakeDb = {
      exec: () => {
        throw new Error("boom during migration");
      },
      close: () => {
        closed = true;
      },
      query: () => {
        throw new Error("query should not be called in this test");
      },
    } as unknown as Database;

    await expect(
      Effect.runPromise(
        makeSqliteCoreRepository({
          databasePath: ":memory:",
          openDatabase: () => fakeDb,
        }),
      ),
    ).rejects.toThrow("failed to run sqlite migrations");

    expect(closed).toBe(true);
  });

  test("saveEntity persists row to mapped table for a core entity", async () => {
    const { tempDir, databasePath } = makeTempDatabasePath();

    try {
      const repository = await Effect.runPromise(
        makeSqliteCoreRepository({ databasePath }),
      );
      const entry = await Effect.runPromise(
        createEntry({
          id: "entry-sqlite-1",
          content: "Persist to sqlite table",
        }),
      );

      await Effect.runPromise(repository.saveEntity("entry", entry.id, entry));

      const db = new Database(databasePath, { readonly: true });
      const persistedRow = db
        .query("SELECT id, content, status FROM entry WHERE id = ?")
        .get(entry.id) as {
        id: string;
        content: string;
        status: string;
      } | null;
      db.close();

      expect(persistedRow).toEqual({
        id: "entry-sqlite-1",
        content: "Persist to sqlite table",
        status: "captured",
      });

      await Effect.runPromise(repository.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("saveEntity persists and listEntities returns job_run_history rows", async () => {
    const { tempDir, databasePath } = makeTempDatabasePath();

    try {
      const repository = await Effect.runPromise(
        makeSqliteCoreRepository({ databasePath }),
      );

      await Effect.runPromise(
        repository.saveEntity("job", "job-history-sqlite-1", {
          id: "job-history-sqlite-1",
          name: "History job",
          runState: "idle",
          retryCount: 0,
          createdAt: "2026-02-23T00:00:00.000Z",
          updatedAt: "2026-02-23T00:00:00.000Z",
        }),
      );
      await Effect.runPromise(
        repository.saveEntity("job_run_history", "job-run-history-sqlite-1", {
          id: "job-run-history-sqlite-1",
          jobId: "job-history-sqlite-1",
          outcome: "failed",
          diagnostics: "timeout",
          retryCount: 0,
          actorId: "system-1",
          actorKind: "system",
          at: "2026-02-23T00:01:00.000Z",
          createdAt: "2026-02-23T00:01:00.000Z",
        }),
      );

      const fetched = await Effect.runPromise(
        repository.getEntity<{
          id: string;
          jobId: string;
          outcome: string;
          diagnostics: string;
          retryCount: number;
          actorId: string;
          actorKind: string;
          at: string;
          createdAt: string;
        }>("job_run_history", "job-run-history-sqlite-1"),
      );
      const listed = await Effect.runPromise(
        repository.listEntities<{ id: string; jobId: string }>(
          "job_run_history",
        ),
      );

      expect(fetched).toEqual({
        id: "job-run-history-sqlite-1",
        jobId: "job-history-sqlite-1",
        outcome: "failed",
        diagnostics: "timeout",
        retryCount: 0,
        actorId: "system-1",
        actorKind: "system",
        at: "2026-02-23T00:01:00.000Z",
        createdAt: "2026-02-23T00:01:00.000Z",
      });
      expect(listed.map((row) => row.id)).toEqual(["job-run-history-sqlite-1"]);
      expect(listed[0]?.jobId).toBe("job-history-sqlite-1");

      await Effect.runPromise(repository.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("listJobRunHistory queries job-scoped rows with SQL filtering and ordering", async () => {
    const { tempDir, databasePath } = makeTempDatabasePath();

    try {
      const repository = await Effect.runPromise(
        makeSqliteCoreRepository({ databasePath }),
      );

      await Effect.runPromise(
        repository.saveEntity("job", "job-history-query-1", {
          id: "job-history-query-1",
          name: "History query one",
          runState: "idle",
          retryCount: 0,
          createdAt: "2026-02-23T00:00:00.000Z",
          updatedAt: "2026-02-23T00:00:00.000Z",
        }),
      );
      await Effect.runPromise(
        repository.saveEntity("job", "job-history-query-2", {
          id: "job-history-query-2",
          name: "History query two",
          runState: "idle",
          retryCount: 0,
          createdAt: "2026-02-23T00:00:00.000Z",
          updatedAt: "2026-02-23T00:00:00.000Z",
        }),
      );

      const rows = [
        {
          id: "job-run-history-query-1a",
          jobId: "job-history-query-1",
          outcome: "failed",
          diagnostics: "oldest",
          retryCount: 0,
          actorId: "system-1",
          actorKind: "system",
          at: "2026-02-23T10:00:00.000Z",
          createdAt: "2026-02-23T10:00:00.000Z",
        },
        {
          id: "job-run-history-query-1b",
          jobId: "job-history-query-1",
          outcome: "failed",
          diagnostics: "tie b",
          retryCount: 1,
          actorId: "system-1",
          actorKind: "system",
          at: "2026-02-23T11:00:00.000Z",
          createdAt: "2026-02-23T11:00:00.000Z",
        },
        {
          id: "job-run-history-query-1c",
          jobId: "job-history-query-1",
          outcome: "succeeded",
          diagnostics: "tie c",
          retryCount: 1,
          actorId: "system-1",
          actorKind: "system",
          at: "2026-02-23T11:00:00.000Z",
          createdAt: "2026-02-23T11:00:00.000Z",
        },
        {
          id: "job-run-history-query-2a",
          jobId: "job-history-query-2",
          outcome: "failed",
          diagnostics: "other job",
          retryCount: 0,
          actorId: "system-1",
          actorKind: "system",
          at: "2026-02-23T11:05:00.000Z",
          createdAt: "2026-02-23T11:05:00.000Z",
        },
      ] as const;

      for (const row of rows) {
        await Effect.runPromise(repository.saveEntity("job_run_history", row.id, row));
      }

      const listJobRunHistory = (
        repository as {
          listJobRunHistory?: (input: {
            jobId: string;
            limit?: number;
            beforeAt?: Date;
          }) => Effect.Effect<
            ReadonlyArray<{ id: string; jobId: string; at: string; createdAt: string }>
          >;
        }
      ).listJobRunHistory;

      expect(listJobRunHistory).toBeDefined();

      const queried = await Effect.runPromise(
        listJobRunHistory!({
          jobId: "job-history-query-1",
          beforeAt: new Date("2026-02-23T11:30:00.000Z"),
          limit: 2,
        }),
      );

      expect(queried.map((entry) => entry.id)).toEqual([
        "job-run-history-query-1c",
        "job-run-history-query-1b",
      ]);
      expect(queried.every((entry) => entry.jobId === "job-history-query-1")).toBe(
        true,
      );

      await Effect.runPromise(repository.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("listJobs queries filtered rows with SQL ordering and limit", async () => {
    const { tempDir, databasePath } = makeTempDatabasePath();

    try {
      const repository = await Effect.runPromise(
        makeSqliteCoreRepository({ databasePath }),
      );

      await Effect.runPromise(
        repository.saveEntity("job", "job-list-query-1", {
          id: "job-list-query-1",
          name: "Job list one",
          runState: "failed",
          retryCount: 1,
          createdAt: "2026-02-23T09:00:00.000Z",
          updatedAt: "2026-02-23T11:00:00.000Z",
        }),
      );
      await Effect.runPromise(
        repository.saveEntity("job", "job-list-query-2", {
          id: "job-list-query-2",
          name: "Job list two",
          runState: "failed",
          retryCount: 0,
          createdAt: "2026-02-23T09:00:00.000Z",
          updatedAt: "2026-02-23T10:00:00.000Z",
        }),
      );
      await Effect.runPromise(
        repository.saveEntity("job", "job-list-query-3", {
          id: "job-list-query-3",
          name: "Job list three",
          runState: "succeeded",
          retryCount: 0,
          createdAt: "2026-02-23T09:00:00.000Z",
          updatedAt: "2026-02-23T12:00:00.000Z",
        }),
      );

      const listJobs = (
        repository as {
          listJobs?: (query: {
            runState?: "idle" | "running" | "succeeded" | "failed" | "retrying";
            limit?: number;
            beforeUpdatedAt?: Date;
          }) => Effect.Effect<
            ReadonlyArray<{ id: string; runState: string; updatedAt: string }>
          >;
        }
      ).listJobs;

      expect(listJobs).toBeDefined();

      const queried = await Effect.runPromise(
        listJobs!({
          runState: "failed",
          beforeUpdatedAt: new Date("2026-02-23T11:30:00.000Z"),
          limit: 1,
        }),
      );

      expect(queried).toEqual([
        {
          id: "job-list-query-1",
          name: "Job list one",
          runState: "failed",
          retryCount: 1,
          createdAt: "2026-02-23T09:00:00.000Z",
          updatedAt: "2026-02-23T11:00:00.000Z",
          lastRunAt: undefined,
          lastSuccessAt: undefined,
          lastFailureAt: undefined,
          lastFailureReason: undefined,
          diagnostics: undefined,
        },
      ]);

      await Effect.runPromise(repository.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("saveEntity returns deterministic relation-constraint errors", async () => {
    const { tempDir, databasePath } = makeTempDatabasePath();

    try {
      const repository = await Effect.runPromise(
        makeSqliteCoreRepository({ databasePath }),
      );
      const task = await Effect.runPromise(
        createTask({
          id: "task-invalid-project-ref",
          title: "Task with missing project",
          projectId: "project-missing",
        }),
      );

      await expect(
        Effect.runPromise(repository.saveEntity("task", task.id, task)),
      ).rejects.toThrow("failed to persist task:task-invalid-project-ref");
      await expect(
        Effect.runPromise(repository.saveEntity("task", task.id, task)),
      ).rejects.toThrow("invalid task.project_id");

      await Effect.runPromise(repository.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("withTransaction rolls back writes when a later step fails", async () => {
    const { tempDir, databasePath } = makeTempDatabasePath();

    try {
      const repository = await Effect.runPromise(
        makeSqliteCoreRepository({ databasePath }),
      );
      const entry = await Effect.runPromise(
        createEntry({
          id: "entry-sqlite-tx-rollback-1",
          content: "Rollback candidate",
        }),
      );

      await expect(
        Effect.runPromise(
          repository.withTransaction!(
            Effect.gen(function* () {
              yield* repository.saveEntity("entry", entry.id, entry);
              return yield* Effect.fail(new Error("force rollback"));
            }),
          ),
        ),
      ).rejects.toThrow("force rollback");

      const persisted = await Effect.runPromise(
        repository.getEntity("entry", entry.id),
      );
      expect(persisted).toBeUndefined();

      await Effect.runPromise(repository.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("withTransaction supports nested transactional scopes", async () => {
    const { tempDir, databasePath } = makeTempDatabasePath();

    try {
      const repository = await Effect.runPromise(
        makeSqliteCoreRepository({ databasePath }),
      );
      const entry = await Effect.runPromise(
        createEntry({
          id: "entry-sqlite-nested-tx-1",
          content: "Nested transaction entry",
        }),
      );

      await Effect.runPromise(
        repository.withTransaction!(
          Effect.gen(function* () {
            yield* repository.withTransaction!(
              repository.saveEntity("entry", entry.id, entry),
            );
          }),
        ),
      );

      const persisted = await Effect.runPromise(
        repository.getEntity("entry", entry.id),
      );
      expect(persisted).toEqual(entry);

      await Effect.runPromise(repository.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("withTransaction isolates overlapping root transactions", async () => {
    const { tempDir, databasePath } = makeTempDatabasePath();

    try {
      const repository = await Effect.runPromise(
        makeSqliteCoreRepository({ databasePath }),
      );
      const rolledBackEntry = await Effect.runPromise(
        createEntry({
          id: "entry-sqlite-overlap-a",
          content: "Outer transaction entry",
        }),
      );
      const committedEntry = await Effect.runPromise(
        createEntry({
          id: "entry-sqlite-overlap-b",
          content: "Concurrent transaction entry",
        }),
      );

      let notifyOuterStarted: () => void = () => {};
      const outerStarted = new Promise<void>((resolve) => {
        notifyOuterStarted = resolve;
      });
      let releaseOuter: () => void = () => {};
      const outerGate = new Promise<void>((resolve) => {
        releaseOuter = resolve;
      });

      const txAPromise = Effect.runPromise(
        Effect.either(
          repository.withTransaction!(
            Effect.gen(function* () {
              yield* repository.saveEntity(
                "entry",
                rolledBackEntry.id,
                rolledBackEntry,
              );
              yield* Effect.sync(() => notifyOuterStarted());
              yield* Effect.promise(() => outerGate);
              return yield* Effect.fail(new Error("force outer rollback"));
            }),
          ),
        ),
      );

      await outerStarted;

      const txBPromise = Effect.runPromise(
        Effect.either(
          repository.withTransaction!(
            repository.saveEntity("entry", committedEntry.id, committedEntry),
          ),
        ),
      );

      releaseOuter();

      const [txAResult, txBResult] = await Promise.all([txAPromise, txBPromise]);
      expect(Either.isLeft(txAResult)).toBe(true);
      expect(Either.isRight(txBResult)).toBe(true);

      const rolledBack = await Effect.runPromise(
        repository.getEntity("entry", rolledBackEntry.id),
      );
      const committed = await Effect.runPromise(
        repository.getEntity("entry", committedEntry.id),
      );

      expect(rolledBack).toBeUndefined();
      expect(committed).toEqual(committedEntry);

      await Effect.runPromise(repository.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("getEntity returns undefined for missing rows and parsed entity for existing rows", async () => {
    const { tempDir, databasePath } = makeTempDatabasePath();

    try {
      const repository = await Effect.runPromise(
        makeSqliteCoreRepository({ databasePath }),
      );
      const task = await Effect.runPromise(
        createTask({
          id: "task-sqlite-1",
          title: "Persisted task",
        }),
      );

      await Effect.runPromise(repository.saveEntity("task", task.id, task));

      const found = await Effect.runPromise(
        repository.getEntity<typeof task>("task", task.id),
      );
      const missing = await Effect.runPromise(
        repository.getEntity("task", "task-missing"),
      );

      expect(found).toEqual(task);
      expect(missing).toBeUndefined();

      await Effect.runPromise(repository.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("listEntities returns deterministic rows for a single entity type", async () => {
    const { tempDir, databasePath } = makeTempDatabasePath();

    try {
      const repository = await Effect.runPromise(
        makeSqliteCoreRepository({ databasePath }),
      );
      const taskB = await Effect.runPromise(
        createTask({
          id: "task-b",
          title: "Task B",
        }),
      );
      const taskA = await Effect.runPromise(
        createTask({
          id: "task-a",
          title: "Task A",
        }),
      );
      const taskC = await Effect.runPromise(
        createTask({
          id: "task-c",
          title: "Task C",
        }),
      );

      await Effect.runPromise(repository.saveEntity("task", taskB.id, taskB));
      await Effect.runPromise(repository.saveEntity("task", taskA.id, taskA));
      await Effect.runPromise(repository.saveEntity("task", taskC.id, taskC));

      const listed = await Effect.runPromise(
        repository.listEntities<{ id: string }>("task"),
      );

      expect(listed.map((task) => task.id)).toEqual([
        "task-a",
        "task-b",
        "task-c",
      ]);

      await Effect.runPromise(repository.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("listEntities performs bounded paged reads instead of unbounded SELECT * scans", async () => {
    const queriedSql: Array<string> = [];
    const rows = [
      { id: "task-a", title: "Task A" },
      { id: "task-b", title: "Task B" },
      { id: "task-c", title: "Task C" },
    ];
    const fakeDb = {
      exec: () => {},
      close: () => {},
      query: (sql: string) => {
        queriedSql.push(sql);
        return {
          all: (limit: number, offset: number) =>
            rows.slice(offset, offset + limit),
        };
      },
    } as unknown as Database;

    const repository = await Effect.runPromise(
      makeSqliteCoreRepository({
        databasePath: ":memory:",
        runMigrationsOnInit: false,
        openDatabase: () => fakeDb,
      }),
    );

    const listed = await Effect.runPromise(
      repository.listEntities<{ id: string }>("task"),
    );

    expect(queriedSql.some((sql) => sql.includes("LIMIT ? OFFSET ?"))).toBe(
      true,
    );
    expect(listed.map((task) => task.id)).toEqual([
      "task-a",
      "task-b",
      "task-c",
    ]);

    await Effect.runPromise(repository.close());
  });

  test("deleteEntity enforces relation integrity and supports memory_key_index cleanup", async () => {
    const { tempDir, databasePath } = makeTempDatabasePath();

    try {
      const repository = await Effect.runPromise(
        makeSqliteCoreRepository({ databasePath }),
      );

      await Effect.runPromise(
        repository.saveEntity("memory", "memory-1", {
          id: "memory-1",
          key: "favorite_color",
          value: "blue",
          source: "user",
          confidence: 0.9,
          createdAt: "2026-02-23T00:00:00.000Z",
          updatedAt: "2026-02-23T00:00:00.000Z",
        }),
      );
      await Effect.runPromise(
        repository.saveEntity(
          "memory_key_index",
          "memory-key-index:favorite_color",
          {
            id: "memory-key-index:favorite_color",
            key: "favorite_color",
            memoryId: "memory-1",
            updatedAt: "2026-02-23T00:00:00.000Z",
          },
        ),
      );

      await expect(
        Effect.runPromise(repository.deleteEntity("memory", "memory-1")),
      ).rejects.toThrow(
        "invalid delete memory.id referenced by memory_key_index.memory_id",
      );
      await Effect.runPromise(
        repository.deleteEntity(
          "memory_key_index",
          "memory-key-index:favorite_color",
        ),
      );
      await Effect.runPromise(repository.deleteEntity("memory", "memory-1"));

      const deletedMemory = await Effect.runPromise(
        repository.getEntity("memory", "memory-1"),
      );
      const deletedIndex = await Effect.runPromise(
        repository.getEntity(
          "memory_key_index",
          "memory-key-index:favorite_color",
        ),
      );

      expect(deletedMemory).toBeUndefined();
      expect(deletedIndex).toBeUndefined();

      await Effect.runPromise(repository.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("appendAuditTransition persists actor/reason/state metadata as append-only rows", async () => {
    const { tempDir, databasePath } = makeTempDatabasePath();

    try {
      const repository = await Effect.runPromise(
        makeSqliteCoreRepository({ databasePath }),
      );
      const task = await Effect.runPromise(
        createTask({
          id: "task-append-audit",
          title: "Task for audit appends",
        }),
      );
      await Effect.runPromise(repository.saveEntity("task", task.id, task));

      const first = await Effect.runPromise(
        createAuditTransition({
          id: "audit-sqlite-1",
          entityType: "task",
          entityId: "task-append-audit",
          fromState: "planned",
          toState: "deferred",
          actor: { id: "user-1", kind: "user" },
          reason: "Blocked",
          at: new Date("2026-02-23T12:00:00.000Z"),
          metadata: { blocker: "dependency" },
        }),
      );
      const second = await Effect.runPromise(
        createAuditTransition({
          id: "audit-sqlite-2",
          entityType: "task",
          entityId: "task-append-audit",
          fromState: "deferred",
          toState: "planned",
          actor: { id: "user-1", kind: "user" },
          reason: "Unblocked",
          at: new Date("2026-02-23T12:05:00.000Z"),
          metadata: { blocker: "cleared" },
        }),
      );

      await Effect.runPromise(repository.appendAuditTransition(first));
      await Effect.runPromise(repository.appendAuditTransition(second));

      const db = new Database(databasePath, { readonly: true });
      const rows = db
        .query(
          `
            SELECT
              id,
              actor_id AS actorId,
              reason,
              metadata
            FROM audit_transitions
            WHERE entity_type = 'task' AND entity_id = 'task-append-audit'
            ORDER BY rowid ASC
          `,
        )
        .all() as Array<{
        id: string;
        actorId: string;
        reason: string;
        metadata: string | null;
      }>;
      db.close();

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        id: "audit-sqlite-1",
        actorId: "user-1",
        reason: "Blocked",
        metadata: JSON.stringify({ blocker: "dependency" }),
      });
      expect(rows[1]).toEqual({
        id: "audit-sqlite-2",
        actorId: "user-1",
        reason: "Unblocked",
        metadata: JSON.stringify({ blocker: "cleared" }),
      });

      await Effect.runPromise(repository.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("listAuditTrail filters by entityType/entityId and preserves insertion order", async () => {
    const { tempDir, databasePath } = makeTempDatabasePath();

    try {
      const repository = await Effect.runPromise(
        makeSqliteCoreRepository({ databasePath }),
      );
      const task1 = await Effect.runPromise(
        createTask({
          id: "task-1",
          title: "Task 1",
        }),
      );
      const task2 = await Effect.runPromise(
        createTask({
          id: "task-2",
          title: "Task 2",
        }),
      );
      await Effect.runPromise(repository.saveEntity("task", task1.id, task1));
      await Effect.runPromise(repository.saveEntity("task", task2.id, task2));

      const transitions = await Promise.all([
        Effect.runPromise(
          createAuditTransition({
            id: "audit-filter-1",
            entityType: "task",
            entityId: "task-1",
            fromState: "none",
            toState: "planned",
            actor: { id: "user-1", kind: "user" },
            reason: "Task created",
            at: new Date("2026-02-23T13:00:00.000Z"),
          }),
        ),
        Effect.runPromise(
          createAuditTransition({
            id: "audit-filter-2",
            entityType: "task",
            entityId: "task-2",
            fromState: "none",
            toState: "planned",
            actor: { id: "user-1", kind: "user" },
            reason: "Task created",
            at: new Date("2026-02-23T13:01:00.000Z"),
          }),
        ),
        Effect.runPromise(
          createAuditTransition({
            id: "audit-filter-3",
            entityType: "task",
            entityId: "task-1",
            fromState: "planned",
            toState: "completed",
            actor: { id: "user-1", kind: "user" },
            reason: "Task completed",
            at: new Date("2026-02-23T13:02:00.000Z"),
          }),
        ),
      ]);

      for (const transition of transitions) {
        await Effect.runPromise(repository.appendAuditTransition(transition));
      }

      const filtered = await Effect.runPromise(
        repository.listAuditTrail({
          entityType: "task",
          entityId: "task-1",
        }),
      );

      expect(filtered.map((transition) => transition.id)).toEqual([
        "audit-filter-1",
        "audit-filter-3",
      ]);

      await Effect.runPromise(repository.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

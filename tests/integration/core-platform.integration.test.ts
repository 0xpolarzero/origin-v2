import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Effect } from "effect";

import { buildCorePlatform } from "../../src/core/app/core-platform";
import { CoreRepository } from "../../src/core/repositories/core-repository";
import { makeInMemoryCoreRepository } from "../../src/core/repositories/in-memory-core-repository";

describe("Core Platform integration", () => {
  test("captures an Entry and promotes it into a triaged Task", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());

    await Effect.runPromise(
      platform.captureEntry({
        entryId: "entry-1",
        content: "Prepare sprint plan",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T08:00:00.000Z"),
      }),
    );

    const task = await Effect.runPromise(
      platform.acceptEntryAsTask({
        entryId: "entry-1",
        taskId: "task-1",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T08:05:00.000Z"),
      }),
    );

    const audit = await Effect.runPromise(
      platform.listAuditTrail({ entityType: "task", entityId: "task-1" }),
    );

    expect(task.id).toBe("task-1");
    expect(task.status).toBe("planned");
    expect(task.sourceEntryId).toBe("entry-1");
    expect(audit).toHaveLength(1);
  });

  test("moves a Task through project planning and checkpoint creation", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());

    await Effect.runPromise(
      platform.captureEntry({
        entryId: "entry-2",
        content: "Draft launch checklist",
        actor: { id: "user-1", kind: "user" },
      }),
    );

    await Effect.runPromise(
      platform.acceptEntryAsTask({
        entryId: "entry-2",
        taskId: "task-2",
        actor: { id: "user-1", kind: "user" },
      }),
    );

    await Effect.runPromise(
      platform.rescheduleTask("task-2", new Date("2026-02-24T12:00:00.000Z"), {
        id: "user-1",
        kind: "user",
      }),
    );

    await Effect.runPromise(
      platform.completeTask(
        "task-2",
        { id: "user-1", kind: "user" },
        new Date("2026-02-24T12:30:00.000Z"),
      ),
    );

    const checkpoint = await Effect.runPromise(
      platform.createWorkflowCheckpoint({
        checkpointId: "checkpoint-1",
        name: "After planning",
        snapshotEntityRefs: [{ entityType: "task", entityId: "task-2" }],
        auditCursor: 10,
        rollbackTarget: "audit-10",
        actor: { id: "user-1", kind: "user" },
      }),
    );

    const task = await Effect.runPromise(platform.getEntity("task", "task-2"));

    expect((task as { status: string }).status).toBe("completed");
    expect(checkpoint.status).toBe("created");
  });

  test("persists and rehydrates core entities across app restarts", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "origin-core-"));
    const snapshotPath = join(tempDir, "core-snapshot.json");

    try {
      const platformA = await Effect.runPromise(
        buildCorePlatform({
          snapshotPath,
        }),
      );

      await Effect.runPromise(
        platformA.captureEntry({
          entryId: "entry-3",
          content: "Persist me",
          actor: { id: "user-1", kind: "user" },
        }),
      );
      await Effect.runPromise(
        platformA.acceptEntryAsTask({
          entryId: "entry-3",
          taskId: "task-3",
          actor: { id: "user-1", kind: "user" },
        }),
      );
      await Effect.runPromise(platformA.persistSnapshot());

      const platformB = await Effect.runPromise(
        buildCorePlatform({
          snapshotPath,
          loadSnapshotOnInit: true,
        }),
      );

      const task = await Effect.runPromise(
        platformB.getEntity("task", "task-3"),
      );

      expect(task).toBeDefined();
      expect((task as { id: string }).id).toBe("task-3");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("wraps mutating workflow operations in repository transaction boundaries", async () => {
    const baseRepository = makeInMemoryCoreRepository();
    const transactionCalls: Array<string> = [];

    const repository: CoreRepository = {
      ...baseRepository,
      withTransaction: (effect) => {
        transactionCalls.push("withTransaction");
        return effect;
      },
    };
    const platform = await Effect.runPromise(
      buildCorePlatform({
        repository,
      }),
    );

    await Effect.runPromise(
      platform.captureEntry({
        entryId: "entry-tx-1",
        content: "Exercise transaction boundary",
        actor: { id: "user-1", kind: "user" },
      }),
    );

    expect(transactionCalls.length).toBe(1);
  });
});

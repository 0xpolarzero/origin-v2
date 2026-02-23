import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createTask } from "../../../../src/core/domain/task";
import {
  completeTask,
  deferTask,
  rescheduleTask,
} from "../../../../src/core/services/task-service";
import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";

describe("task-service", () => {
  test("completeTask transitions planned -> completed", async () => {
    const repository = makeInMemoryCoreRepository();
    const task = await Effect.runPromise(
      createTask({
        id: "task-1",
        title: "Finalize launch plan",
      }),
    );
    await Effect.runPromise(repository.saveEntity("task", task.id, task));

    const updated = await Effect.runPromise(
      completeTask(
        repository,
        "task-1",
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T10:00:00.000Z"),
      ),
    );

    const persisted = await Effect.runPromise(
      repository.getEntity("task", "task-1"),
    );
    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({ entityType: "task", entityId: "task-1" }),
    );

    expect(updated.status).toBe("completed");
    expect(updated.completedAt).toBe("2026-02-23T10:00:00.000Z");
    expect(persisted).toEqual(updated);
    expect(auditTrail[0]?.fromState).toBe("planned");
    expect(auditTrail[0]?.toState).toBe("completed");
  });

  test("deferTask transitions planned -> deferred", async () => {
    const repository = makeInMemoryCoreRepository();
    const task = await Effect.runPromise(
      createTask({
        id: "task-2",
        title: "Finalize launch plan",
      }),
    );
    await Effect.runPromise(repository.saveEntity("task", task.id, task));

    const updated = await Effect.runPromise(
      deferTask(
        repository,
        "task-2",
        new Date("2026-02-24T09:00:00.000Z"),
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T10:30:00.000Z"),
      ),
    );

    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({ entityType: "task", entityId: "task-2" }),
    );

    expect(updated.status).toBe("deferred");
    expect(updated.deferredUntil).toBe("2026-02-24T09:00:00.000Z");
    expect(auditTrail[0]?.toState).toBe("deferred");
  });

  test("rescheduleTask updates schedule and keeps task planned", async () => {
    const repository = makeInMemoryCoreRepository();
    const task = await Effect.runPromise(
      createTask({
        id: "task-3",
        title: "Finalize launch plan",
      }),
    );
    await Effect.runPromise(repository.saveEntity("task", task.id, task));

    const updated = await Effect.runPromise(
      rescheduleTask(
        repository,
        "task-3",
        new Date("2026-02-25T13:00:00.000Z"),
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T11:00:00.000Z"),
      ),
    );

    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({ entityType: "task", entityId: "task-3" }),
    );

    expect(updated.status).toBe("planned");
    expect(updated.scheduledFor).toBe("2026-02-25T13:00:00.000Z");
    expect(auditTrail[0]?.toState).toBe("planned");
  });
});

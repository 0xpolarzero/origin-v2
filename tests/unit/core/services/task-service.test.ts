import { describe, expect, test } from "bun:test";
import { Either, Effect } from "effect";

import { createTask } from "../../../../src/core/domain/task";
import {
  completeTask,
  createTaskFromInput,
  deferTask,
  listTasks,
  rescheduleTask,
  TaskTransitionError,
  updateTaskDetails,
} from "../../../../src/core/services/task-service";
import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";

describe("task-service", () => {
  test("createTaskFromInput persists a task and records an audit transition", async () => {
    const repository = makeInMemoryCoreRepository();

    const created = await Effect.runPromise(
      createTaskFromInput(repository, {
        taskId: "task-create-1",
        title: "Draft launch checklist",
        description: "Collect final launch blockers",
        scheduledFor: new Date("2026-03-01T09:00:00.000Z"),
        dueAt: new Date("2026-03-01T17:00:00.000Z"),
        projectId: "project-1",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T08:00:00.000Z"),
      }),
    );

    const persisted = await Effect.runPromise(
      repository.getEntity("task", "task-create-1"),
    );
    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({
        entityType: "task",
        entityId: "task-create-1",
      }),
    );

    expect(created).toMatchObject({
      id: "task-create-1",
      title: "Draft launch checklist",
      description: "Collect final launch blockers",
      status: "planned",
      scheduledFor: "2026-03-01T09:00:00.000Z",
      dueAt: "2026-03-01T17:00:00.000Z",
      projectId: "project-1",
      createdAt: "2026-02-23T08:00:00.000Z",
      updatedAt: "2026-02-23T08:00:00.000Z",
    });
    expect(persisted).toEqual(created);
    expect(auditTrail[0]?.fromState).toBe("none");
    expect(auditTrail[0]?.toState).toBe("planned");
  });

  test("createTaskFromInput maps domain validation to invalid_request", async () => {
    const repository = makeInMemoryCoreRepository();

    const result = await Effect.runPromise(
      Effect.either(
        createTaskFromInput(repository, {
          taskId: "task-create-invalid",
          title: "   ",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T08:05:00.000Z"),
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(TaskTransitionError);
      expect(result.left).toMatchObject({
        message: "failed to create task: title is required",
        code: "invalid_request",
      });
    }
  });

  test("createTaskFromInput returns conflict when task id already exists", async () => {
    const repository = makeInMemoryCoreRepository();
    const existing = await Effect.runPromise(
      createTask({
        id: "task-create-duplicate",
        title: "Existing task",
      }),
    );
    await Effect.runPromise(
      repository.saveEntity("task", existing.id, existing),
    );

    const result = await Effect.runPromise(
      Effect.either(
        createTaskFromInput(repository, {
          taskId: "task-create-duplicate",
          title: "Duplicate attempt",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T08:10:00.000Z"),
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        message: "task task-create-duplicate already exists",
        code: "conflict",
      });
    }
  });

  test("updateTaskDetails updates mutable fields and appends audit transition", async () => {
    const repository = makeInMemoryCoreRepository();
    const task = await Effect.runPromise(
      createTask({
        id: "task-update-1",
        title: "Original title",
        description: "Original description",
        scheduledFor: new Date("2026-03-03T09:00:00.000Z"),
        dueAt: new Date("2026-03-03T17:00:00.000Z"),
        projectId: "project-old",
      }),
    );
    await Effect.runPromise(repository.saveEntity("task", task.id, task));

    const updated = await Effect.runPromise(
      updateTaskDetails(repository, {
        taskId: "task-update-1",
        title: "Updated title",
        description: null,
        scheduledFor: new Date("2026-03-04T09:00:00.000Z"),
        dueAt: null,
        projectId: "project-new",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T09:00:00.000Z"),
      }),
    );

    const persisted = await Effect.runPromise(
      repository.getEntity("task", "task-update-1"),
    );
    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({
        entityType: "task",
        entityId: "task-update-1",
      }),
    );

    expect(updated).toMatchObject({
      id: "task-update-1",
      title: "Updated title",
      status: "planned",
      scheduledFor: "2026-03-04T09:00:00.000Z",
      projectId: "project-new",
      updatedAt: "2026-02-23T09:00:00.000Z",
    });
    expect(updated.description).toBeUndefined();
    expect(updated.dueAt).toBeUndefined();
    expect(persisted).toEqual(updated);
    expect(auditTrail[0]?.fromState).toBe("planned");
    expect(auditTrail[0]?.toState).toBe("planned");
  });

  test("updateTaskDetails returns not_found when task is missing", async () => {
    const repository = makeInMemoryCoreRepository();

    const result = await Effect.runPromise(
      Effect.either(
        updateTaskDetails(repository, {
          taskId: "task-update-missing",
          title: "Refine title",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T09:05:00.000Z"),
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        message: "task task-update-missing was not found",
        code: "not_found",
      });
    }
  });

  test("updateTaskDetails validates title and returns invalid_request", async () => {
    const repository = makeInMemoryCoreRepository();
    const task = await Effect.runPromise(
      createTask({
        id: "task-update-invalid",
        title: "Original",
      }),
    );
    await Effect.runPromise(repository.saveEntity("task", task.id, task));

    const result = await Effect.runPromise(
      Effect.either(
        updateTaskDetails(repository, {
          taskId: "task-update-invalid",
          title: "  ",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T09:10:00.000Z"),
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        message: "title is required",
        code: "invalid_request",
      });
    }
  });

  test("updateTaskDetails rejects schedule edits for deferred/completed tasks", async () => {
    const repository = makeInMemoryCoreRepository();
    const task = await Effect.runPromise(
      createTask({
        id: "task-update-conflict",
        title: "Deferred task",
      }),
    );
    await Effect.runPromise(repository.saveEntity("task", task.id, task));
    await Effect.runPromise(
      deferTask(
        repository,
        task.id,
        new Date("2026-03-06T09:00:00.000Z"),
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T09:20:00.000Z"),
      ),
    );

    const result = await Effect.runPromise(
      Effect.either(
        updateTaskDetails(repository, {
          taskId: task.id,
          scheduledFor: new Date("2026-03-07T09:00:00.000Z"),
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T09:30:00.000Z"),
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        message:
          "task task-update-conflict must be planned before updating scheduledFor",
        code: "conflict",
      });
    }
  });

  test("listTasks filters by status/project/schedule and sorts by updatedAt desc", async () => {
    const repository = makeInMemoryCoreRepository();
    const actor = { id: "user-1", kind: "user" } as const;

    await Effect.runPromise(
      createTaskFromInput(repository, {
        taskId: "task-list-1",
        title: "Task one",
        projectId: "project-a",
        scheduledFor: new Date("2026-03-01T09:00:00.000Z"),
        actor,
        at: new Date("2026-02-23T08:00:00.000Z"),
      }),
    );
    await Effect.runPromise(
      createTaskFromInput(repository, {
        taskId: "task-list-2",
        title: "Task two",
        projectId: "project-a",
        scheduledFor: new Date("2026-03-02T09:00:00.000Z"),
        actor,
        at: new Date("2026-02-23T09:00:00.000Z"),
      }),
    );
    await Effect.runPromise(
      createTaskFromInput(repository, {
        taskId: "task-list-3",
        title: "Task three",
        projectId: "project-b",
        scheduledFor: new Date("2026-03-02T11:00:00.000Z"),
        actor,
        at: new Date("2026-02-23T10:00:00.000Z"),
      }),
    );
    await Effect.runPromise(
      createTaskFromInput(repository, {
        taskId: "task-list-4",
        title: "Task four",
        projectId: "project-a",
        scheduledFor: new Date("2026-03-04T11:00:00.000Z"),
        actor,
        at: new Date("2026-02-23T07:00:00.000Z"),
      }),
    );

    await Effect.runPromise(
      completeTask(
        repository,
        "task-list-3",
        actor,
        new Date("2026-02-23T11:00:00.000Z"),
      ),
    );
    await Effect.runPromise(
      deferTask(
        repository,
        "task-list-4",
        new Date("2026-03-05T11:00:00.000Z"),
        actor,
        new Date("2026-02-23T12:00:00.000Z"),
      ),
    );

    const allTasks = await Effect.runPromise(listTasks(repository));
    const filtered = await Effect.runPromise(
      listTasks(repository, {
        status: "planned",
        projectId: "project-a",
        scheduledFrom: new Date("2026-03-01T00:00:00.000Z"),
        scheduledTo: new Date("2026-03-03T00:00:00.000Z"),
      }),
    );

    expect(allTasks.map((task) => task.id)).toEqual([
      "task-list-4",
      "task-list-3",
      "task-list-2",
      "task-list-1",
    ]);
    expect(filtered.map((task) => task.id)).toEqual([
      "task-list-2",
      "task-list-1",
    ]);
  });

  test("listTasks validates scheduled window bounds", async () => {
    const repository = makeInMemoryCoreRepository();

    const result = await Effect.runPromise(
      Effect.either(
        listTasks(repository, {
          scheduledFrom: new Date("2026-03-04T00:00:00.000Z"),
          scheduledTo: new Date("2026-03-03T00:00:00.000Z"),
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        message: "scheduledFrom must be before or equal to scheduledTo",
        code: "invalid_request",
      });
    }
  });

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

  test("completeTask returns not_found code when task is missing", async () => {
    const repository = makeInMemoryCoreRepository();

    const result = await Effect.runPromise(
      Effect.either(
        completeTask(
          repository,
          "task-missing-404",
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T10:05:00.000Z"),
        ),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(TaskTransitionError);
      expect(result.left).toMatchObject({
        message: "task task-missing-404 was not found",
        code: "not_found",
      });
    }
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

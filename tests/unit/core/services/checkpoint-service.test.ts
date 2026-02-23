import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createTask } from "../../../../src/core/domain/task";
import { CoreRepository } from "../../../../src/core/repositories/core-repository";
import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";
import {
  createWorkflowCheckpoint,
  keepCheckpoint,
  recoverCheckpoint,
} from "../../../../src/core/services/checkpoint-service";

const withTransactionSpy = (
  baseRepository: CoreRepository,
): {
  repository: CoreRepository;
  getWithTransactionCalls: () => number;
} => {
  let withTransactionCalls = 0;

  return {
    repository: {
      ...baseRepository,
      withTransaction: (effect) => {
        withTransactionCalls += 1;
        return baseRepository.withTransaction(effect);
      },
    },
    getWithTransactionCalls: () => withTransactionCalls,
  };
};

describe("checkpoint-service", () => {
  test("createWorkflowCheckpoint snapshots entities and appends create transition metadata", async () => {
    const repository = makeInMemoryCoreRepository();
    const existingTask = await Effect.runPromise(
      createTask({
        id: "task-1",
        title: "Existing task",
        createdAt: new Date("2026-02-23T14:59:00.000Z"),
        updatedAt: new Date("2026-02-23T14:59:00.000Z"),
      }),
    );
    await Effect.runPromise(
      repository.saveEntity("task", existingTask.id, existingTask),
    );

    const checkpoint = await Effect.runPromise(
      createWorkflowCheckpoint(repository, {
        checkpointId: "checkpoint-1",
        name: "Before AI rewrite",
        snapshotEntityRefs: [
          { entityType: "task", entityId: "task-1" },
          { entityType: "project", entityId: "project-1" },
        ],
        auditCursor: 42,
        rollbackTarget: "audit-42",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T15:00:00.000Z"),
      }),
    );

    const persisted = await Effect.runPromise(
      repository.getEntity("checkpoint", checkpoint.id),
    );
    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({
        entityType: "checkpoint",
        entityId: checkpoint.id,
      }),
    );

    expect(checkpoint.status).toBe("created");
    expect(checkpoint.auditCursor).toBe(42);
    expect(checkpoint.snapshotEntities).toEqual([
      {
        entityType: "task",
        entityId: "task-1",
        existed: true,
        state: existingTask,
      },
      {
        entityType: "project",
        entityId: "project-1",
        existed: false,
        state: undefined,
      },
    ]);
    expect(persisted).toEqual(checkpoint);
    expect(auditTrail).toHaveLength(1);
    expect(auditTrail[0]).toMatchObject({
      entityType: "checkpoint",
      entityId: "checkpoint-1",
      fromState: "none",
      toState: "created",
      reason: "Checkpoint created",
      actor: { id: "user-1", kind: "user" },
      metadata: { rollbackTarget: "audit-42" },
    });
  });

  test("createWorkflowCheckpoint executes inside repository transaction boundary", async () => {
    const baseRepository = makeInMemoryCoreRepository();
    const { repository, getWithTransactionCalls } =
      withTransactionSpy(baseRepository);

    await Effect.runPromise(
      createWorkflowCheckpoint(repository, {
        checkpointId: "checkpoint-create-tx",
        name: "Transactional create",
        snapshotEntityRefs: [],
        auditCursor: 5,
        rollbackTarget: "audit-5",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T15:02:00.000Z"),
      }),
    );

    expect(getWithTransactionCalls()).toBe(1);
  });

  test("keepCheckpoint executes inside repository transaction boundary", async () => {
    const baseRepository = makeInMemoryCoreRepository();
    await Effect.runPromise(
      createWorkflowCheckpoint(baseRepository, {
        checkpointId: "checkpoint-keep-tx",
        name: "Transactional keep",
        snapshotEntityRefs: [],
        auditCursor: 6,
        rollbackTarget: "audit-6",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T15:03:00.000Z"),
      }),
    );
    const { repository, getWithTransactionCalls } =
      withTransactionSpy(baseRepository);

    await Effect.runPromise(
      keepCheckpoint(
        repository,
        "checkpoint-keep-tx",
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T15:04:00.000Z"),
      ),
    );

    expect(getWithTransactionCalls()).toBe(1);
  });

  test("recoverCheckpoint executes inside repository transaction boundary", async () => {
    const baseRepository = makeInMemoryCoreRepository();
    await Effect.runPromise(
      createWorkflowCheckpoint(baseRepository, {
        checkpointId: "checkpoint-recover-tx",
        name: "Transactional recover",
        snapshotEntityRefs: [],
        auditCursor: 8,
        rollbackTarget: "audit-8",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T15:05:00.000Z"),
      }),
    );
    const { repository, getWithTransactionCalls } =
      withTransactionSpy(baseRepository);

    await Effect.runPromise(
      recoverCheckpoint(
        repository,
        "checkpoint-recover-tx",
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T15:06:00.000Z"),
      ),
    );

    expect(getWithTransactionCalls()).toBe(1);
  });

  test("createWorkflowCheckpoint maps domain validation errors", async () => {
    const repository = makeInMemoryCoreRepository();

    await expect(
      Effect.runPromise(
        createWorkflowCheckpoint(repository, {
          checkpointId: "checkpoint-invalid",
          name: "   ",
          snapshotEntityRefs: [],
          auditCursor: 1,
          rollbackTarget: "audit-1",
          actor: { id: "user-1", kind: "user" },
        }),
      ),
    ).rejects.toThrow("failed to create checkpoint: name is required");
  });

  test("createWorkflowCheckpoint surfaces append-audit repository failures", async () => {
    const baseRepository = makeInMemoryCoreRepository();
    const repository = {
      ...baseRepository,
      appendAuditTransition: () =>
        Effect.fail(new Error("append transition failed")),
    } as unknown as CoreRepository;

    await expect(
      Effect.runPromise(
        createWorkflowCheckpoint(repository, {
          checkpointId: "checkpoint-append-failure",
          name: "Append failure",
          snapshotEntityRefs: [],
          auditCursor: 4,
          rollbackTarget: "audit-4",
          actor: { id: "user-1", kind: "user" },
        }),
      ),
    ).rejects.toThrow("append transition failed");
  });

  test("recoverCheckpoint surfaces entity restore repository failures", async () => {
    const baseRepository = makeInMemoryCoreRepository();
    const originalTask = await Effect.runPromise(
      createTask({
        id: "task-restore-failure",
        title: "Restore failure target",
      }),
    );
    await Effect.runPromise(
      baseRepository.saveEntity("task", originalTask.id, originalTask),
    );
    let failRestoreWrite = false;

    const repository = {
      ...baseRepository,
      saveEntity: (
        entityType: string,
        entityId: string,
        entity: unknown,
      ): Effect.Effect<void> => {
        if (
          failRestoreWrite &&
          entityType === "task" &&
          entityId === "task-restore-failure"
        ) {
          return Effect.fail(new Error("restore write failed")) as never;
        }

        return baseRepository.saveEntity(entityType, entityId, entity);
      },
    } as CoreRepository;

    await Effect.runPromise(
      createWorkflowCheckpoint(repository, {
        checkpointId: "checkpoint-restore-failure",
        name: "Before restore failure",
        snapshotEntityRefs: [
          {
            entityType: "task",
            entityId: "task-restore-failure",
          },
        ],
        auditCursor: 9,
        rollbackTarget: "audit-9",
        actor: { id: "user-1", kind: "user" },
      }),
    );

    await Effect.runPromise(
      baseRepository.saveEntity("task", "task-restore-failure", {
        ...originalTask,
        title: "Mutated task title",
      }),
    );
    failRestoreWrite = true;

    await expect(
      Effect.runPromise(
        recoverCheckpoint(
          repository,
          "checkpoint-restore-failure",
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T15:40:00.000Z"),
        ),
      ),
    ).rejects.toThrow("restore write failed");
  });

  test("recoverCheckpoint restores prior state and appends recovery transition", async () => {
    const repository = makeInMemoryCoreRepository();
    const originalTask = await Effect.runPromise(
      createTask({
        id: "task-22",
        title: "Original task title",
      }),
    );
    await Effect.runPromise(
      repository.saveEntity("task", originalTask.id, originalTask),
    );

    await Effect.runPromise(
      createWorkflowCheckpoint(repository, {
        checkpointId: "checkpoint-2",
        name: "Before import",
        snapshotEntityRefs: [
          { entityType: "task", entityId: "task-22" },
          { entityType: "task", entityId: "task-created-later" },
        ],
        auditCursor: 7,
        rollbackTarget: "audit-7",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T15:10:00.000Z"),
      }),
    );
    await Effect.runPromise(
      repository.saveEntity("task", "task-22", {
        ...originalTask,
        title: "Mutated task title",
      }),
    );
    await Effect.runPromise(
      repository.saveEntity("task", "task-created-later", {
        id: "task-created-later",
        title: "Created after checkpoint",
      }),
    );

    const kept = await Effect.runPromise(
      keepCheckpoint(
        repository,
        "checkpoint-2",
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T15:11:00.000Z"),
      ),
    );

    const recovered = await Effect.runPromise(
      recoverCheckpoint(
        repository,
        "checkpoint-2",
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T15:12:00.000Z"),
      ),
    );

    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({
        entityType: "checkpoint",
        entityId: "checkpoint-2",
      }),
    );
    const restoredTask = await Effect.runPromise(
      repository.getEntity<{ title: string }>("task", "task-22"),
    );
    const removedTask = await Effect.runPromise(
      repository.getEntity("task", "task-created-later"),
    );

    expect(kept.status).toBe("kept");
    expect(recovered.checkpoint.status).toBe("recovered");
    expect(recovered.recoveredEntityRefs).toEqual([
      { entityType: "task", entityId: "task-22" },
      { entityType: "task", entityId: "task-created-later" },
    ]);
    expect(restoredTask?.title).toBe("Original task title");
    expect(removedTask).toBeUndefined();
    expect(auditTrail[auditTrail.length - 1]?.toState).toBe("recovered");
  });

  test("recoverCheckpoint fails when checkpoint is missing", async () => {
    const repository = makeInMemoryCoreRepository();

    await expect(
      Effect.runPromise(
        recoverCheckpoint(
          repository,
          "checkpoint-missing",
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T15:12:00.000Z"),
        ),
      ),
    ).rejects.toThrow("checkpoint checkpoint-missing was not found");
  });

  test("keepCheckpoint fails when checkpoint is missing", async () => {
    const repository = makeInMemoryCoreRepository();

    await expect(
      Effect.runPromise(
        keepCheckpoint(
          repository,
          "checkpoint-missing",
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T15:12:00.000Z"),
        ),
      ),
    ).rejects.toThrow("checkpoint checkpoint-missing was not found");
  });

  test("keepCheckpoint rejects recovered checkpoints", async () => {
    const repository = makeInMemoryCoreRepository();

    await Effect.runPromise(
      createWorkflowCheckpoint(repository, {
        checkpointId: "checkpoint-keep-recovered",
        name: "Before risky rewrite",
        snapshotEntityRefs: [],
        auditCursor: 2,
        rollbackTarget: "audit-2",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T15:20:00.000Z"),
      }),
    );

    await Effect.runPromise(
      recoverCheckpoint(
        repository,
        "checkpoint-keep-recovered",
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T15:21:00.000Z"),
      ),
    );

    await expect(
      Effect.runPromise(
        keepCheckpoint(
          repository,
          "checkpoint-keep-recovered",
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T15:22:00.000Z"),
        ),
      ),
    ).rejects.toThrow(
      "checkpoint checkpoint-keep-recovered cannot transition recovered -> kept",
    );
  });

  test("recoverCheckpoint rejects already recovered checkpoints", async () => {
    const repository = makeInMemoryCoreRepository();

    await Effect.runPromise(
      createWorkflowCheckpoint(repository, {
        checkpointId: "checkpoint-recovered-twice",
        name: "Before data rewrite",
        snapshotEntityRefs: [],
        auditCursor: 3,
        rollbackTarget: "audit-3",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T15:30:00.000Z"),
      }),
    );

    await Effect.runPromise(
      recoverCheckpoint(
        repository,
        "checkpoint-recovered-twice",
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T15:31:00.000Z"),
      ),
    );

    await expect(
      Effect.runPromise(
        recoverCheckpoint(
          repository,
          "checkpoint-recovered-twice",
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T15:32:00.000Z"),
        ),
      ),
    ).rejects.toThrow(
      "checkpoint checkpoint-recovered-twice cannot transition recovered -> recovered",
    );
  });
});

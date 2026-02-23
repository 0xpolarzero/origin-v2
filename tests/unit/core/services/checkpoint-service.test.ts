import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";
import {
  createWorkflowCheckpoint,
  keepCheckpoint,
  recoverCheckpoint,
} from "../../../../src/core/services/checkpoint-service";

describe("checkpoint-service", () => {
  test("createWorkflowCheckpoint snapshots entity refs and audit cursor", async () => {
    const repository = makeInMemoryCoreRepository();

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

    expect(checkpoint.status).toBe("created");
    expect(checkpoint.auditCursor).toBe(42);
    expect(persisted).toEqual(checkpoint);
  });

  test("recoverCheckpoint restores prior state and appends recovery transition", async () => {
    const repository = makeInMemoryCoreRepository();

    await Effect.runPromise(
      createWorkflowCheckpoint(repository, {
        checkpointId: "checkpoint-2",
        name: "Before import",
        snapshotEntityRefs: [{ entityType: "task", entityId: "task-22" }],
        auditCursor: 7,
        rollbackTarget: "audit-7",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T15:10:00.000Z"),
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

    expect(kept.status).toBe("kept");
    expect(recovered.checkpoint.status).toBe("recovered");
    expect(recovered.recoveredEntityRefs).toEqual([
      { entityType: "task", entityId: "task-22" },
    ]);
    expect(auditTrail[auditTrail.length - 1]?.toState).toBe("recovered");
  });
});

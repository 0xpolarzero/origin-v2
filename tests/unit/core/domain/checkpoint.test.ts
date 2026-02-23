import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createCheckpoint } from "../../../../src/core/domain/checkpoint";

describe("createCheckpoint", () => {
  test("captures snapshot pointers and rollback target", async () => {
    const checkpoint = await Effect.runPromise(
      createCheckpoint({
        id: "checkpoint-1",
        name: "Before AI refactor",
        snapshotEntityRefs: [
          { entityType: "task", entityId: "task-1" },
          { entityType: "project", entityId: "project-1" },
        ],
        snapshotEntities: [
          {
            entityType: "task",
            entityId: "task-1",
            existed: true,
            state: { id: "task-1", title: "T" },
          },
          {
            entityType: "project",
            entityId: "project-1",
            existed: false,
          },
        ],
        auditCursor: 12,
        rollbackTarget: "audit-12",
      }),
    );

    expect(checkpoint.id).toBe("checkpoint-1");
    expect(checkpoint.status).toBe("created");
    expect(checkpoint.snapshotEntityRefs).toHaveLength(2);
    expect(checkpoint.snapshotEntities).toHaveLength(2);
    expect(checkpoint.rollbackTarget).toBe("audit-12");
    expect(checkpoint.auditCursor).toBe(12);
  });
});

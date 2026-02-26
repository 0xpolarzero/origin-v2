import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createAuditTransition } from "../../../../src/core/domain/audit-transition";
import { createEntry } from "../../../../src/core/domain/entry";
import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";

describe("makeInMemoryCoreRepository", () => {
  test("save/get/list entity records by type and id", async () => {
    const repository = makeInMemoryCoreRepository();
    const entry = await Effect.runPromise(
      createEntry({
        id: "entry-1",
        content: "Follow up with vendor",
      }),
    );

    await Effect.runPromise(repository.saveEntity("entry", entry.id, entry));

    const loaded = await Effect.runPromise(
      repository.getEntity("entry", "entry-1"),
    );
    const listed = await Effect.runPromise(repository.listEntities("entry"));

    expect(loaded).toEqual(entry);
    expect(listed).toEqual([entry]);
  });

  test("appendAuditTransition + listAuditTrail returns ordered immutable log", async () => {
    const repository = makeInMemoryCoreRepository();

    const first = await Effect.runPromise(
      createAuditTransition({
        id: "audit-1",
        entityType: "task",
        entityId: "task-1",
        fromState: "planned",
        toState: "deferred",
        actor: { id: "user-1", kind: "user" },
        reason: "Blocked by dependency",
        at: new Date("2026-02-23T10:00:00.000Z"),
      }),
    );

    const second = await Effect.runPromise(
      createAuditTransition({
        id: "audit-2",
        entityType: "task",
        entityId: "task-1",
        fromState: "deferred",
        toState: "planned",
        actor: { id: "user-1", kind: "user" },
        reason: "Dependency resolved",
        at: new Date("2026-02-23T11:00:00.000Z"),
      }),
    );

    await Effect.runPromise(repository.appendAuditTransition(first));
    await Effect.runPromise(repository.appendAuditTransition(second));

    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({ entityType: "task", entityId: "task-1" }),
    );

    expect(auditTrail).toEqual([first, second]);

    (auditTrail as Array<typeof first>)[0] = second;

    const reread = await Effect.runPromise(
      repository.listAuditTrail({ entityType: "task", entityId: "task-1" }),
    );

    expect(reread).toEqual([first, second]);
  });
});

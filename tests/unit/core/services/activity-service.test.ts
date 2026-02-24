import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createAuditTransition } from "../../../../src/core/domain/audit-transition";
import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";
import { listActivityFeed } from "../../../../src/core/services/activity-service";

describe("activity-service", () => {
  test("listActivityFeed returns newest-first and supports filtering/pagination", async () => {
    const repository = makeInMemoryCoreRepository();

    const transitions = await Effect.runPromise(
      Effect.all([
        createAuditTransition({
          id: "audit-activity-1",
          entityType: "task",
          entityId: "task-1",
          fromState: "planned",
          toState: "completed",
          actor: { id: "user-1", kind: "user" },
          reason: "Task completed",
          at: new Date("2026-02-23T10:00:00.000Z"),
        }),
        createAuditTransition({
          id: "audit-activity-2",
          entityType: "task",
          entityId: "task-1",
          fromState: "completed",
          toState: "planned",
          actor: { id: "ai-1", kind: "ai" },
          reason: "AI reverted completion",
          at: new Date("2026-02-23T10:01:00.000Z"),
        }),
        createAuditTransition({
          id: "audit-activity-3",
          entityType: "checkpoint",
          entityId: "checkpoint-1",
          fromState: "created",
          toState: "kept",
          actor: { id: "system-1", kind: "system" },
          reason: "Checkpoint kept",
          at: new Date("2026-02-23T10:02:00.000Z"),
        }),
        createAuditTransition({
          id: "audit-activity-4",
          entityType: "checkpoint",
          entityId: "checkpoint-1",
          fromState: "kept",
          toState: "recovered",
          actor: { id: "ai-1", kind: "ai" },
          reason: "AI recovered checkpoint",
          at: new Date("2026-02-23T10:03:00.000Z"),
          metadata: { rollbackTarget: "audit-12" },
        }),
      ]),
    );
    for (const transition of transitions) {
      await Effect.runPromise(repository.appendAuditTransition(transition));
    }

    const all = await Effect.runPromise(listActivityFeed(repository));
    const byEntity = await Effect.runPromise(
      listActivityFeed(repository, {
        entityType: "task",
        entityId: "task-1",
      }),
    );
    const byActorKind = await Effect.runPromise(
      listActivityFeed(repository, {
        actorKind: "system",
      }),
    );
    const aiOnly = await Effect.runPromise(
      listActivityFeed(repository, {
        aiOnly: true,
      }),
    );
    const paginated = await Effect.runPromise(
      listActivityFeed(repository, {
        beforeAt: new Date("2026-02-23T10:02:30.000Z"),
        limit: 2,
      }),
    );

    expect(all.map((item) => item.id)).toEqual([
      "audit-activity-4",
      "audit-activity-3",
      "audit-activity-2",
      "audit-activity-1",
    ]);
    expect(byEntity.map((item) => item.id)).toEqual([
      "audit-activity-2",
      "audit-activity-1",
    ]);
    expect(byActorKind.map((item) => item.id)).toEqual(["audit-activity-3"]);
    expect(aiOnly.map((item) => item.id)).toEqual([
      "audit-activity-4",
      "audit-activity-2",
    ]);
    expect(paginated.map((item) => item.id)).toEqual([
      "audit-activity-3",
      "audit-activity-2",
    ]);
    expect(paginated[0]?.metadata).toBeUndefined();
  });

  test("listActivityFeed uses repository-level filtered query when available", async () => {
    const baseRepository = makeInMemoryCoreRepository();
    let listAuditTrailCalls = 0;

    const repository = {
      ...baseRepository,
      listAuditTrail: (filter?: { entityType?: string; entityId?: string }) => {
        listAuditTrailCalls += 1;
        return baseRepository.listAuditTrail(filter);
      },
      listActivityFeed: () =>
        Effect.succeed([
          {
            id: "audit-repo-query-1",
            entityType: "checkpoint",
            entityId: "checkpoint-1",
            fromState: "created",
            toState: "kept",
            actor: { id: "user-1", kind: "user" as const },
            reason: "Kept from repository query",
            at: "2026-02-23T10:00:00.000Z",
            metadata: { source: "repo" },
          },
        ]),
    };

    const activity = await Effect.runPromise(
      listActivityFeed(repository, {
        entityType: "checkpoint",
        limit: 10,
      }),
    );

    expect(activity).toEqual([
      {
        id: "audit-repo-query-1",
        entityType: "checkpoint",
        entityId: "checkpoint-1",
        fromState: "created",
        toState: "kept",
        actor: { id: "user-1", kind: "user" },
        reason: "Kept from repository query",
        at: "2026-02-23T10:00:00.000Z",
        metadata: { source: "repo" },
      },
    ]);
    expect(listAuditTrailCalls).toBe(0);
  });
});

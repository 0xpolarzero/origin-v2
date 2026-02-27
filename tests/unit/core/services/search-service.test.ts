import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";
import {
  searchEntities,
  SearchServiceError,
} from "../../../../src/core/services/search-service";

describe("search-service", () => {
  test("searchEntities normalizes query and returns deterministic ordering with limit", async () => {
    const repository = makeInMemoryCoreRepository();

    await Effect.runPromise(
      repository.saveEntity("notification", "notification-1", {
        id: "notification-1",
        type: "approval_required",
        message: "Approval required to sync event",
        status: "pending",
        relatedEntityType: "event",
        relatedEntityId: "event-1",
        createdAt: "2026-02-23T10:00:00.000Z",
        updatedAt: "2026-02-23T12:00:00.000Z",
      }),
    );
    await Effect.runPromise(
      repository.saveEntity("event", "event-2", {
        id: "event-2",
        title: "Approval required kickoff",
        startAt: "2026-02-24T09:00:00.000Z",
        syncState: "local_only",
        createdAt: "2026-02-23T10:00:00.000Z",
        updatedAt: "2026-02-23T11:00:00.000Z",
      }),
    );
    await Effect.runPromise(
      repository.saveEntity("event", "event-1", {
        id: "event-1",
        title: "Approval required prep",
        startAt: "2026-02-24T08:00:00.000Z",
        syncState: "local_only",
        createdAt: "2026-02-23T10:00:00.000Z",
        updatedAt: "2026-02-23T11:00:00.000Z",
      }),
    );
    await Effect.runPromise(
      repository.saveEntity("task", "task-1", {
        id: "task-1",
        title: "Approval required task",
        status: "planned",
        createdAt: "2026-02-23T10:00:00.000Z",
        updatedAt: "2026-02-23T11:00:00.000Z",
      }),
    );

    const results = await Effect.runPromise(
      searchEntities(repository, {
        query: "  APPROVAL   REQUIRED  ",
        limit: 3,
      }),
    );

    expect(results.map((result) => `${result.entityType}:${result.entityId}`)).toEqual([
      "notification:notification-1",
      "event:event-1",
      "event:event-2",
    ]);
    expect(results.map((result) => result.updatedAt)).toEqual([
      "2026-02-23T12:00:00.000Z",
      "2026-02-23T11:00:00.000Z",
      "2026-02-23T11:00:00.000Z",
    ]);
    expect(results.every((result) => result.preview.toLowerCase().includes("approval"))).toBe(
      true,
    );
  });

  test("searchEntities applies entity type filters", async () => {
    const repository = makeInMemoryCoreRepository();

    await Effect.runPromise(
      repository.saveEntity("notification", "notification-filter-1", {
        id: "notification-filter-1",
        type: "approval_required",
        message: "Approval required to sync event",
        status: "pending",
        createdAt: "2026-02-23T10:00:00.000Z",
        updatedAt: "2026-02-23T12:00:00.000Z",
      }),
    );
    await Effect.runPromise(
      repository.saveEntity("task", "task-filter-1", {
        id: "task-filter-1",
        title: "Approval required task",
        status: "planned",
        createdAt: "2026-02-23T10:00:00.000Z",
        updatedAt: "2026-02-23T12:01:00.000Z",
      }),
    );

    const filtered = await Effect.runPromise(
      searchEntities(repository, {
        query: "approval required",
        entityTypes: ["notification"],
      }),
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.entityType).toBe("notification");
    expect(filtered[0]?.entityId).toBe("notification-filter-1");
  });

  test("searchEntities rejects unsupported entity type filters", async () => {
    const repository = makeInMemoryCoreRepository();

    await expect(
      Effect.runPromise(
        searchEntities(repository, {
          query: "approval",
          entityTypes: ["unsupported_entity_type"],
        }),
      ),
    ).rejects.toThrow("unsupported entity type filter: unsupported_entity_type");
  });

  test("searchEntities rejects invalid limits", async () => {
    const repository = makeInMemoryCoreRepository();

    const result = await Effect.runPromise(
      Effect.either(
        searchEntities(repository, {
          query: "approval",
          limit: 0,
        }),
      ),
    );

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      const error = result.left as SearchServiceError;
      expect(error).toMatchObject({
        _tag: "SearchServiceError",
        code: "invalid_request",
      });
      expect(error.message).toContain("limit must be a positive integer");
    }
  });
});

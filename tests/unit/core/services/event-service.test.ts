import { describe, expect, test } from "bun:test";
import { Either, Effect } from "effect";

import { createEvent } from "../../../../src/core/domain/event";
import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";
import { requestEventSync } from "../../../../src/core/services/event-service";

describe("event-service", () => {
  test("requestEventSync sets pending_approval and emits notification", async () => {
    const repository = makeInMemoryCoreRepository();
    const event = await Effect.runPromise(
      createEvent({
        id: "event-1",
        title: "Dentist",
        startAt: new Date("2026-02-25T10:00:00.000Z"),
      }),
    );

    await Effect.runPromise(repository.saveEntity("event", event.id, event));

    const result = await Effect.runPromise(
      requestEventSync(
        repository,
        "event-1",
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T13:00:00.000Z"),
      ),
    );

    const persistedEvent = await Effect.runPromise(
      repository.getEntity("event", "event-1"),
    );
    const persistedNotification = await Effect.runPromise(
      repository.getEntity("notification", result.notification.id),
    );

    expect(result.event.syncState).toBe("pending_approval");
    expect(result.notification.status).toBe("pending");
    expect(persistedEvent).toEqual(result.event);
    expect(persistedNotification).toEqual(result.notification);
  });

  test("requestEventSync classifies non-local_only sync states as conflict", async () => {
    const repository = makeInMemoryCoreRepository();
    const baseEvent = await Effect.runPromise(
      createEvent({
        id: "event-conflict-1",
        title: "Conflict candidate",
        startAt: new Date("2026-02-25T10:00:00.000Z"),
      }),
    );
    await Effect.runPromise(
      repository.saveEntity("event", baseEvent.id, baseEvent),
    );

    await Effect.runPromise(
      requestEventSync(
        repository,
        baseEvent.id,
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T13:00:00.000Z"),
      ),
    );

    const pendingConflict = await Effect.runPromise(
      Effect.either(
        requestEventSync(
          repository,
          baseEvent.id,
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T13:05:00.000Z"),
        ),
      ),
    );
    expect(Either.isLeft(pendingConflict)).toBe(true);
    if (Either.isLeft(pendingConflict)) {
      expect(pendingConflict.left).toMatchObject({
        _tag: "EventServiceError",
        code: "conflict",
      });
    }

    const syncedEvent = {
      ...baseEvent,
      syncState: "synced" as const,
      updatedAt: "2026-02-23T13:10:00.000Z",
    };
    await Effect.runPromise(
      repository.saveEntity("event", syncedEvent.id, syncedEvent),
    );

    const syncedConflict = await Effect.runPromise(
      Effect.either(
        requestEventSync(
          repository,
          syncedEvent.id,
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T13:11:00.000Z"),
        ),
      ),
    );
    expect(Either.isLeft(syncedConflict)).toBe(true);
    if (Either.isLeft(syncedConflict)) {
      expect(syncedConflict.left).toMatchObject({
        _tag: "EventServiceError",
        code: "conflict",
      });
    }
  });
});

import { describe, expect, test } from "bun:test";
import { Either, Effect } from "effect";

import { createEvent } from "../../../../src/core/domain/event";
import { CoreRepository } from "../../../../src/core/repositories/core-repository";
import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";
import {
  createEventInService,
  listEventConflicts,
  listEvents,
  requestEventSync,
  updateEventInService,
} from "../../../../src/core/services/event-service";

describe("event-service", () => {
  test("createEventInService persists a new event and appends an audit transition", async () => {
    const repository = makeInMemoryCoreRepository();
    const at = new Date("2026-02-23T09:00:00.000Z");

    const created = await Effect.runPromise(
      createEventInService(repository, {
        eventId: "event-create-1",
        title: "Created from service",
        startAt: new Date("2026-02-27T10:00:00.000Z"),
        endAt: new Date("2026-02-27T11:00:00.000Z"),
        actor: { id: "user-1", kind: "user" },
        at,
      }),
    );

    const persisted = await Effect.runPromise(
      repository.getEntity("event", "event-create-1"),
    );
    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({
        entityType: "event",
        entityId: "event-create-1",
      }),
    );

    expect(created).toMatchObject({
      id: "event-create-1",
      title: "Created from service",
      syncState: "local_only",
      createdAt: "2026-02-23T09:00:00.000Z",
      updatedAt: "2026-02-23T09:00:00.000Z",
    });
    expect(persisted).toEqual(created);
    expect(auditTrail).toHaveLength(1);
    expect(auditTrail[0]).toMatchObject({
      entityType: "event",
      entityId: "event-create-1",
      fromState: "none",
      toState: "local_only",
      reason: "Event created",
      actor: { id: "user-1", kind: "user" },
      at: "2026-02-23T09:00:00.000Z",
    });
  });

  test("createEventInService returns conflict when eventId already exists", async () => {
    const repository = makeInMemoryCoreRepository();
    const existing = await Effect.runPromise(
      createEvent({
        id: "event-create-conflict-1",
        title: "Existing",
        startAt: new Date("2026-02-27T08:00:00.000Z"),
      }),
    );
    await Effect.runPromise(
      repository.saveEntity("event", existing.id, existing),
    );

    const result = await Effect.runPromise(
      Effect.either(
        createEventInService(repository, {
          eventId: "event-create-conflict-1",
          title: "Duplicate",
          startAt: new Date("2026-02-27T09:00:00.000Z"),
          actor: { id: "user-1", kind: "user" },
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "EventServiceError",
        code: "conflict",
        message: "event event-create-conflict-1 already exists",
      });
    }
  });

  test("updateEventInService updates title/startAt/endAt with deterministic updatedAt", async () => {
    const repository = makeInMemoryCoreRepository();
    const event = await Effect.runPromise(
      createEvent({
        id: "event-update-1",
        title: "Before update",
        startAt: new Date("2026-02-25T10:00:00.000Z"),
        endAt: new Date("2026-02-25T11:00:00.000Z"),
      }),
    );
    await Effect.runPromise(repository.saveEntity("event", event.id, event));

    const updated = await Effect.runPromise(
      updateEventInService(repository, {
        eventId: "event-update-1",
        title: "After update",
        startAt: new Date("2026-02-25T10:30:00.000Z"),
        endAt: null,
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T09:15:00.000Z"),
      }),
    );

    const persisted = await Effect.runPromise(
      repository.getEntity("event", "event-update-1"),
    );
    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({
        entityType: "event",
        entityId: "event-update-1",
      }),
    );

    expect(updated).toMatchObject({
      id: "event-update-1",
      title: "After update",
      startAt: "2026-02-25T10:30:00.000Z",
      endAt: undefined,
      updatedAt: "2026-02-23T09:15:00.000Z",
      syncState: "local_only",
    });
    expect(persisted).toEqual(updated);
    expect(auditTrail).toHaveLength(1);
    expect(auditTrail[0]).toMatchObject({
      fromState: "local_only",
      toState: "local_only",
      reason: "Event updated",
      metadata: { changedFields: "title,startAt,endAt" },
    });
  });

  test("listEvents applies window filters and deterministic sort ordering", async () => {
    const repository = makeInMemoryCoreRepository();

    const event1 = await Effect.runPromise(
      createEvent({
        id: "event-list-1",
        title: "Window overlap 1",
        startAt: new Date("2026-02-25T09:00:00.000Z"),
        endAt: new Date("2026-02-25T10:00:00.000Z"),
        createdAt: new Date("2026-02-23T08:00:00.000Z"),
        updatedAt: new Date("2026-02-23T12:00:00.000Z"),
      }),
    );
    const event2Base = await Effect.runPromise(
      createEvent({
        id: "event-list-2",
        title: "Window overlap 2",
        startAt: new Date("2026-02-25T09:30:00.000Z"),
        createdAt: new Date("2026-02-23T08:10:00.000Z"),
        updatedAt: new Date("2026-02-23T11:00:00.000Z"),
      }),
    );
    const event2 = { ...event2Base, syncState: "pending_approval" as const };
    const event3 = await Effect.runPromise(
      createEvent({
        id: "event-list-3",
        title: "Outside window",
        startAt: new Date("2026-02-25T11:00:00.000Z"),
        createdAt: new Date("2026-02-23T08:20:00.000Z"),
        updatedAt: new Date("2026-02-23T13:00:00.000Z"),
      }),
    );
    const event4Base = await Effect.runPromise(
      createEvent({
        id: "event-list-4",
        title: "Window overlap synced",
        startAt: new Date("2026-02-25T09:45:00.000Z"),
        endAt: new Date("2026-02-25T10:15:00.000Z"),
        createdAt: new Date("2026-02-23T08:30:00.000Z"),
        updatedAt: new Date("2026-02-23T12:30:00.000Z"),
      }),
    );
    const event4 = { ...event4Base, syncState: "synced" as const };

    await Effect.runPromise(
      Effect.all([
        repository.saveEntity("event", event1.id, event1),
        repository.saveEntity("event", event2.id, event2),
        repository.saveEntity("event", event3.id, event3),
        repository.saveEntity("event", event4.id, event4),
      ]),
    );

    const inWindowDesc = await Effect.runPromise(
      listEvents(repository, {
        from: new Date("2026-02-25T09:15:00.000Z"),
        to: new Date("2026-02-25T10:45:00.000Z"),
        sort: "startAt_desc",
      }),
    );

    const localNewest = await Effect.runPromise(
      listEvents(repository, {
        syncState: "local_only",
        sort: "updatedAt_desc",
        limit: 1,
      }),
    );

    expect(inWindowDesc.map((event) => event.id)).toEqual([
      "event-list-4",
      "event-list-2",
      "event-list-1",
    ]);
    expect(localNewest.map((event) => event.id)).toEqual(["event-list-3"]);
  });

  test("listEventConflicts reports deterministic overlaps and supports eventId scoping", async () => {
    const repository = makeInMemoryCoreRepository();

    const eventA = await Effect.runPromise(
      createEvent({
        id: "event-conflict-a",
        title: "A",
        startAt: new Date("2026-02-25T09:00:00.000Z"),
        endAt: new Date("2026-02-25T10:00:00.000Z"),
      }),
    );
    const eventBBase = await Effect.runPromise(
      createEvent({
        id: "event-conflict-b",
        title: "B",
        startAt: new Date("2026-02-25T09:30:00.000Z"),
        endAt: new Date("2026-02-25T10:30:00.000Z"),
      }),
    );
    const eventB = { ...eventBBase, syncState: "pending_approval" as const };
    const eventC = await Effect.runPromise(
      createEvent({
        id: "event-conflict-c",
        title: "C",
        startAt: new Date("2026-02-25T10:00:00.000Z"),
        endAt: new Date("2026-02-25T11:00:00.000Z"),
      }),
    );
    const eventD = await Effect.runPromise(
      createEvent({
        id: "event-conflict-d",
        title: "D",
        startAt: new Date("2026-02-25T09:45:00.000Z"),
      }),
    );
    const eventEBase = await Effect.runPromise(
      createEvent({
        id: "event-conflict-e",
        title: "E",
        startAt: new Date("2026-02-25T09:40:00.000Z"),
        endAt: new Date("2026-02-25T09:50:00.000Z"),
      }),
    );
    const eventE = { ...eventEBase, syncState: "synced" as const };

    await Effect.runPromise(
      Effect.all([
        repository.saveEntity("event", eventA.id, eventA),
        repository.saveEntity("event", eventB.id, eventB),
        repository.saveEntity("event", eventC.id, eventC),
        repository.saveEntity("event", eventD.id, eventD),
        repository.saveEntity("event", eventE.id, eventE),
      ]),
    );

    const allConflicts = await Effect.runPromise(listEventConflicts(repository));
    const scopedConflicts = await Effect.runPromise(
      listEventConflicts(repository, "event-conflict-b"),
    );

    expect(allConflicts).toEqual([
      { eventId: "event-conflict-a", conflictingEventId: "event-conflict-b" },
      { eventId: "event-conflict-a", conflictingEventId: "event-conflict-d" },
      { eventId: "event-conflict-b", conflictingEventId: "event-conflict-c" },
      { eventId: "event-conflict-b", conflictingEventId: "event-conflict-d" },
    ]);
    expect(scopedConflicts).toEqual([
      { eventId: "event-conflict-b", conflictingEventId: "event-conflict-a" },
      { eventId: "event-conflict-b", conflictingEventId: "event-conflict-c" },
      { eventId: "event-conflict-b", conflictingEventId: "event-conflict-d" },
    ]);
  });

  test("listEventConflicts returns not_found for unknown scoped eventId", async () => {
    const repository = makeInMemoryCoreRepository();

    const result = await Effect.runPromise(
      Effect.either(listEventConflicts(repository, "event-missing-404")),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "EventServiceError",
        code: "not_found",
      });
    }
  });

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

  test("requestEventSync rolls back event state when notification persistence fails", async () => {
    const repository = makeInMemoryCoreRepository();
    const event = await Effect.runPromise(
      createEvent({
        id: "event-notification-failure-1",
        title: "Notification failure candidate",
        startAt: new Date("2026-02-25T10:00:00.000Z"),
      }),
    );
    await Effect.runPromise(repository.saveEntity("event", event.id, event));

    const failingRepository: CoreRepository = {
      ...repository,
      saveEntity: (entityType, entityId, entity) => {
        if (entityType === "notification") {
          return Effect.fail(
            new Error("notification persistence unavailable"),
          ).pipe(Effect.orDie);
        }

        return repository.saveEntity(entityType, entityId, entity);
      },
    };

    const result = await Effect.runPromise(
      Effect.either(
        requestEventSync(
          failingRepository,
          event.id,
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T13:00:00.000Z"),
        ),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "EventServiceError",
      });
      expect(result.left.message).toContain(
        "notification persistence unavailable",
      );
    }

    const persistedEvent = await Effect.runPromise(
      repository.getEntity<{ syncState: string }>("event", event.id),
    );
    const notifications = await Effect.runPromise(
      repository.listEntities("notification"),
    );

    expect(persistedEvent?.syncState).toBe("local_only");
    expect(notifications).toHaveLength(0);
  });

  test("requestEventSync rolls back event and notification when audit append fails", async () => {
    const repository = makeInMemoryCoreRepository();
    const event = await Effect.runPromise(
      createEvent({
        id: "event-audit-failure-1",
        title: "Audit failure candidate",
        startAt: new Date("2026-02-25T10:00:00.000Z"),
      }),
    );
    await Effect.runPromise(repository.saveEntity("event", event.id, event));

    const failingRepository: CoreRepository = {
      ...repository,
      appendAuditTransition: (_transition) =>
        Effect.fail(new Error("audit append unavailable")).pipe(Effect.orDie),
    };

    const result = await Effect.runPromise(
      Effect.either(
        requestEventSync(
          failingRepository,
          event.id,
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T13:00:00.000Z"),
        ),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "EventServiceError",
      });
      expect(result.left.message).toContain("audit append unavailable");
    }

    const persistedEvent = await Effect.runPromise(
      repository.getEntity<{ syncState: string }>("event", event.id),
    );
    const notifications = await Effect.runPromise(
      repository.listEntities("notification"),
    );
    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({
        entityType: "event",
        entityId: event.id,
      }),
    );

    expect(persistedEvent?.syncState).toBe("local_only");
    expect(notifications).toHaveLength(0);
    expect(auditTrail).toHaveLength(0);
  });

  test("requestEventSync rollback defects are mapped into EventServiceError", async () => {
    const repository = makeInMemoryCoreRepository();
    const event = await Effect.runPromise(
      createEvent({
        id: "event-rollback-defect-1",
        title: "Rollback defect candidate",
        startAt: new Date("2026-02-25T10:00:00.000Z"),
      }),
    );
    await Effect.runPromise(repository.saveEntity("event", event.id, event));

    const failingRepository: CoreRepository = {
      ...repository,
      appendAuditTransition: (_transition) =>
        Effect.fail(new Error("audit append unavailable")).pipe(Effect.orDie),
      deleteEntity: (entityType, entityId) => {
        if (entityType === "notification") {
          return Effect.fail(
            new Error("rollback notification delete defect"),
          ).pipe(Effect.orDie);
        }
        return repository.deleteEntity(entityType, entityId);
      },
    };

    const result = await Effect.runPromise(
      Effect.either(
        requestEventSync(
          failingRepository,
          event.id,
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T13:00:00.000Z"),
        ),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "EventServiceError",
      });
      expect(result.left.message).toContain("audit append unavailable");
      expect(result.left.message).toContain("rollback notification delete defect");
    }
  });
});

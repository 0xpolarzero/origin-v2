import { describe, expect, test } from "bun:test";
import { Either, Effect } from "effect";

import { Notification } from "../../../../src/core/domain/notification";
import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";
import {
  acknowledgeNotification,
  dismissNotification,
  listNotifications,
} from "../../../../src/core/services/notification-service";

describe("notification-service", () => {
  test("listNotifications filters by status/type/relatedEntity and keeps deterministic ordering", async () => {
    const repository = makeInMemoryCoreRepository();

    const notifications: ReadonlyArray<Notification> = [
      {
        id: "notification-1",
        type: "approval_required",
        message: "Approve event sync",
        status: "pending",
        relatedEntityType: "event",
        relatedEntityId: "event-1",
        createdAt: "2026-02-23T10:00:00.000Z",
        updatedAt: "2026-02-23T10:03:00.000Z",
      },
      {
        id: "notification-2",
        type: "approval_required",
        message: "Approve outbound draft",
        status: "pending",
        relatedEntityType: "event",
        relatedEntityId: "event-2",
        createdAt: "2026-02-23T10:01:00.000Z",
        updatedAt: "2026-02-23T10:03:00.000Z",
      },
      {
        id: "notification-3",
        type: "run_failed",
        message: "Run failed",
        status: "sent",
        relatedEntityType: "job",
        relatedEntityId: "job-1",
        createdAt: "2026-02-23T10:02:00.000Z",
        updatedAt: "2026-02-23T10:04:00.000Z",
      },
      {
        id: "notification-4",
        type: "approval_required",
        message: "Older event reminder",
        status: "dismissed",
        relatedEntityType: "event",
        relatedEntityId: "event-1",
        createdAt: "2026-02-23T09:59:00.000Z",
        updatedAt: "2026-02-23T10:01:00.000Z",
      },
    ];

    for (const notification of notifications) {
      await Effect.runPromise(
        repository.saveEntity("notification", notification.id, notification),
      );
    }

    const pendingEventApprovals = await Effect.runPromise(
      listNotifications(repository, {
        status: "pending",
        type: "approval_required",
        relatedEntity: { entityType: "event" },
      }),
    );
    const eventOne = await Effect.runPromise(
      listNotifications(repository, {
        relatedEntity: { entityType: "event", entityId: "event-1" },
      }),
    );

    expect(pendingEventApprovals.map((notification) => notification.id)).toEqual([
      "notification-1",
      "notification-2",
    ]);
    expect(eventOne.map((notification) => notification.id)).toEqual([
      "notification-1",
      "notification-4",
    ]);
  });

  test("acknowledgeNotification transitions pending->sent and appends audit transition", async () => {
    const repository = makeInMemoryCoreRepository();
    const notification: Notification = {
      id: "notification-ack-1",
      type: "approval_required",
      message: "Approve event sync",
      status: "pending",
      relatedEntityType: "event",
      relatedEntityId: "event-1",
      createdAt: "2026-02-23T10:00:00.000Z",
      updatedAt: "2026-02-23T10:00:00.000Z",
    };
    await Effect.runPromise(
      repository.saveEntity("notification", notification.id, notification),
    );

    const acknowledgedAt = new Date("2026-02-23T10:05:00.000Z");
    const acknowledged = await Effect.runPromise(
      acknowledgeNotification(
        repository,
        notification.id,
        { id: "user-1", kind: "user" },
        acknowledgedAt,
      ),
    );
    const persisted = await Effect.runPromise(
      repository.getEntity<Notification>("notification", notification.id),
    );
    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({
        entityType: "notification",
        entityId: notification.id,
      }),
    );

    expect(acknowledged.status).toBe("sent");
    expect(acknowledged.updatedAt).toBe("2026-02-23T10:05:00.000Z");
    expect(persisted).toEqual(acknowledged);
    expect(auditTrail).toHaveLength(1);
    expect(auditTrail[0]?.fromState).toBe("pending");
    expect(auditTrail[0]?.toState).toBe("sent");
    expect(auditTrail[0]?.actor).toEqual({ id: "user-1", kind: "user" });
  });

  test("acknowledgeNotification rejects missing notification with not_found", async () => {
    const repository = makeInMemoryCoreRepository();

    const result = await Effect.runPromise(
      Effect.either(
        acknowledgeNotification(
          repository,
          "notification-missing",
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T10:05:00.000Z"),
        ),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "NotificationServiceError",
        code: "not_found",
      });
    }
  });

  test("acknowledgeNotification rejects notifications that are not pending", async () => {
    const repository = makeInMemoryCoreRepository();
    const sentNotification: Notification = {
      id: "notification-sent-1",
      type: "run_failed",
      message: "Run failed",
      status: "sent",
      createdAt: "2026-02-23T10:00:00.000Z",
      updatedAt: "2026-02-23T10:01:00.000Z",
    };
    await Effect.runPromise(
      repository.saveEntity("notification", sentNotification.id, sentNotification),
    );

    const result = await Effect.runPromise(
      Effect.either(
        acknowledgeNotification(
          repository,
          sentNotification.id,
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T10:05:00.000Z"),
        ),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "NotificationServiceError",
        code: "conflict",
      });
      expect(result.left.message).toContain("must be pending");
    }
  });

  test("dismissNotification transitions sent->dismissed and appends audit transition", async () => {
    const repository = makeInMemoryCoreRepository();
    const sentNotification: Notification = {
      id: "notification-dismiss-1",
      type: "approval_required",
      message: "Already sent",
      status: "sent",
      createdAt: "2026-02-23T10:00:00.000Z",
      updatedAt: "2026-02-23T10:01:00.000Z",
    };
    await Effect.runPromise(
      repository.saveEntity("notification", sentNotification.id, sentNotification),
    );

    const dismissed = await Effect.runPromise(
      dismissNotification(
        repository,
        sentNotification.id,
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T10:07:00.000Z"),
      ),
    );
    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({
        entityType: "notification",
        entityId: sentNotification.id,
      }),
    );

    expect(dismissed.status).toBe("dismissed");
    expect(auditTrail).toHaveLength(1);
    expect(auditTrail[0]?.fromState).toBe("sent");
    expect(auditTrail[0]?.toState).toBe("dismissed");
  });
});

import { Data, Effect } from "effect";

import { createAuditTransition } from "../domain/audit-transition";
import { ActorRef } from "../domain/common";
import { Notification, NotificationStatus } from "../domain/notification";
import { CoreRepository } from "../repositories/core-repository";

export class NotificationServiceError extends Data.TaggedError(
  "NotificationServiceError",
)<{
  message: string;
  code?: "not_found" | "conflict" | "invalid_request";
}> {}

export interface NotificationRelatedEntityFilter {
  entityType?: string;
  entityId?: string;
}

export interface ListNotificationsInput {
  status?: NotificationStatus;
  type?: string;
  relatedEntity?: NotificationRelatedEntityFilter;
  limit?: number;
}

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const toNotificationServiceError = (
  message: string,
  code?: NotificationServiceError["code"],
): NotificationServiceError =>
  new NotificationServiceError({
    message,
    code,
  });

const sortNotifications = (
  notifications: ReadonlyArray<Notification>,
): Array<Notification> =>
  [...notifications].sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) ||
      left.id.localeCompare(right.id),
  );

const mapRepositoryError = (action: string) => (error: unknown) =>
  toNotificationServiceError(`${action}: ${toErrorMessage(error)}`);

const loadNotification = (
  repository: CoreRepository,
  notificationId: string,
): Effect.Effect<Notification, NotificationServiceError> =>
  Effect.gen(function* () {
    const notification = yield* repository
      .getEntity<Notification>("notification", notificationId)
      .pipe(
        Effect.mapError(
          mapRepositoryError(`failed to load notification ${notificationId}`),
        ),
      );

    if (!notification) {
      return yield* Effect.fail(
        toNotificationServiceError(
          `notification ${notificationId} was not found`,
          "not_found",
        ),
      );
    }

    return notification;
  });

const transitionNotification = (
  repository: CoreRepository,
  notification: Notification,
  toStatus: NotificationStatus,
  reason: string,
  actor: ActorRef,
  at: Date,
): Effect.Effect<Notification, NotificationServiceError> =>
  Effect.gen(function* () {
    const updated: Notification = {
      ...notification,
      status: toStatus,
      updatedAt: at.toISOString(),
    };

    const transition = yield* createAuditTransition({
      entityType: "notification",
      entityId: notification.id,
      fromState: notification.status,
      toState: toStatus,
      actor,
      reason,
      at,
      metadata: {
        notificationType: notification.type,
      },
    }).pipe(
      Effect.mapError((error) =>
        toNotificationServiceError(
          `failed to create notification transition: ${error.message}`,
        ),
      ),
    );

    yield* repository.withTransaction(
      Effect.gen(function* () {
        yield* repository
          .saveEntity("notification", updated.id, updated)
          .pipe(
            Effect.mapError(
              mapRepositoryError(
                `failed to persist notification ${updated.id} status change`,
              ),
            ),
          );

        yield* repository.appendAuditTransition(transition).pipe(
          Effect.mapError(
            mapRepositoryError(
              `failed to append notification transition for ${updated.id}`,
            ),
          ),
        );
      }),
    );

    return updated;
  });

export const listNotifications = (
  repository: CoreRepository,
  input: ListNotificationsInput = {},
): Effect.Effect<ReadonlyArray<Notification>, NotificationServiceError> =>
  Effect.gen(function* () {
    if (
      input.limit !== undefined &&
      (!Number.isInteger(input.limit) || input.limit <= 0)
    ) {
      return yield* Effect.fail(
        toNotificationServiceError(
          "limit must be a positive integer",
          "invalid_request",
        ),
      );
    }

    const notifications = yield* repository
      .listEntities<Notification>("notification")
      .pipe(
        Effect.mapError(
          mapRepositoryError("failed to list notification entities"),
        ),
      );

    const filtered = sortNotifications(notifications)
      .filter((notification) =>
        input.status === undefined ? true : notification.status === input.status,
      )
      .filter((notification) =>
        input.type === undefined ? true : notification.type === input.type,
      )
      .filter((notification) =>
        input.relatedEntity?.entityType === undefined
          ? true
          : notification.relatedEntityType === input.relatedEntity.entityType,
      )
      .filter((notification) =>
        input.relatedEntity?.entityId === undefined
          ? true
          : notification.relatedEntityId === input.relatedEntity.entityId,
      );

    if (input.limit === undefined) {
      return filtered;
    }

    return filtered.slice(0, input.limit);
  });

export const acknowledgeNotification = (
  repository: CoreRepository,
  notificationId: string,
  actor: ActorRef,
  at: Date = new Date(),
): Effect.Effect<Notification, NotificationServiceError> =>
  Effect.gen(function* () {
    const notification = yield* loadNotification(repository, notificationId);

    if (notification.status !== "pending") {
      return yield* Effect.fail(
        toNotificationServiceError(
          `notification ${notification.id} must be pending before acknowledgement`,
          "conflict",
        ),
      );
    }

    return yield* transitionNotification(
      repository,
      notification,
      "sent",
      "Notification acknowledged",
      actor,
      at,
    );
  });

export const dismissNotification = (
  repository: CoreRepository,
  notificationId: string,
  actor: ActorRef,
  at: Date = new Date(),
): Effect.Effect<Notification, NotificationServiceError> =>
  Effect.gen(function* () {
    const notification = yield* loadNotification(repository, notificationId);

    if (notification.status === "dismissed") {
      return yield* Effect.fail(
        toNotificationServiceError(
          `notification ${notification.id} is already dismissed`,
          "conflict",
        ),
      );
    }

    return yield* transitionNotification(
      repository,
      notification,
      "dismissed",
      "Notification dismissed",
      actor,
      at,
    );
  });

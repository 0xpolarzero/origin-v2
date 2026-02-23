import { Data, Effect, Either } from "effect";

import { createAuditTransition } from "../domain/audit-transition";
import { ActorRef } from "../domain/common";
import { Event } from "../domain/event";
import { createNotification, Notification } from "../domain/notification";
import { CoreRepository } from "../repositories/core-repository";

export class EventServiceError extends Data.TaggedError("EventServiceError")<{
  message: string;
  code?: "conflict" | "not_found" | "invalid_request";
}> {}

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const requestEventSync = (
  repository: CoreRepository,
  eventId: string,
  actor: ActorRef,
  at: Date = new Date(),
): Effect.Effect<
  { event: Event; notification: Notification },
  EventServiceError
> =>
  Effect.gen(function* () {
    const event = yield* repository.getEntity<Event>("event", eventId).pipe(
      Effect.mapError(
        (error) =>
          new EventServiceError({
            message: `failed to load event ${eventId}: ${toErrorMessage(error)}`,
          }),
      ),
    );

    if (!event) {
      return yield* Effect.fail(
        new EventServiceError({
          message: `event ${eventId} was not found`,
          code: "not_found",
        }),
      );
    }

    if (event.syncState !== "local_only") {
      return yield* Effect.fail(
        new EventServiceError({
          message: `event ${event.id} must be local_only before requesting sync`,
          code: "conflict",
        }),
      );
    }

    const atIso = at.toISOString();

    const updatedEvent: Event = {
      ...event,
      syncState: "pending_approval",
      updatedAt: atIso,
    };

    const notification = yield* createNotification({
      type: "approval_required",
      message: `Approval required to sync event ${event.id}`,
      relatedEntityType: "event",
      relatedEntityId: event.id,
      createdAt: at,
      updatedAt: at,
    }).pipe(
      Effect.mapError(
        (error) =>
          new EventServiceError({
            message: `failed to create approval notification: ${error.message}`,
          }),
      ),
    );

    const transition = yield* createAuditTransition({
      entityType: "event",
      entityId: updatedEvent.id,
      fromState: event.syncState,
      toState: updatedEvent.syncState,
      actor,
      reason: "Event sync requested",
      at,
      metadata: {
        notificationId: notification.id,
      },
    }).pipe(
      Effect.mapError(
        (error) =>
          new EventServiceError({
            message: `failed to append event sync transition: ${error.message}`,
          }),
      ),
    );

    let eventSaved = false;
    let notificationSaved = false;

    yield* Effect.gen(function* () {
      yield* repository
        .saveEntity("event", updatedEvent.id, updatedEvent)
        .pipe(
          Effect.mapError(
            (error) =>
              new EventServiceError({
                message: `failed to persist event sync request: ${toErrorMessage(error)}`,
              }),
          ),
        );
      eventSaved = true;

      yield* repository
        .saveEntity("notification", notification.id, notification)
        .pipe(
          Effect.mapError(
            (error) =>
              new EventServiceError({
                message: `failed to persist approval notification: ${toErrorMessage(error)}`,
              }),
          ),
        );
      notificationSaved = true;

      yield* repository.appendAuditTransition(transition).pipe(
        Effect.mapError(
          (error) =>
            new EventServiceError({
              message: `failed to append event sync transition: ${toErrorMessage(error)}`,
            }),
        ),
      );
    }).pipe(
      Effect.catchAllDefect((defect) =>
        Effect.fail(
          new EventServiceError({
            message: toErrorMessage(defect),
          }),
        ),
      ),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          const rollbackErrors: Array<string> = [];

          if (eventSaved) {
            const rollbackEventResult = yield* Effect.either(
              repository.saveEntity("event", event.id, event),
            );

            if (Either.isLeft(rollbackEventResult)) {
              rollbackErrors.push(
                `failed to rollback event sync request: ${toErrorMessage(rollbackEventResult.left)}`,
              );
            }
          }

          if (notificationSaved) {
            const rollbackNotificationResult = yield* Effect.either(
              repository.deleteEntity("notification", notification.id),
            );

            if (Either.isLeft(rollbackNotificationResult)) {
              rollbackErrors.push(
                `failed to rollback approval notification: ${toErrorMessage(rollbackNotificationResult.left)}`,
              );
            }
          }

          if (rollbackErrors.length > 0) {
            return yield* Effect.fail(
              new EventServiceError({
                message: `${error.message}; ${rollbackErrors.join("; ")}`,
              }),
            );
          }

          return yield* Effect.fail(error);
        }),
      ),
    );

    return {
      event: updatedEvent,
      notification,
    };
  });

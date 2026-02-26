import { Data, Effect } from "effect";

import { createAuditTransition } from "../domain/audit-transition";
import { ActorRef } from "../domain/common";
import { Event } from "../domain/event";
import { createNotification, Notification } from "../domain/notification";
import { CoreRepository } from "../repositories/core-repository";

export class EventServiceError extends Data.TaggedError("EventServiceError")<{
  message: string;
}> {}

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
    const event = yield* repository.getEntity<Event>("event", eventId);

    if (!event) {
      return yield* Effect.fail(
        new EventServiceError({ message: `event ${eventId} was not found` }),
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

    yield* repository.saveEntity("event", updatedEvent.id, updatedEvent);
    yield* repository.saveEntity("notification", notification.id, notification);

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

    yield* repository.appendAuditTransition(transition);

    return {
      event: updatedEvent,
      notification,
    };
  });

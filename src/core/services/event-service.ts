import { Data, Effect, Either } from "effect";

import { createAuditTransition } from "../domain/audit-transition";
import { ActorRef } from "../domain/common";
import { createEvent, Event } from "../domain/event";
import { createNotification, Notification } from "../domain/notification";
import { CoreRepository } from "../repositories/core-repository";

export class EventServiceError extends Data.TaggedError("EventServiceError")<{
  message: string;
  code?: "conflict" | "not_found" | "invalid_request";
}> {}

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isLocalEvent = (event: Event): boolean => event.syncState !== "synced";

interface EventRange {
  startMs: number;
  endMs: number;
}

const parseEventRange = (event: Event): EventRange | undefined => {
  const startMs = Date.parse(event.startAt);
  if (Number.isNaN(startMs)) {
    return undefined;
  }

  const rawEndMs = event.endAt ? Date.parse(event.endAt) : startMs;
  if (Number.isNaN(rawEndMs)) {
    return undefined;
  }
  if (rawEndMs < startMs) {
    return undefined;
  }

  return {
    startMs,
    endMs: rawEndMs === startMs ? startMs + 1 : rawEndMs,
  };
};

const eventsOverlap = (left: Event, right: Event): boolean => {
  const leftRange = parseEventRange(left);
  const rightRange = parseEventRange(right);
  if (!leftRange || !rightRange) {
    return false;
  }

  return (
    leftRange.startMs < rightRange.endMs && rightRange.startMs < leftRange.endMs
  );
};

const validateEventWindow = (
  startAt: Date,
  endAt?: Date,
): Effect.Effect<void, EventServiceError> => {
  if (endAt && endAt.getTime() < startAt.getTime()) {
    return Effect.fail(
      new EventServiceError({
        message: "endAt must be greater than or equal to startAt",
        code: "invalid_request",
      }),
    );
  }

  return Effect.void;
};

export interface CreateEventInServiceInput {
  eventId?: string;
  title: string;
  startAt: Date;
  endAt?: Date;
  actor: ActorRef;
  at?: Date;
}

export interface UpdateEventInServiceInput {
  eventId: string;
  title?: string;
  startAt?: Date;
  endAt?: Date | null;
  actor: ActorRef;
  at?: Date;
}

export type ListEventsSort =
  | "startAt_asc"
  | "startAt_desc"
  | "updatedAt_asc"
  | "updatedAt_desc";

export interface ListEventsInput {
  from?: Date;
  to?: Date;
  syncState?: Event["syncState"];
  sort?: ListEventsSort;
  limit?: number;
}

export interface EventConflict {
  eventId: string;
  conflictingEventId: string;
}

export const createEventInService = (
  repository: CoreRepository,
  input: CreateEventInServiceInput,
): Effect.Effect<Event, EventServiceError> =>
  Effect.gen(function* () {
    if (input.eventId) {
      const existing = yield* repository.getEntity<Event>("event", input.eventId).pipe(
        Effect.mapError(
          (error) =>
            new EventServiceError({
              message: `failed to load event ${input.eventId}: ${toErrorMessage(error)}`,
            }),
        ),
      );

      if (existing) {
        return yield* Effect.fail(
          new EventServiceError({
            message: `event ${input.eventId} already exists`,
            code: "conflict",
          }),
        );
      }
    }

    const at = input.at ?? new Date();
    yield* validateEventWindow(input.startAt, input.endAt);

    const event = yield* createEvent({
      id: input.eventId,
      title: input.title,
      startAt: input.startAt,
      endAt: input.endAt,
      createdAt: at,
      updatedAt: at,
    }).pipe(
      Effect.mapError(
        (error) =>
          new EventServiceError({
            message: `failed to create event: ${error.message}`,
            code: "invalid_request",
          }),
      ),
    );

    yield* repository.saveEntity("event", event.id, event).pipe(
      Effect.mapError(
        (error) =>
          new EventServiceError({
            message: `failed to persist event ${event.id}: ${toErrorMessage(error)}`,
          }),
      ),
    );

    const transition = yield* createAuditTransition({
      entityType: "event",
      entityId: event.id,
      fromState: "none",
      toState: event.syncState,
      actor: input.actor,
      reason: "Event created",
      at,
    }).pipe(
      Effect.mapError(
        (error) =>
          new EventServiceError({
            message: `failed to append event create transition: ${error.message}`,
          }),
      ),
    );

    yield* repository.appendAuditTransition(transition).pipe(
      Effect.mapError(
        (error) =>
          new EventServiceError({
            message: `failed to append event create transition: ${toErrorMessage(error)}`,
          }),
      ),
    );

    return event;
  });

export const updateEventInService = (
  repository: CoreRepository,
  input: UpdateEventInServiceInput,
): Effect.Effect<Event, EventServiceError> =>
  Effect.gen(function* () {
    const event = yield* repository.getEntity<Event>("event", input.eventId).pipe(
      Effect.mapError(
        (error) =>
          new EventServiceError({
            message: `failed to load event ${input.eventId}: ${toErrorMessage(error)}`,
          }),
      ),
    );

    if (!event) {
      return yield* Effect.fail(
        new EventServiceError({
          message: `event ${input.eventId} was not found`,
          code: "not_found",
        }),
      );
    }

    const hasEndAtUpdate = Object.prototype.hasOwnProperty.call(input, "endAt");
    const hasAnyUpdates =
      input.title !== undefined || input.startAt !== undefined || hasEndAtUpdate;

    if (!hasAnyUpdates) {
      return yield* Effect.fail(
        new EventServiceError({
          message: "at least one field must be provided for update",
          code: "invalid_request",
        }),
      );
    }

    if (input.title !== undefined && input.title.trim() === "") {
      return yield* Effect.fail(
        new EventServiceError({
          message: "title is required",
          code: "invalid_request",
        }),
      );
    }

    const startAt = input.startAt ?? new Date(event.startAt);
    if (Number.isNaN(startAt.getTime())) {
      return yield* Effect.fail(
        new EventServiceError({
          message: `event ${event.id} has invalid startAt timestamp`,
          code: "invalid_request",
        }),
      );
    }

    const resolvedEndAt: Date | undefined = hasEndAtUpdate
      ? input.endAt ?? undefined
      : event.endAt
        ? new Date(event.endAt)
        : undefined;

    if (resolvedEndAt && Number.isNaN(resolvedEndAt.getTime())) {
      return yield* Effect.fail(
        new EventServiceError({
          message: `event ${event.id} has invalid endAt timestamp`,
          code: "invalid_request",
        }),
      );
    }

    yield* validateEventWindow(startAt, resolvedEndAt);

    const at = input.at ?? new Date();
    const updatedEvent: Event = {
      ...event,
      title: input.title ?? event.title,
      startAt: startAt.toISOString(),
      endAt: resolvedEndAt?.toISOString(),
      updatedAt: at.toISOString(),
    };

    const changedFields: Array<string> = [];
    if (input.title !== undefined && updatedEvent.title !== event.title) {
      changedFields.push("title");
    }
    if (input.startAt !== undefined && updatedEvent.startAt !== event.startAt) {
      changedFields.push("startAt");
    }
    if (hasEndAtUpdate && updatedEvent.endAt !== event.endAt) {
      changedFields.push("endAt");
    }

    yield* repository.saveEntity("event", updatedEvent.id, updatedEvent).pipe(
      Effect.mapError(
        (error) =>
          new EventServiceError({
            message: `failed to persist event update: ${toErrorMessage(error)}`,
          }),
      ),
    );

    const transition = yield* createAuditTransition({
      entityType: "event",
      entityId: updatedEvent.id,
      fromState: event.syncState,
      toState: updatedEvent.syncState,
      actor: input.actor,
      reason: "Event updated",
      at,
      metadata: {
        changedFields:
          changedFields.length > 0 ? changedFields.join(",") : "none",
      },
    }).pipe(
      Effect.mapError(
        (error) =>
          new EventServiceError({
            message: `failed to append event update transition: ${error.message}`,
          }),
      ),
    );

    yield* repository.appendAuditTransition(transition).pipe(
      Effect.mapError(
        (error) =>
          new EventServiceError({
            message: `failed to append event update transition: ${toErrorMessage(error)}`,
          }),
      ),
    );

    return updatedEvent;
  });

export const listEvents = (
  repository: CoreRepository,
  input: ListEventsInput = {},
): Effect.Effect<ReadonlyArray<Event>, EventServiceError> =>
  Effect.gen(function* () {
    if (
      input.limit !== undefined &&
      (!Number.isInteger(input.limit) || input.limit <= 0)
    ) {
      return yield* Effect.fail(
        new EventServiceError({
          message: "limit must be a positive integer",
          code: "invalid_request",
        }),
      );
    }

    if (input.from && input.to && input.from.getTime() > input.to.getTime()) {
      return yield* Effect.fail(
        new EventServiceError({
          message: "from must be less than or equal to to",
          code: "invalid_request",
        }),
      );
    }

    const fromMs = input.from?.getTime();
    const toMs = input.to?.getTime();
    const sort = input.sort ?? "startAt_asc";

    const events = yield* repository.listEntities<Event>("event").pipe(
      Effect.mapError(
        (error) =>
          new EventServiceError({
            message: `failed to list events: ${toErrorMessage(error)}`,
          }),
      ),
    );

    const filtered = events
      .filter((event) =>
        input.syncState === undefined ? true : event.syncState === input.syncState,
      )
      .filter((event) => {
        const range = parseEventRange(event);
        if (!range) {
          return false;
        }
        if (fromMs !== undefined && range.endMs <= fromMs) {
          return false;
        }
        if (toMs !== undefined && range.startMs >= toMs) {
          return false;
        }
        return true;
      })
      .sort((left, right) => {
        const byStartAtAsc = left.startAt.localeCompare(right.startAt);
        const byUpdatedAtAsc = left.updatedAt.localeCompare(right.updatedAt);
        switch (sort) {
          case "startAt_desc":
            return (
              right.startAt.localeCompare(left.startAt) ||
              right.updatedAt.localeCompare(left.updatedAt) ||
              left.id.localeCompare(right.id)
            );
          case "updatedAt_asc":
            return (
              byUpdatedAtAsc ||
              byStartAtAsc ||
              left.id.localeCompare(right.id)
            );
          case "updatedAt_desc":
            return (
              right.updatedAt.localeCompare(left.updatedAt) ||
              right.startAt.localeCompare(left.startAt) ||
              left.id.localeCompare(right.id)
            );
          case "startAt_asc":
          default:
            return byStartAtAsc || byUpdatedAtAsc || left.id.localeCompare(right.id);
        }
      });

    if (input.limit === undefined) {
      return filtered;
    }

    return filtered.slice(0, input.limit);
  });

export const listEventConflicts = (
  repository: CoreRepository,
  eventId?: string,
): Effect.Effect<ReadonlyArray<EventConflict>, EventServiceError> =>
  Effect.gen(function* () {
    if (eventId !== undefined && eventId.trim() === "") {
      return yield* Effect.fail(
        new EventServiceError({
          message: "eventId is required",
          code: "invalid_request",
        }),
      );
    }

    const events = yield* repository.listEntities<Event>("event").pipe(
      Effect.mapError(
        (error) =>
          new EventServiceError({
            message: `failed to list events for conflict detection: ${toErrorMessage(error)}`,
          }),
      ),
    );

    const localEvents = events
      .filter(isLocalEvent)
      .sort(
        (left, right) =>
          left.startAt.localeCompare(right.startAt) ||
          left.updatedAt.localeCompare(right.updatedAt) ||
          left.id.localeCompare(right.id),
      );

    if (eventId !== undefined) {
      const target = events.find((event) => event.id === eventId);

      if (!target) {
        return yield* Effect.fail(
          new EventServiceError({
            message: `event ${eventId} was not found`,
            code: "not_found",
          }),
        );
      }

      if (!isLocalEvent(target)) {
        return [];
      }

      return localEvents
        .filter((event) => event.id !== target.id)
        .filter((event) => eventsOverlap(target, event))
        .map((event): EventConflict => ({
          eventId: target.id,
          conflictingEventId: event.id,
        }))
        .sort((left, right) =>
          left.conflictingEventId.localeCompare(right.conflictingEventId),
        );
    }

    const conflicts: Array<EventConflict> = [];
    for (let index = 0; index < localEvents.length; index += 1) {
      const left = localEvents[index];
      for (
        let rightIndex = index + 1;
        rightIndex < localEvents.length;
        rightIndex += 1
      ) {
        const right = localEvents[rightIndex];
        if (!eventsOverlap(left, right)) {
          continue;
        }
        conflicts.push({
          eventId: left.id,
          conflictingEventId: right.id,
        });
      }
    }

    return conflicts.sort(
      (left, right) =>
        left.eventId.localeCompare(right.eventId) ||
        left.conflictingEventId.localeCompare(right.conflictingEventId),
    );
  });

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
              repository
                .saveEntity("event", event.id, event)
                .pipe(
                  Effect.catchAllDefect((defect) =>
                    Effect.fail(
                      new EventServiceError({
                        message: `failed to rollback event sync request: ${toErrorMessage(defect)}`,
                      }),
                    ),
                  ),
                ),
            );

            if (Either.isLeft(rollbackEventResult)) {
              rollbackErrors.push(toErrorMessage(rollbackEventResult.left));
            }
          }

          if (notificationSaved) {
            const rollbackNotificationResult = yield* Effect.either(
              repository
                .deleteEntity("notification", notification.id)
                .pipe(
                  Effect.catchAllDefect((defect) =>
                    Effect.fail(
                      new EventServiceError({
                        message: `failed to rollback approval notification: ${toErrorMessage(defect)}`,
                      }),
                    ),
                  ),
                ),
            );

            if (Either.isLeft(rollbackNotificationResult)) {
              rollbackErrors.push(toErrorMessage(rollbackNotificationResult.left));
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

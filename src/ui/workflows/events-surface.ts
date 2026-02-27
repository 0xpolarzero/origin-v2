import { Data, Effect } from "effect";

import { Event } from "../../core/domain/event";
import { WorkflowSurfaceCorePort } from "./workflow-surface-core-port";

export class EventsSurfaceError extends Data.TaggedError("EventsSurfaceError")<{
  message: string;
  cause?: unknown;
}> {}

export interface EventsSurfaceFilters {
  syncState?: Event["syncState"];
  from?: Date;
  to?: Date;
  limit?: number;
}

export interface EventsSurfaceState {
  events: ReadonlyArray<Event>;
  pendingApprovalCount: number;
  filters: EventsSurfaceFilters;
}

const toEventsSurfaceError = (error: unknown): EventsSurfaceError =>
  new EventsSurfaceError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  });

const inDateRange = (iso: string, from?: Date, to?: Date): boolean => {
  const millis = Date.parse(iso);
  if (Number.isNaN(millis)) {
    return false;
  }

  if (from && millis < from.getTime()) {
    return false;
  }

  if (to && millis > to.getTime()) {
    return false;
  }

  return true;
};

export const loadEventsSurface = (
  port: WorkflowSurfaceCorePort,
  input: EventsSurfaceFilters = {},
): Effect.Effect<EventsSurfaceState, EventsSurfaceError> =>
  port
    .listEntities<Event>("event")
    .pipe(
      Effect.map((eventsRaw) => {
        const filtered = eventsRaw
          .filter((event) =>
            input.syncState ? event.syncState === input.syncState : true,
          )
          .filter((event) => inDateRange(event.startAt, input.from, input.to))
          .sort((left, right) => left.startAt.localeCompare(right.startAt));

        const events =
          input.limit && Number.isInteger(input.limit) && input.limit > 0
            ? filtered.slice(0, input.limit)
            : filtered;

        return {
          events,
          pendingApprovalCount: filtered.filter(
            (event) => event.syncState === "pending_approval",
          ).length,
          filters: { ...input },
        };
      }),
      Effect.mapError(toEventsSurfaceError),
    );

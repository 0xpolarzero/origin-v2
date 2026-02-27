import { Data, Effect } from "effect";

import { Event } from "../../core/domain/event";
import { Task } from "../../core/domain/task";
import { WorkflowSurfaceCorePort } from "./workflow-surface-core-port";

export class PlanSurfaceError extends Data.TaggedError("PlanSurfaceError")<{
  message: string;
  cause?: unknown;
}> {}

export interface PlanSurfaceFilters {
  taskStatuses?: ReadonlyArray<Task["status"]>;
  eventSyncStates?: ReadonlyArray<Event["syncState"]>;
  from?: Date;
  to?: Date;
  limit?: number;
}

export interface PlanTimelineItem {
  kind: "task" | "event";
  id: string;
  at: string;
  task?: Task;
  event?: Event;
}

export interface PlanSurfaceState {
  tasks: ReadonlyArray<Task>;
  events: ReadonlyArray<Event>;
  timeline: ReadonlyArray<PlanTimelineItem>;
  filters: PlanSurfaceFilters;
}

const toPlanSurfaceError = (error: unknown): PlanSurfaceError =>
  new PlanSurfaceError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  });

const toMillis = (iso: string | undefined): number => {
  if (!iso) {
    return Number.POSITIVE_INFINITY;
  }

  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
};

const inDateRange = (
  at: string | undefined,
  from: Date | undefined,
  to: Date | undefined,
): boolean => {
  if (!from && !to) {
    return true;
  }

  const millis = toMillis(at);
  if (!Number.isFinite(millis)) {
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

const taskTime = (task: Task): string => task.scheduledFor ?? task.dueAt ?? task.updatedAt;

export const loadPlanSurface = (
  port: WorkflowSurfaceCorePort,
  input: PlanSurfaceFilters = {},
): Effect.Effect<PlanSurfaceState, PlanSurfaceError> =>
  Effect.gen(function* () {
    const entities = yield* Effect.all({
      tasks: port.listEntities<Task>("task"),
      events: port.listEntities<Event>("event"),
    });

    const tasks = entities.tasks
      .filter((task) =>
        input.taskStatuses ? input.taskStatuses.includes(task.status) : true,
      )
      .filter((task) => inDateRange(taskTime(task), input.from, input.to));
    const events = entities.events
      .filter((event) =>
        input.eventSyncStates ? input.eventSyncStates.includes(event.syncState) : true,
      )
      .filter((event) => inDateRange(event.startAt, input.from, input.to));

    const timeline = [
      ...tasks.map(
        (task): PlanTimelineItem => ({
          kind: "task",
          id: task.id,
          at: taskTime(task),
          task,
        }),
      ),
      ...events.map(
        (event): PlanTimelineItem => ({
          kind: "event",
          id: event.id,
          at: event.startAt,
          event,
        }),
      ),
    ].sort(
      (left, right) =>
        toMillis(left.at) - toMillis(right.at) ||
        left.kind.localeCompare(right.kind) ||
        left.id.localeCompare(right.id),
    );

    const boundedTimeline =
      input.limit && Number.isInteger(input.limit) && input.limit > 0
        ? timeline.slice(0, input.limit)
        : timeline;

    return {
      tasks,
      events,
      timeline: boundedTimeline,
      filters: {
        ...input,
        taskStatuses: input.taskStatuses ? [...input.taskStatuses] : undefined,
        eventSyncStates: input.eventSyncStates ? [...input.eventSyncStates] : undefined,
      },
    };
  }).pipe(Effect.mapError(toPlanSurfaceError));

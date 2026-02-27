import { Data, Effect } from "effect";

import { Task } from "../../core/domain/task";
import { WorkflowSurfaceCorePort } from "./workflow-surface-core-port";

export class TasksSurfaceError extends Data.TaggedError("TasksSurfaceError")<{
  message: string;
  cause?: unknown;
}> {}

export interface TasksSurfaceFilters {
  status?: Task["status"];
  projectId?: string;
  sourceEntryId?: string;
  limit?: number;
}

export interface TasksSurfaceState {
  tasks: ReadonlyArray<Task>;
  filters: TasksSurfaceFilters;
}

const toTasksSurfaceError = (error: unknown): TasksSurfaceError =>
  new TasksSurfaceError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  });

export const loadTasksSurface = (
  port: WorkflowSurfaceCorePort,
  input: TasksSurfaceFilters = {},
): Effect.Effect<TasksSurfaceState, TasksSurfaceError> =>
  port
    .listEntities<Task>("task")
    .pipe(
      Effect.map((tasksRaw) => {
        const filtered = tasksRaw
          .filter((task) => (input.status ? task.status === input.status : true))
          .filter((task) => (input.projectId ? task.projectId === input.projectId : true))
          .filter((task) =>
            input.sourceEntryId ? task.sourceEntryId === input.sourceEntryId : true,
          )
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

        const tasks =
          input.limit && Number.isInteger(input.limit) && input.limit > 0
            ? filtered.slice(0, input.limit)
            : filtered;

        return {
          tasks,
          filters: { ...input },
        };
      }),
      Effect.mapError(toTasksSurfaceError),
    );

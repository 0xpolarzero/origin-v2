import { Data, Effect } from "effect";

import { Project } from "../../core/domain/project";
import { Task } from "../../core/domain/task";
import { WorkflowSurfaceCorePort } from "./workflow-surface-core-port";

export class ProjectsSurfaceError extends Data.TaggedError("ProjectsSurfaceError")<{
  message: string;
  cause?: unknown;
}> {}

export interface ProjectsSurfaceFilters {
  lifecycle?: Project["lifecycle"];
  includeTaskCounts?: boolean;
  limit?: number;
}

export interface ProjectSurfaceItem {
  project: Project;
  taskCount?: number;
}

export interface ProjectsSurfaceState {
  projects: ReadonlyArray<ProjectSurfaceItem>;
  filters: ProjectsSurfaceFilters;
}

const toProjectsSurfaceError = (error: unknown): ProjectsSurfaceError =>
  new ProjectsSurfaceError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  });

export const loadProjectsSurface = (
  port: WorkflowSurfaceCorePort,
  input: ProjectsSurfaceFilters = {},
): Effect.Effect<ProjectsSurfaceState, ProjectsSurfaceError> =>
  Effect.gen(function* () {
    const includeTaskCounts = input.includeTaskCounts ?? true;
    const [projectsRaw, tasksRaw] = yield* Effect.all([
      port.listEntities<Project>("project"),
      includeTaskCounts ? port.listEntities<Task>("task") : Effect.succeed([]),
    ]);

    const filteredProjects = projectsRaw
      .filter((project) => (input.lifecycle ? project.lifecycle === input.lifecycle : true))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const projects = filteredProjects.map((project) => ({
      project,
      taskCount: includeTaskCounts
        ? tasksRaw.filter((task) => task.projectId === project.id).length
        : undefined,
    }));

    const limitedProjects =
      input.limit && Number.isInteger(input.limit) && input.limit > 0
        ? projects.slice(0, input.limit)
        : projects;

    return {
      projects: limitedProjects,
      filters: {
        ...input,
        includeTaskCounts,
      },
    };
  }).pipe(Effect.mapError(toProjectsSurfaceError));

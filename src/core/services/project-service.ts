import { Data, Effect } from "effect";

import { createAuditTransition } from "../domain/audit-transition";
import { ActorRef, validateNonEmpty } from "../domain/common";
import {
  createProject,
  Project,
  ProjectLifecycle,
} from "../domain/project";
import { CoreRepository } from "../repositories/core-repository";

export class ProjectServiceError extends Data.TaggedError(
  "ProjectServiceError",
)<{
  message: string;
  code?: "not_found" | "conflict" | "invalid_request";
}> {}

export interface CreateProjectInServiceInput {
  projectId?: string;
  name: string;
  description?: string;
  actor: ActorRef;
  at?: Date;
}

export interface UpdateProjectInServiceInput {
  projectId: string;
  name?: string;
  description?: string;
  actor: ActorRef;
  at?: Date;
}

export interface ListProjectsInput {
  lifecycle?: ProjectLifecycle;
}

const sortProjectsDeterministically = (
  projects: ReadonlyArray<Project>,
): ReadonlyArray<Project> =>
  [...projects].sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) ||
      right.createdAt.localeCompare(left.createdAt) ||
      right.id.localeCompare(left.id),
  );

const loadProject = (
  repository: CoreRepository,
  projectId: string,
): Effect.Effect<Project, ProjectServiceError> =>
  Effect.gen(function* () {
    const project = yield* repository.getEntity<Project>("project", projectId);
    if (!project) {
      return yield* Effect.fail(
        new ProjectServiceError({
          message: `project ${projectId} was not found`,
          code: "not_found",
        }),
      );
    }
    return project;
  });

const validateProjectName = (
  name: string,
): Effect.Effect<void, ProjectServiceError> =>
  Effect.gen(function* () {
    const nameError = validateNonEmpty(name, "name");
    if (nameError) {
      return yield* Effect.fail(
        new ProjectServiceError({
          message: `failed to update project: ${nameError.message}`,
          code: "invalid_request",
        }),
      );
    }
  });

export const createProjectInService = (
  repository: CoreRepository,
  input: CreateProjectInServiceInput,
): Effect.Effect<Project, ProjectServiceError> =>
  repository.withTransaction(
    Effect.gen(function* () {
      if (input.projectId) {
        const existing = yield* repository.getEntity<Project>(
          "project",
          input.projectId,
        );
        if (existing) {
          return yield* Effect.fail(
            new ProjectServiceError({
              message: `project ${input.projectId} already exists`,
              code: "conflict",
            }),
          );
        }
      }

      const at = input.at ?? new Date();
      const project = yield* createProject({
        id: input.projectId,
        name: input.name,
        description: input.description,
        createdAt: at,
        updatedAt: at,
      }).pipe(
        Effect.mapError(
          (error) =>
            new ProjectServiceError({
              message: `failed to create project: ${error.message}`,
              code: "invalid_request",
            }),
        ),
      );

      yield* repository.saveEntity("project", project.id, project);

      const transition = yield* createAuditTransition({
        entityType: "project",
        entityId: project.id,
        fromState: "none",
        toState: project.lifecycle,
        actor: input.actor,
        reason: "Project created",
        at,
      }).pipe(
        Effect.mapError(
          (error) =>
            new ProjectServiceError({
              message: `failed to append project create transition: ${error.message}`,
            }),
        ),
      );

      yield* repository.appendAuditTransition(transition);
      return project;
    }),
  );

export const updateProjectInService = (
  repository: CoreRepository,
  input: UpdateProjectInServiceInput,
): Effect.Effect<Project, ProjectServiceError> =>
  repository.withTransaction(
    Effect.gen(function* () {
      const hasUpdates =
        input.name !== undefined || input.description !== undefined;
      if (!hasUpdates) {
        return yield* Effect.fail(
          new ProjectServiceError({
            message: "at least one project field must be provided for update",
            code: "invalid_request",
          }),
        );
      }

      if (input.name !== undefined) {
        yield* validateProjectName(input.name);
      }

      const project = yield* loadProject(repository, input.projectId);
      const at = input.at ?? new Date();
      const atIso = at.toISOString();

      const updated: Project = {
        ...project,
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        updatedAt: atIso,
      };

      yield* repository.saveEntity("project", updated.id, updated);

      const transition = yield* createAuditTransition({
        entityType: "project",
        entityId: updated.id,
        fromState: project.lifecycle,
        toState: updated.lifecycle,
        actor: input.actor,
        reason: "Project updated",
        at,
      }).pipe(
        Effect.mapError(
          (error) =>
            new ProjectServiceError({
              message: `failed to append project update transition: ${error.message}`,
            }),
        ),
      );

      yield* repository.appendAuditTransition(transition);
      return updated;
    }),
  );

export const setProjectLifecycle = (
  repository: CoreRepository,
  projectId: string,
  lifecycle: ProjectLifecycle,
  actor: ActorRef,
  at: Date = new Date(),
): Effect.Effect<Project, ProjectServiceError> =>
  repository.withTransaction(
    Effect.gen(function* () {
      const project = yield* loadProject(repository, projectId);
      const atIso = at.toISOString();

      const updated: Project = {
        ...project,
        lifecycle,
        updatedAt: atIso,
      };

      yield* repository.saveEntity("project", updated.id, updated);

      const transition = yield* createAuditTransition({
        entityType: "project",
        entityId: updated.id,
        fromState: project.lifecycle,
        toState: updated.lifecycle,
        actor,
        reason: `Project lifecycle set to ${lifecycle}`,
        at,
      }).pipe(
        Effect.mapError(
          (error) =>
            new ProjectServiceError({
              message: `failed to append project lifecycle transition: ${error.message}`,
            }),
        ),
      );

      yield* repository.appendAuditTransition(transition);
      return updated;
    }),
  );

export const listProjects = (
  repository: CoreRepository,
  input: ListProjectsInput = {},
): Effect.Effect<ReadonlyArray<Project>> =>
  Effect.gen(function* () {
    const projects = yield* repository.listEntities<Project>("project");
    const filtered = projects.filter(
      (project) =>
        input.lifecycle === undefined || project.lifecycle === input.lifecycle,
    );
    return sortProjectsDeterministically(filtered);
  });

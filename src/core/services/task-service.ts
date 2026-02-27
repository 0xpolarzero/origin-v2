import { Data, Effect } from "effect";

import { createAuditTransition } from "../domain/audit-transition";
import { ActorRef } from "../domain/common";
import { createTask, Task } from "../domain/task";
import { CoreRepository } from "../repositories/core-repository";

export class TaskTransitionError extends Data.TaggedError(
  "TaskTransitionError",
)<{
  message: string;
  code?: "not_found" | "invalid_request" | "conflict";
}> {}

export interface CreateTaskFromInput {
  taskId?: string;
  title: string;
  description?: string;
  scheduledFor?: Date;
  dueAt?: Date;
  projectId?: string;
  sourceEntryId?: string;
  actor: ActorRef;
  at?: Date;
}

export interface UpdateTaskDetailsInput {
  taskId: string;
  title?: string;
  description?: string | null;
  scheduledFor?: Date | null;
  dueAt?: Date | null;
  projectId?: string | null;
  actor: ActorRef;
  at?: Date;
}

export interface ListTasksInput {
  status?: Task["status"];
  projectId?: string;
  scheduledFrom?: Date;
  scheduledTo?: Date;
}

const loadTask = (
  repository: CoreRepository,
  taskId: string,
): Effect.Effect<Task, TaskTransitionError> =>
  Effect.gen(function* () {
    const task = yield* repository.getEntity<Task>("task", taskId);

    if (!task) {
      return yield* Effect.fail(
        new TaskTransitionError({
          message: `task ${taskId} was not found`,
          code: "not_found",
        }),
      );
    }

    return task;
  });

export const createTaskFromInput = (
  repository: CoreRepository,
  input: CreateTaskFromInput,
): Effect.Effect<Task, TaskTransitionError> =>
  Effect.gen(function* () {
    if (input.taskId) {
      const existing = yield* repository.getEntity<Task>("task", input.taskId);
      if (existing) {
        return yield* Effect.fail(
          new TaskTransitionError({
            message: `task ${input.taskId} already exists`,
            code: "conflict",
          }),
        );
      }
    }

    const at = input.at ?? new Date();
    const task = yield* createTask({
      id: input.taskId,
      title: input.title,
      description: input.description,
      scheduledFor: input.scheduledFor,
      dueAt: input.dueAt,
      projectId: input.projectId,
      sourceEntryId: input.sourceEntryId,
      createdAt: at,
      updatedAt: at,
    }).pipe(
      Effect.mapError(
        (error) =>
          new TaskTransitionError({
            message: `failed to create task: ${error.message}`,
            code: "invalid_request",
          }),
      ),
    );

    yield* repository.saveEntity("task", task.id, task);

    const transitionMetadata = {
      ...(task.projectId ? { projectId: task.projectId } : {}),
      ...(task.sourceEntryId ? { sourceEntryId: task.sourceEntryId } : {}),
    };

    const transition = yield* createAuditTransition({
      entityType: "task",
      entityId: task.id,
      fromState: "none",
      toState: task.status,
      actor: input.actor,
      reason: "Task created",
      at,
      metadata:
        Object.keys(transitionMetadata).length > 0
          ? transitionMetadata
          : undefined,
    }).pipe(
      Effect.mapError(
        (error) =>
          new TaskTransitionError({
            message: `failed to append task create transition: ${error.message}`,
          }),
      ),
    );

    yield* repository.appendAuditTransition(transition);

    return task;
  });

export const updateTaskDetails = (
  repository: CoreRepository,
  input: UpdateTaskDetailsInput,
): Effect.Effect<Task, TaskTransitionError> =>
  Effect.gen(function* () {
    const hasUpdates =
      input.title !== undefined ||
      input.description !== undefined ||
      input.scheduledFor !== undefined ||
      input.dueAt !== undefined ||
      input.projectId !== undefined;

    if (!hasUpdates) {
      return yield* Effect.fail(
        new TaskTransitionError({
          message: "at least one task detail must be provided",
          code: "invalid_request",
        }),
      );
    }

    if (input.title !== undefined && input.title.trim().length === 0) {
      return yield* Effect.fail(
        new TaskTransitionError({
          message: "title is required",
          code: "invalid_request",
        }),
      );
    }

    const task = yield* loadTask(repository, input.taskId);

    if (input.scheduledFor !== undefined && task.status !== "planned") {
      return yield* Effect.fail(
        new TaskTransitionError({
          message: `task ${task.id} must be planned before updating scheduledFor`,
          code: "conflict",
        }),
      );
    }

    const at = input.at ?? new Date();
    const atIso = at.toISOString();

    const updated: Task = {
      ...task,
      title: input.title ?? task.title,
      description:
        input.description === undefined
          ? task.description
          : input.description ?? undefined,
      scheduledFor:
        input.scheduledFor === undefined
          ? task.scheduledFor
          : input.scheduledFor?.toISOString(),
      dueAt:
        input.dueAt === undefined ? task.dueAt : input.dueAt?.toISOString(),
      projectId:
        input.projectId === undefined ? task.projectId : input.projectId ?? undefined,
      updatedAt: atIso,
    };

    yield* repository.saveEntity("task", updated.id, updated);

    const changedFields = [
      input.title !== undefined ? "title" : undefined,
      input.description !== undefined ? "description" : undefined,
      input.scheduledFor !== undefined ? "scheduledFor" : undefined,
      input.dueAt !== undefined ? "dueAt" : undefined,
      input.projectId !== undefined ? "projectId" : undefined,
    ].filter((field): field is string => field !== undefined);

    const transition = yield* createAuditTransition({
      entityType: "task",
      entityId: updated.id,
      fromState: task.status,
      toState: updated.status,
      actor: input.actor,
      reason: "Task details updated",
      at,
      metadata:
        changedFields.length > 0
          ? { changedFields: changedFields.join(",") }
          : undefined,
    }).pipe(
      Effect.mapError(
        (error) =>
          new TaskTransitionError({
            message: `failed to append update transition: ${error.message}`,
          }),
      ),
    );

    yield* repository.appendAuditTransition(transition);

    return updated;
  });

export const listTasks = (
  repository: CoreRepository,
  input: ListTasksInput = {},
): Effect.Effect<ReadonlyArray<Task>, TaskTransitionError> =>
  Effect.gen(function* () {
    if (
      input.scheduledFrom &&
      input.scheduledTo &&
      input.scheduledFrom.getTime() > input.scheduledTo.getTime()
    ) {
      return yield* Effect.fail(
        new TaskTransitionError({
          message: "scheduledFrom must be before or equal to scheduledTo",
          code: "invalid_request",
        }),
      );
    }

    const scheduledFromIso = input.scheduledFrom?.toISOString();
    const scheduledToIso = input.scheduledTo?.toISOString();
    const tasks = yield* repository.listEntities<Task>("task");

    return tasks
      .filter(
        (task) => input.status === undefined || task.status === input.status,
      )
      .filter(
        (task) =>
          input.projectId === undefined || task.projectId === input.projectId,
      )
      .filter((task) => {
        if (scheduledFromIso === undefined && scheduledToIso === undefined) {
          return true;
        }

        if (task.scheduledFor === undefined) {
          return false;
        }

        if (scheduledFromIso !== undefined && task.scheduledFor < scheduledFromIso) {
          return false;
        }

        if (scheduledToIso !== undefined && task.scheduledFor > scheduledToIso) {
          return false;
        }

        return true;
      })
      .sort(
        (left, right) =>
          right.updatedAt.localeCompare(left.updatedAt) ||
          right.id.localeCompare(left.id),
      );
  });

export const completeTask = (
  repository: CoreRepository,
  taskId: string,
  actor: ActorRef,
  at: Date = new Date(),
): Effect.Effect<Task, TaskTransitionError> =>
  Effect.gen(function* () {
    const task = yield* loadTask(repository, taskId);
    const atIso = at.toISOString();

    const updated: Task = {
      ...task,
      status: "completed",
      completedAt: atIso,
      updatedAt: atIso,
      deferredUntil: undefined,
    };

    yield* repository.saveEntity("task", updated.id, updated);

    const transition = yield* createAuditTransition({
      entityType: "task",
      entityId: updated.id,
      fromState: task.status,
      toState: updated.status,
      actor,
      reason: "Task completed",
      at,
    }).pipe(
      Effect.mapError(
        (error) =>
          new TaskTransitionError({
            message: `failed to append complete transition: ${error.message}`,
          }),
      ),
    );

    yield* repository.appendAuditTransition(transition);

    return updated;
  });

export const deferTask = (
  repository: CoreRepository,
  taskId: string,
  until: Date,
  actor: ActorRef,
  at: Date = new Date(),
): Effect.Effect<Task, TaskTransitionError> =>
  Effect.gen(function* () {
    const task = yield* loadTask(repository, taskId);
    const atIso = at.toISOString();

    const updated: Task = {
      ...task,
      status: "deferred",
      deferredUntil: until.toISOString(),
      updatedAt: atIso,
    };

    yield* repository.saveEntity("task", updated.id, updated);

    const transition = yield* createAuditTransition({
      entityType: "task",
      entityId: updated.id,
      fromState: task.status,
      toState: updated.status,
      actor,
      reason: "Task deferred",
      at,
    }).pipe(
      Effect.mapError(
        (error) =>
          new TaskTransitionError({
            message: `failed to append defer transition: ${error.message}`,
          }),
      ),
    );

    yield* repository.appendAuditTransition(transition);

    return updated;
  });

export const rescheduleTask = (
  repository: CoreRepository,
  taskId: string,
  nextAt: Date,
  actor: ActorRef,
  at: Date = new Date(),
): Effect.Effect<Task, TaskTransitionError> =>
  Effect.gen(function* () {
    const task = yield* loadTask(repository, taskId);
    const atIso = at.toISOString();

    const updated: Task = {
      ...task,
      status: "planned",
      scheduledFor: nextAt.toISOString(),
      deferredUntil: undefined,
      updatedAt: atIso,
    };

    yield* repository.saveEntity("task", updated.id, updated);

    const transition = yield* createAuditTransition({
      entityType: "task",
      entityId: updated.id,
      fromState: task.status,
      toState: updated.status,
      actor,
      reason: "Task rescheduled",
      at,
    }).pipe(
      Effect.mapError(
        (error) =>
          new TaskTransitionError({
            message: `failed to append reschedule transition: ${error.message}`,
          }),
      ),
    );

    yield* repository.appendAuditTransition(transition);

    return updated;
  });

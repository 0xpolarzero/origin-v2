import { Data, Effect } from "effect";

import { createAuditTransition } from "../domain/audit-transition";
import { ActorRef } from "../domain/common";
import { Task } from "../domain/task";
import { CoreRepository } from "../repositories/core-repository";

export class TaskTransitionError extends Data.TaggedError(
  "TaskTransitionError",
)<{
  message: string;
  code?: "not_found";
}> {}

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

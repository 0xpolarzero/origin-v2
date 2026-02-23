import { Data, Effect } from "effect";

import { createAuditTransition } from "../domain/audit-transition";
import { ActorRef } from "../domain/common";
import { createEntry, Entry } from "../domain/entry";
import { createTask, Task } from "../domain/task";
import { CoreRepository } from "../repositories/core-repository";

export class EntryServiceError extends Data.TaggedError("EntryServiceError")<{
  message: string;
}> {}

export interface CaptureEntryInput {
  entryId?: string;
  content: string;
  actor: ActorRef;
  at?: Date;
}

export interface AcceptEntryAsTaskInput {
  entryId: string;
  taskId?: string;
  title?: string;
  actor: ActorRef;
  at?: Date;
}

export const captureEntry = (
  repository: CoreRepository,
  input: CaptureEntryInput,
): Effect.Effect<Entry, EntryServiceError> =>
  Effect.gen(function* () {
    const entry = yield* createEntry({
      id: input.entryId,
      content: input.content,
      capturedAt: input.at,
      createdAt: input.at,
      updatedAt: input.at,
    }).pipe(
      Effect.mapError(
        (error) =>
          new EntryServiceError({
            message: `failed to capture entry: ${error.message}`,
          }),
      ),
    );

    yield* repository.saveEntity("entry", entry.id, entry);

    const transition = yield* createAuditTransition({
      entityType: "entry",
      entityId: entry.id,
      fromState: "none",
      toState: "captured",
      actor: input.actor,
      reason: "Entry captured",
      at: input.at,
    }).pipe(
      Effect.mapError(
        (error) =>
          new EntryServiceError({
            message: `failed to write entry capture audit transition: ${error.message}`,
          }),
      ),
    );

    yield* repository.appendAuditTransition(transition);

    return entry;
  });

export const acceptEntryAsTask = (
  repository: CoreRepository,
  input: AcceptEntryAsTaskInput,
): Effect.Effect<Task, EntryServiceError> =>
  Effect.gen(function* () {
    const entry = yield* repository.getEntity<Entry>("entry", input.entryId);

    if (!entry) {
      return yield* Effect.fail(
        new EntryServiceError({
          message: `entry ${input.entryId} was not found`,
        }),
      );
    }

    const task = yield* createTask({
      id: input.taskId,
      title: input.title ?? entry.content,
      sourceEntryId: entry.id,
      createdAt: input.at,
      updatedAt: input.at,
    }).pipe(
      Effect.mapError(
        (error) =>
          new EntryServiceError({
            message: `failed to create task from entry: ${error.message}`,
          }),
      ),
    );

    const at = (input.at ?? new Date()).toISOString();
    const updatedEntry: Entry = {
      ...entry,
      status: "accepted_as_task",
      acceptedTaskId: task.id,
      updatedAt: at,
    };

    yield* repository.saveEntity("entry", updatedEntry.id, updatedEntry);
    yield* repository.saveEntity("task", task.id, task);

    const entryTransition = yield* createAuditTransition({
      entityType: "entry",
      entityId: updatedEntry.id,
      fromState: entry.status,
      toState: updatedEntry.status,
      actor: input.actor,
      reason: "Entry accepted as task",
      at: input.at,
      metadata: {
        taskId: task.id,
      },
    }).pipe(
      Effect.mapError(
        (error) =>
          new EntryServiceError({
            message: `failed to write entry conversion audit transition: ${error.message}`,
          }),
      ),
    );

    const taskTransition = yield* createAuditTransition({
      entityType: "task",
      entityId: task.id,
      fromState: "none",
      toState: task.status,
      actor: input.actor,
      reason: "Task created from entry",
      at: input.at,
      metadata: {
        sourceEntryId: entry.id,
      },
    }).pipe(
      Effect.mapError(
        (error) =>
          new EntryServiceError({
            message: `failed to write task creation audit transition: ${error.message}`,
          }),
      ),
    );

    yield* repository.appendAuditTransition(entryTransition);
    yield* repository.appendAuditTransition(taskTransition);

    return task;
  });

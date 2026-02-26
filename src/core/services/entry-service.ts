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

export interface SuggestEntryAsTaskInput {
  entryId: string;
  suggestedTitle: string;
  actor: ActorRef;
  at?: Date;
}

export interface EditEntrySuggestionInput {
  entryId: string;
  suggestedTitle: string;
  actor: ActorRef;
  at?: Date;
}

export interface RejectEntrySuggestionInput {
  entryId: string;
  reason?: string;
  actor: ActorRef;
  at?: Date;
}

const loadEntry = (
  repository: CoreRepository,
  entryId: string,
): Effect.Effect<Entry, EntryServiceError> =>
  Effect.gen(function* () {
    const entry = yield* repository.getEntity<Entry>("entry", entryId);
    if (!entry) {
      return yield* Effect.fail(
        new EntryServiceError({
          message: `entry ${entryId} was not found`,
        }),
      );
    }
    return entry;
  });

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
    const entry = yield* loadEntry(repository, input.entryId);

    const task = yield* createTask({
      id: input.taskId,
      title: input.title ?? entry.suggestedTaskTitle ?? entry.content,
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
      rejectionReason: undefined,
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

export const suggestEntryAsTask = (
  repository: CoreRepository,
  input: SuggestEntryAsTaskInput,
): Effect.Effect<Entry, EntryServiceError> =>
  Effect.gen(function* () {
    const entry = yield* loadEntry(repository, input.entryId);
    const at = input.at ?? new Date();
    const atIso = at.toISOString();

    const updatedEntry: Entry = {
      ...entry,
      status: "suggested",
      suggestedTaskTitle: input.suggestedTitle,
      suggestionUpdatedAt: atIso,
      rejectionReason: undefined,
      updatedAt: atIso,
    };

    yield* repository.saveEntity("entry", updatedEntry.id, updatedEntry);

    const transition = yield* createAuditTransition({
      entityType: "entry",
      entityId: updatedEntry.id,
      fromState: entry.status,
      toState: updatedEntry.status,
      actor: input.actor,
      reason: "AI suggested entry conversion to task",
      at,
      metadata: {
        suggestedTitle: input.suggestedTitle,
      },
    }).pipe(
      Effect.mapError(
        (error) =>
          new EntryServiceError({
            message: `failed to write entry suggestion audit transition: ${error.message}`,
          }),
      ),
    );

    yield* repository.appendAuditTransition(transition);
    return updatedEntry;
  });

export const editEntrySuggestion = (
  repository: CoreRepository,
  input: EditEntrySuggestionInput,
): Effect.Effect<Entry, EntryServiceError> =>
  Effect.gen(function* () {
    const entry = yield* loadEntry(repository, input.entryId);
    const at = input.at ?? new Date();
    const atIso = at.toISOString();

    const fromState = entry.status;
    const updatedEntry: Entry = {
      ...entry,
      status: "suggested",
      suggestedTaskTitle: input.suggestedTitle,
      suggestionUpdatedAt: atIso,
      rejectionReason: undefined,
      updatedAt: atIso,
    };

    yield* repository.saveEntity("entry", updatedEntry.id, updatedEntry);

    const transition = yield* createAuditTransition({
      entityType: "entry",
      entityId: updatedEntry.id,
      fromState,
      toState: updatedEntry.status,
      actor: input.actor,
      reason: "Entry suggestion edited",
      at,
      metadata: {
        suggestedTitle: input.suggestedTitle,
      },
    }).pipe(
      Effect.mapError(
        (error) =>
          new EntryServiceError({
            message: `failed to write entry suggestion edit audit transition: ${error.message}`,
          }),
      ),
    );

    yield* repository.appendAuditTransition(transition);
    return updatedEntry;
  });

export const rejectEntrySuggestion = (
  repository: CoreRepository,
  input: RejectEntrySuggestionInput,
): Effect.Effect<Entry, EntryServiceError> =>
  Effect.gen(function* () {
    const entry = yield* loadEntry(repository, input.entryId);
    const at = input.at ?? new Date();
    const atIso = at.toISOString();

    const updatedEntry: Entry = {
      ...entry,
      status: "rejected",
      rejectionReason: input.reason,
      updatedAt: atIso,
    };

    yield* repository.saveEntity("entry", updatedEntry.id, updatedEntry);

    const transition = yield* createAuditTransition({
      entityType: "entry",
      entityId: updatedEntry.id,
      fromState: entry.status,
      toState: updatedEntry.status,
      actor: input.actor,
      reason: input.reason
        ? `Entry suggestion rejected: ${input.reason}`
        : "Entry suggestion rejected",
      at,
    }).pipe(
      Effect.mapError(
        (error) =>
          new EntryServiceError({
            message: `failed to write entry rejection audit transition: ${error.message}`,
          }),
      ),
    );

    yield* repository.appendAuditTransition(transition);
    return updatedEntry;
  });

import { Effect } from "effect";

import {
  createId,
  createTimestamps,
  DomainValidationError,
  validateNonEmpty,
} from "./common";

export type TaskStatus = "planned" | "completed" | "deferred";

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  scheduledFor?: string;
  dueAt?: string;
  projectId?: string;
  sourceEntryId?: string;
  completedAt?: string;
  deferredUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  id?: string;
  title: string;
  description?: string;
  scheduledFor?: Date;
  dueAt?: Date;
  projectId?: string;
  sourceEntryId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const createTask = (
  input: CreateTaskInput,
): Effect.Effect<Task, DomainValidationError> => {
  const error = validateNonEmpty(input.title, "title");
  if (error) {
    return Effect.fail(error);
  }

  const timestamps = createTimestamps({
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });

  return Effect.succeed({
    id: input.id ?? createId("task"),
    title: input.title,
    description: input.description,
    status: "planned",
    scheduledFor: input.scheduledFor?.toISOString(),
    dueAt: input.dueAt?.toISOString(),
    projectId: input.projectId,
    sourceEntryId: input.sourceEntryId,
    ...timestamps,
  });
};

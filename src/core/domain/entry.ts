import { Effect } from "effect";

import {
  createId,
  createTimestamps,
  DomainValidationError,
  validateNonEmpty,
} from "./common";

export type EntrySource = "manual" | "import" | "api";
export type EntryStatus =
  | "captured"
  | "suggested"
  | "rejected"
  | "accepted_as_task";

export interface Entry {
  id: string;
  content: string;
  source: EntrySource;
  status: EntryStatus;
  capturedAt: string;
  createdAt: string;
  updatedAt: string;
  suggestedTaskTitle?: string;
  suggestionUpdatedAt?: string;
  rejectionReason?: string;
  acceptedTaskId?: string;
}

export interface CreateEntryInput {
  id?: string;
  content: string;
  source?: EntrySource;
  capturedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export const createEntry = (
  input: CreateEntryInput,
): Effect.Effect<Entry, DomainValidationError> => {
  const error = validateNonEmpty(input.content, "content");
  if (error) {
    return Effect.fail(error);
  }

  const timestamps = createTimestamps({
    createdAt: input.createdAt ?? input.capturedAt,
    updatedAt: input.updatedAt ?? input.capturedAt,
  });

  return Effect.succeed({
    id: input.id ?? createId("entry"),
    content: input.content,
    source: input.source ?? "manual",
    status: "captured",
    capturedAt: (
      input.capturedAt ?? new Date(timestamps.createdAt)
    ).toISOString(),
    ...timestamps,
  });
};

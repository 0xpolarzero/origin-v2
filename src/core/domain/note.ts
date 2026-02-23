import { Effect } from "effect";

import {
  createId,
  createTimestamps,
  DomainValidationError,
  validateNonEmpty,
} from "./common";

export interface Note {
  id: string;
  body: string;
  linkedEntityRefs: ReadonlyArray<string>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteInput {
  id?: string;
  body: string;
  linkedEntityRefs?: ReadonlyArray<string>;
  createdAt?: Date;
  updatedAt?: Date;
}

export const createNote = (
  input: CreateNoteInput,
): Effect.Effect<Note, DomainValidationError> => {
  const error = validateNonEmpty(input.body, "body");
  if (error) {
    return Effect.fail(error);
  }

  const timestamps = createTimestamps({
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });

  const linkedEntityRefs = Array.from(
    new Set(input.linkedEntityRefs ?? []),
  ).sort((a, b) => a.localeCompare(b));

  return Effect.succeed({
    id: input.id ?? createId("note"),
    body: input.body,
    linkedEntityRefs,
    ...timestamps,
  });
};

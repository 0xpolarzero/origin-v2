import { Effect } from "effect";

import {
  createId,
  createTimestamps,
  DomainValidationError,
  validateNonEmpty,
} from "./common";

export type EventSyncState = "local_only" | "pending_approval" | "synced";

export interface Event {
  id: string;
  title: string;
  startAt: string;
  endAt?: string;
  syncState: EventSyncState;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventInput {
  id?: string;
  title: string;
  startAt: Date;
  endAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export const createEvent = (
  input: CreateEventInput,
): Effect.Effect<Event, DomainValidationError> => {
  const titleError = validateNonEmpty(input.title, "title");
  if (titleError) {
    return Effect.fail(titleError);
  }

  const timestamps = createTimestamps({
    createdAt: input.createdAt ?? input.startAt,
    updatedAt: input.updatedAt,
  });

  return Effect.succeed({
    id: input.id ?? createId("event"),
    title: input.title,
    startAt: input.startAt.toISOString(),
    endAt: input.endAt?.toISOString(),
    syncState: "local_only",
    ...timestamps,
  });
};

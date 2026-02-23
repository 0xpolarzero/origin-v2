import { Effect } from "effect";

import {
  createId,
  createTimestamps,
  DomainValidationError,
  validateNonEmpty,
} from "./common";

export type SignalTriageState =
  | "untriaged"
  | "triaged"
  | "converted"
  | "rejected";

export interface Signal {
  id: string;
  source: string;
  payload: string;
  triageState: SignalTriageState;
  triageDecision?: string;
  convertedEntityType?: string;
  convertedEntityId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSignalInput {
  id?: string;
  source: string;
  payload: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const createSignal = (
  input: CreateSignalInput,
): Effect.Effect<Signal, DomainValidationError> => {
  const sourceError = validateNonEmpty(input.source, "source");
  if (sourceError) {
    return Effect.fail(sourceError);
  }

  const payloadError = validateNonEmpty(input.payload, "payload");
  if (payloadError) {
    return Effect.fail(payloadError);
  }

  const timestamps = createTimestamps({
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });

  return Effect.succeed({
    id: input.id ?? createId("signal"),
    source: input.source,
    payload: input.payload,
    triageState: "untriaged",
    ...timestamps,
  });
};

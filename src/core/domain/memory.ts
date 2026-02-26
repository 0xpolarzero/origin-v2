import { Effect } from "effect";

import {
  createId,
  createTimestamps,
  DomainValidationError,
  validateNonEmpty,
} from "./common";

export interface Memory {
  id: string;
  key: string;
  value: string;
  source: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemoryInput {
  id?: string;
  key: string;
  value: string;
  source: string;
  confidence: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export const createMemory = (
  input: CreateMemoryInput,
): Effect.Effect<Memory, DomainValidationError> => {
  const keyError = validateNonEmpty(input.key, "key");
  if (keyError) {
    return Effect.fail(keyError);
  }

  const valueError = validateNonEmpty(input.value, "value");
  if (valueError) {
    return Effect.fail(valueError);
  }

  const sourceError = validateNonEmpty(input.source, "source");
  if (sourceError) {
    return Effect.fail(sourceError);
  }

  if (
    !Number.isFinite(input.confidence) ||
    input.confidence < 0 ||
    input.confidence > 1
  ) {
    return Effect.fail(
      new DomainValidationError({
        message: "confidence must be between 0 and 1",
      }),
    );
  }

  const timestamps = createTimestamps({
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });

  return Effect.succeed({
    id: input.id ?? createId("memory"),
    key: input.key,
    value: input.value,
    source: input.source,
    confidence: input.confidence,
    ...timestamps,
  });
};

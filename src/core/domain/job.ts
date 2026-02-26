import { Effect } from "effect";

import {
  createId,
  createTimestamps,
  DomainValidationError,
  validateNonEmpty,
} from "./common";

export type JobRunState =
  | "idle"
  | "running"
  | "succeeded"
  | "failed"
  | "retrying";

export interface Job {
  id: string;
  name: string;
  runState: JobRunState;
  retryCount: number;
  lastRunAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastFailureReason?: string;
  diagnostics?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJobInput {
  id?: string;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const createJob = (
  input: CreateJobInput,
): Effect.Effect<Job, DomainValidationError> => {
  const error = validateNonEmpty(input.name, "name");
  if (error) {
    return Effect.fail(error);
  }

  const timestamps = createTimestamps({
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });

  return Effect.succeed({
    id: input.id ?? createId("job"),
    name: input.name,
    runState: "idle",
    retryCount: 0,
    ...timestamps,
  });
};

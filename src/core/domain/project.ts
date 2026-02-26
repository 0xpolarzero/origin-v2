import { Effect } from "effect";

import {
  createId,
  createTimestamps,
  DomainValidationError,
  validateNonEmpty,
} from "./common";

export type ProjectLifecycle = "active" | "paused" | "completed";

export interface Project {
  id: string;
  name: string;
  description?: string;
  lifecycle: ProjectLifecycle;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  id?: string;
  name: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const createProject = (
  input: CreateProjectInput,
): Effect.Effect<Project, DomainValidationError> => {
  const error = validateNonEmpty(input.name, "name");
  if (error) {
    return Effect.fail(error);
  }

  const timestamps = createTimestamps({
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });

  return Effect.succeed({
    id: input.id ?? createId("project"),
    name: input.name,
    description: input.description,
    lifecycle: "active",
    ...timestamps,
  });
};

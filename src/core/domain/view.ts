import { Effect } from "effect";

import {
  createId,
  createTimestamps,
  DomainValidationError,
  validateNonEmpty,
} from "./common";

export type ViewFilters = Record<string, string | number | boolean>;

export interface View {
  id: string;
  name: string;
  query: string;
  filters: ViewFilters;
  createdAt: string;
  updatedAt: string;
}

export interface CreateViewInput {
  id?: string;
  name: string;
  query: string;
  filters?: ViewFilters;
  createdAt?: Date;
  updatedAt?: Date;
}

export const createView = (
  input: CreateViewInput,
): Effect.Effect<View, DomainValidationError> => {
  const nameError = validateNonEmpty(input.name, "name");
  if (nameError) {
    return Effect.fail(nameError);
  }

  const queryError = validateNonEmpty(input.query, "query");
  if (queryError) {
    return Effect.fail(queryError);
  }

  const timestamps = createTimestamps({
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });

  const filters = { ...(input.filters ?? {}) };

  return Effect.succeed({
    id: input.id ?? createId("view"),
    name: input.name,
    query: input.query,
    filters,
    ...timestamps,
  });
};

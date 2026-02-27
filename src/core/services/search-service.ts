import { Data, Effect } from "effect";

import { ENTITY_TYPES, EntityType } from "../domain/common";
import { CoreRepository } from "../repositories/core-repository";

export class SearchServiceError extends Data.TaggedError("SearchServiceError")<{
  message: string;
  code?: "invalid_request";
}> {}

export interface SearchEntitiesInput {
  query: string;
  entityTypes?: ReadonlyArray<EntityType | string>;
  limit?: number;
}

export interface SearchResult {
  entityType: string;
  entityId: string;
  preview: string;
  updatedAt?: string;
}

const PREVIEW_LENGTH = 120;
const PREVIEW_CONTEXT_BEFORE = 24;
const PREVIEW_CONTEXT_AFTER = 56;

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const collectSearchTokens = (
  value: unknown,
  tokens: Array<string>,
): Array<string> => {
  if (typeof value === "string") {
    tokens.push(value);
    return tokens;
  }

  if (
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean"
  ) {
    tokens.push(String(value));
    return tokens;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectSearchTokens(item, tokens);
    }
    return tokens;
  }

  if (isRecord(value)) {
    for (const key of Object.keys(value).sort((left, right) =>
      left.localeCompare(right),
    )) {
      tokens.push(key);
      collectSearchTokens(value[key], tokens);
    }
  }

  return tokens;
};

const toSearchText = (entity: unknown): string =>
  collectSearchTokens(entity, [])
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

const buildPreview = (searchText: string, query: string): string => {
  const normalizedQuery = normalizeText(query);
  if (normalizedQuery.length === 0) {
    return searchText.slice(0, PREVIEW_LENGTH);
  }

  const matchIndex = searchText.toLowerCase().indexOf(normalizedQuery);
  if (matchIndex < 0) {
    return searchText.slice(0, PREVIEW_LENGTH);
  }

  const start = Math.max(0, matchIndex - PREVIEW_CONTEXT_BEFORE);
  const end = Math.min(
    searchText.length,
    matchIndex + normalizedQuery.length + PREVIEW_CONTEXT_AFTER,
  );
  return searchText.slice(start, end);
};

const toSearchResult = (
  entityType: EntityType,
  entity: unknown,
  normalizedQuery: string,
  originalQuery: string,
): SearchResult | undefined => {
  if (!isRecord(entity)) {
    return undefined;
  }

  const entityId = entity.id;
  if (typeof entityId !== "string" || entityId.trim().length === 0) {
    return undefined;
  }

  const searchText = toSearchText(entity);
  if (searchText.length === 0) {
    return undefined;
  }

  if (!normalizeText(searchText).includes(normalizedQuery)) {
    return undefined;
  }

  const updatedAt =
    typeof entity.updatedAt === "string" && entity.updatedAt.trim().length > 0
      ? entity.updatedAt
      : undefined;

  return {
    entityType,
    entityId,
    preview: buildPreview(searchText, originalQuery),
    updatedAt,
  };
};

const toSearchServiceError = (
  message: string,
  code?: SearchServiceError["code"],
): SearchServiceError =>
  new SearchServiceError({
    message,
    code,
  });

const resolveEntityTypes = (
  entityTypes?: ReadonlyArray<EntityType | string>,
): Effect.Effect<ReadonlyArray<EntityType>, SearchServiceError> => {
  if (entityTypes === undefined) {
    return Effect.succeed(ENTITY_TYPES);
  }

  if (entityTypes.length === 0) {
    return Effect.succeed([]);
  }

  const normalized = entityTypes.map((entityType) => entityType.trim());
  for (const entityType of normalized) {
    if (!ENTITY_TYPES.includes(entityType as EntityType)) {
      return Effect.fail(
        toSearchServiceError(
          `unsupported entity type filter: ${entityType}`,
          "invalid_request",
        ),
      );
    }
  }

  const set = new Set(normalized as ReadonlyArray<EntityType>);
  return Effect.succeed(ENTITY_TYPES.filter((entityType) => set.has(entityType)));
};

const compareSearchResults = (
  left: SearchResult,
  right: SearchResult,
): number =>
  (right.updatedAt ?? "").localeCompare(left.updatedAt ?? "") ||
  left.entityType.localeCompare(right.entityType) ||
  left.entityId.localeCompare(right.entityId) ||
  left.preview.localeCompare(right.preview);

export const searchEntities = (
  repository: CoreRepository,
  input: SearchEntitiesInput,
): Effect.Effect<ReadonlyArray<SearchResult>, SearchServiceError> =>
  Effect.gen(function* () {
    if (
      input.limit !== undefined &&
      (!Number.isInteger(input.limit) || input.limit <= 0)
    ) {
      return yield* Effect.fail(
        toSearchServiceError(
          "limit must be a positive integer",
          "invalid_request",
        ),
      );
    }

    const normalizedQuery = normalizeText(input.query);
    if (normalizedQuery.length === 0) {
      return [];
    }

    const entityTypes = yield* resolveEntityTypes(input.entityTypes);
    if (entityTypes.length === 0) {
      return [];
    }

    const matches = yield* Effect.forEach(entityTypes, (entityType) =>
      repository.listEntities<unknown>(entityType).pipe(
        Effect.map((entities) =>
          entities
            .map((entity) =>
              toSearchResult(entityType, entity, normalizedQuery, input.query),
            )
            .filter((row): row is SearchResult => row !== undefined),
        ),
        Effect.mapError((error) =>
          toSearchServiceError(
            `failed to list ${entityType} entities: ${toErrorMessage(error)}`,
          ),
        ),
      ),
    );

    const ordered = matches.flat().sort(compareSearchResults);
    if (input.limit === undefined) {
      return ordered;
    }

    return ordered.slice(0, input.limit);
  });

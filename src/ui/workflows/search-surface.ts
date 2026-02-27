import { Data, Effect } from "effect";

import { WorkflowSurfaceCorePort } from "./workflow-surface-core-port";

export class SearchSurfaceError extends Data.TaggedError("SearchSurfaceError")<{
  message: string;
  cause?: unknown;
}> {}

export interface SearchSurfaceFilters {
  query: string;
  entityTypes?: ReadonlyArray<string>;
  limit?: number;
}

export interface SearchSurfaceResult {
  entityType: string;
  entityId: string;
  preview: string;
}

export interface SearchSurfaceState {
  query: string;
  results: ReadonlyArray<SearchSurfaceResult>;
  scannedEntityTypes: ReadonlyArray<string>;
}

const SEARCH_ENTITY_TYPES: ReadonlyArray<string> = [
  "entry",
  "task",
  "event",
  "project",
  "note",
  "signal",
  "job",
  "notification",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toSearchSurfaceError = (error: unknown): SearchSurfaceError =>
  new SearchSurfaceError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  });

const toSearchText = (entity: unknown): string =>
  isRecord(entity) ? JSON.stringify(entity) : String(entity);

const toEntityId = (entity: unknown): string | undefined => {
  if (!isRecord(entity)) {
    return undefined;
  }

  return typeof entity.id === "string" ? entity.id : undefined;
};

const buildPreview = (text: string, query: string): string => {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return text.slice(0, 120);
  }

  const index = text.toLowerCase().indexOf(needle);
  if (index < 0) {
    return text.slice(0, 120);
  }

  const start = Math.max(0, index - 24);
  const end = Math.min(text.length, index + needle.length + 56);
  return text.slice(start, end);
};

export const loadSearchSurface = (
  port: WorkflowSurfaceCorePort,
  input: SearchSurfaceFilters,
): Effect.Effect<SearchSurfaceState, SearchSurfaceError> =>
  Effect.gen(function* () {
    const query = input.query.trim();
    const scannedEntityTypes = input.entityTypes ?? SEARCH_ENTITY_TYPES;

    if (query.length === 0) {
      return {
        query,
        results: [],
        scannedEntityTypes: [...scannedEntityTypes],
      };
    }

    const batches = yield* Effect.forEach(
      scannedEntityTypes,
      (entityType) => port.listEntities<unknown>(entityType),
    );
    const results = batches.flatMap((batch, index) => {
      const entityType = scannedEntityTypes[index];
      if (!entityType) {
        return [];
      }

      return batch.flatMap((entity) => {
        const entityId = toEntityId(entity);
        if (!entityId) {
          return [];
        }

        const text = toSearchText(entity);
        if (!text.toLowerCase().includes(query.toLowerCase())) {
          return [];
        }

        return [
          {
            entityType,
            entityId,
            preview: buildPreview(text, query),
          },
        ];
      });
    });
    const limited =
      input.limit && Number.isInteger(input.limit) && input.limit > 0
        ? results.slice(0, input.limit)
        : results;

    return {
      query,
      results: limited,
      scannedEntityTypes: [...scannedEntityTypes],
    };
  }).pipe(Effect.mapError(toSearchSurfaceError));

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { Data, Effect } from "effect";

import { AuditTransition } from "../domain/audit-transition";
import { ENTITY_TYPES, EntityType } from "../domain/common";
import { CoreRepository } from "./core-repository";
import { makeInMemoryCoreRepository } from "./in-memory-core-repository";

export class FileRepositoryError extends Data.TaggedError(
  "FileRepositoryError",
)<{
  message: string;
}> {}

interface Snapshot {
  version: 1;
  entities: Record<string, Array<unknown>>;
  auditTrail: Array<AuditTransition>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseSnapshot = (raw: string): Snapshot => {
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("invalid snapshot shape: expected object");
  }
  if (parsed.version !== 1) {
    throw new Error("invalid snapshot shape: unsupported version");
  }
  if (!isRecord(parsed.entities)) {
    throw new Error("invalid snapshot shape: entities must be an object");
  }
  if (!Array.isArray(parsed.auditTrail)) {
    throw new Error("invalid snapshot shape: auditTrail must be an array");
  }

  const entities: Record<string, Array<unknown>> = {};
  for (const entityType of ENTITY_TYPES) {
    const entry = parsed.entities[entityType];
    if (entry === undefined) {
      entities[entityType] = [];
      continue;
    }
    if (!Array.isArray(entry)) {
      throw new Error(
        `invalid snapshot shape: entities.${entityType} must be an array`,
      );
    }
    entities[entityType] = [...entry];
  }

  return {
    version: 1,
    entities,
    auditTrail: [...parsed.auditTrail],
  };
};

export const makeFileCoreRepository = (
  defaultPath: string,
): Effect.Effect<CoreRepository, FileRepositoryError> =>
  Effect.gen(function* () {
    const repository = makeInMemoryCoreRepository();

    const persistSnapshot = (path: string): Effect.Effect<void, Error> =>
      Effect.gen(function* () {
        const entities: Record<string, Array<unknown>> = {};

        for (const entityType of ENTITY_TYPES) {
          entities[entityType] = [
            ...(yield* repository.listEntities(entityType as EntityType)),
          ];
        }

        const snapshot: Snapshot = {
          version: 1,
          entities,
          auditTrail: [...(yield* repository.listAuditTrail())],
        };

        yield* Effect.try({
          try: () => {
            mkdirSync(dirname(path), { recursive: true });
            writeFileSync(path, JSON.stringify(snapshot, null, 2), "utf8");
          },
          catch: (cause) =>
            new FileRepositoryError({
              message: `failed to persist snapshot: ${String(cause)}`,
            }),
        });
      }).pipe(
        Effect.catchTag("FileRepositoryError", (error) =>
          Effect.fail(new Error(error.message)),
        ),
      );

    const loadSnapshot = (path: string): Effect.Effect<void, Error> =>
      Effect.gen(function* () {
        if (!existsSync(path)) {
          return;
        }

        const snapshot = yield* Effect.try({
          try: () => parseSnapshot(readFileSync(path, "utf8")),
          catch: (cause) =>
            new FileRepositoryError({
              message: `failed to load snapshot: ${String(cause)}`,
            }),
        });

        for (const entityType of ENTITY_TYPES) {
          const entries = snapshot.entities[entityType] ?? [];
          for (const entry of entries) {
            const record = entry as { id?: string };
            if (!record.id) {
              continue;
            }
            yield* repository.saveEntity(entityType, record.id, entry);
          }
        }

        for (const transition of snapshot.auditTrail ?? []) {
          yield* repository.appendAuditTransition(transition);
        }
      }).pipe(
        Effect.catchTag("FileRepositoryError", (error) =>
          Effect.fail(new Error(error.message)),
        ),
      );

    return {
      ...repository,
      persistSnapshot: (path: string) => persistSnapshot(path || defaultPath),
      loadSnapshot: (path: string) => loadSnapshot(path || defaultPath),
    };
  });

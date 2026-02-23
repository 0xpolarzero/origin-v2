import { Data, Effect } from "effect";

import { createAuditTransition } from "../domain/audit-transition";
import { createMemory, Memory } from "../domain/memory";
import { CoreRepository } from "../repositories/core-repository";

export class MemoryServiceError extends Data.TaggedError("MemoryServiceError")<{
  message: string;
}> {}

export interface UpsertMemoryInput {
  memoryId?: string;
  key: string;
  value: string;
  source: string;
  confidence: number;
  at?: Date;
}

const findMemoryByKey = (
  repository: CoreRepository,
  key: string,
): Effect.Effect<Memory | undefined> =>
  Effect.gen(function* () {
    const memories = yield* repository.listEntities<Memory>("memory");
    return memories.find((memory) => memory.key === key);
  });

export const upsertMemory = (
  repository: CoreRepository,
  input: UpsertMemoryInput,
): Effect.Effect<Memory, MemoryServiceError> =>
  Effect.gen(function* () {
    const at = input.at ?? new Date();

    const existingById = input.memoryId
      ? yield* repository.getEntity<Memory>("memory", input.memoryId)
      : undefined;

    const existing =
      existingById ?? (yield* findMemoryByKey(repository, input.key));

    const memory = existing
      ? {
          ...existing,
          key: input.key,
          value: input.value,
          source: input.source,
          confidence: input.confidence,
          updatedAt: at.toISOString(),
        }
      : yield* createMemory({
          id: input.memoryId,
          key: input.key,
          value: input.value,
          source: input.source,
          confidence: input.confidence,
          createdAt: at,
          updatedAt: at,
        }).pipe(
          Effect.mapError(
            (error) =>
              new MemoryServiceError({
                message: `failed to create memory: ${error.message}`,
              }),
          ),
        );

    yield* repository.saveEntity("memory", memory.id, memory);

    const transition = yield* createAuditTransition({
      entityType: "memory",
      entityId: memory.id,
      fromState: existing ? "upserted" : "none",
      toState: "upserted",
      actor: { id: "system:memory-service", kind: "system" },
      reason: existing ? "Memory updated" : "Memory created",
      at,
      metadata: {
        key: memory.key,
        source: memory.source,
      },
    }).pipe(
      Effect.mapError(
        (error) =>
          new MemoryServiceError({
            message: `failed to append memory transition: ${error.message}`,
          }),
      ),
    );

    yield* repository.appendAuditTransition(transition);

    return memory;
  });

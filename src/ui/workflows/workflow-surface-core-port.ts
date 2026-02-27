import { Effect } from "effect";

import { Memory } from "../../core/domain/memory";
import { UpsertMemoryInput } from "../../core/services/memory-service";

export interface WorkflowSurfaceCorePort {
  listEntities: <T>(entityType: string) => Effect.Effect<ReadonlyArray<T>, unknown>;
  getEntity: <T>(
    entityType: string,
    entityId: string,
  ) => Effect.Effect<T | undefined, unknown>;
  upsertMemory: (input: UpsertMemoryInput) => Effect.Effect<Memory, unknown>;
}

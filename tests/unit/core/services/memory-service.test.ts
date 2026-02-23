import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";
import { upsertMemory } from "../../../../src/core/services/memory-service";

describe("memory-service", () => {
  test("upsertMemory merges fact value and provenance", async () => {
    const repository = makeInMemoryCoreRepository();

    const first = await Effect.runPromise(
      upsertMemory(repository, {
        memoryId: "memory-1",
        key: "preferred_meeting_time",
        value: "Afternoons",
        source: "user",
        confidence: 0.8,
      }),
    );

    const second = await Effect.runPromise(
      upsertMemory(repository, {
        key: "preferred_meeting_time",
        value: "Mornings",
        source: "calendar",
        confidence: 0.9,
      }),
    );

    const memories = await Effect.runPromise(
      repository.listEntities<{
        key: string;
      }>("memory"),
    );

    expect(first.id).toBe("memory-1");
    expect(second.id).toBe("memory-1");
    expect(second.value).toBe("Mornings");
    expect(second.source).toBe("calendar");
    expect(second.confidence).toBe(0.9);
    expect(memories).toHaveLength(1);
  });
});

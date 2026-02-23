import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createMemory } from "../../../../src/core/domain/memory";

describe("createMemory", () => {
  test("seeds source and confidence metadata", async () => {
    const memory = await Effect.runPromise(
      createMemory({
        id: "memory-1",
        key: "preferred_meeting_time",
        value: "Afternoons",
        source: "user",
        confidence: 0.9,
      }),
    );

    expect(memory.id).toBe("memory-1");
    expect(memory.source).toBe("user");
    expect(memory.confidence).toBe(0.9);
  });
});

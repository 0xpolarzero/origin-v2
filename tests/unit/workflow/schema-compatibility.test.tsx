import { describe, expect, test } from "bun:test";

import { ralphOutputSchemas } from "super-ralph/schemas";

describe("ralph output schema compatibility", () => {
  test("discover schema accepts legacy tickets without optional file metadata", () => {
    expect(() =>
      ralphOutputSchemas.discover.parse({
        tickets: [
          {
            id: "CORE-REV-004",
            title: "Ticket",
            description: "Ticket description",
            category: "core",
            priority: "high",
          },
        ],
        reasoning: "legacy producer output",
        completionEstimate: "1 day",
      }),
    ).not.toThrow();
  });

  test("land schema accepts legacy payloads without eviction metadata", () => {
    const parsed = ralphOutputSchemas.land.parse({
      merged: true,
      mergeCommit: "abc123",
      ciPassed: true,
      summary: "merged",
    });

    expect(parsed.evicted).toBe(false);
    expect(parsed.evictionReason).toBeUndefined();
    expect(parsed.evictionDetails).toBeUndefined();
    expect(parsed.attemptedLog).toBeUndefined();
    expect(parsed.attemptedDiffSummary).toBeUndefined();
    expect(parsed.landedOnMainSinceBranch).toBeUndefined();
  });
});

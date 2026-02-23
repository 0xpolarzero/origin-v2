import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createEntry } from "../../../../src/core/domain/entry";

describe("createEntry", () => {
  test("sets captured defaults and audit metadata", async () => {
    const entry = await Effect.runPromise(
      createEntry({
        id: "entry-1",
        content: "Book dentist appointment",
        capturedAt: new Date("2026-02-23T08:00:00.000Z"),
        createdAt: new Date("2026-02-23T08:00:00.000Z"),
      }),
    );

    expect(entry.id).toBe("entry-1");
    expect(entry.content).toBe("Book dentist appointment");
    expect(entry.status).toBe("captured");
    expect(entry.source).toBe("manual");
    expect(entry.capturedAt).toBe("2026-02-23T08:00:00.000Z");
    expect(entry.createdAt).toBe("2026-02-23T08:00:00.000Z");
    expect(entry.updatedAt).toBe("2026-02-23T08:00:00.000Z");
  });
});

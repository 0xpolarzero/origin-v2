import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createEvent } from "../../../../src/core/domain/event";

describe("createEvent", () => {
  test("sets syncState=local_only", async () => {
    const event = await Effect.runPromise(
      createEvent({
        id: "event-1",
        title: "Dentist",
        startAt: new Date("2026-02-24T14:00:00.000Z"),
      }),
    );

    expect(event.id).toBe("event-1");
    expect(event.syncState).toBe("local_only");
    expect(event.startAt).toBe("2026-02-24T14:00:00.000Z");
  });
});

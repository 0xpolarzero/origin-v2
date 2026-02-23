import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createOutboundDraft } from "../../../../src/core/domain/outbound-draft";

describe("createOutboundDraft", () => {
  test("sets status=draft and lifecycle timestamps", async () => {
    const createdAt = new Date("2026-02-23T10:00:00.000Z");
    const updatedAt = new Date("2026-02-23T10:05:00.000Z");

    const draft = await Effect.runPromise(
      createOutboundDraft({
        id: "outbound-draft-1",
        payload: "Send proposal update",
        sourceSignalId: "signal-1",
        createdAt,
        updatedAt,
      }),
    );

    expect(draft.id).toBe("outbound-draft-1");
    expect(draft.status).toBe("draft");
    expect(draft.payload).toBe("Send proposal update");
    expect(draft.sourceSignalId).toBe("signal-1");
    expect(draft.createdAt).toBe("2026-02-23T10:00:00.000Z");
    expect(draft.updatedAt).toBe("2026-02-23T10:05:00.000Z");
    expect(draft.executionId).toBeUndefined();
  });
});

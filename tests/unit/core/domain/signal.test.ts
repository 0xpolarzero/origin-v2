import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createSignal } from "../../../../src/core/domain/signal";

describe("createSignal", () => {
  test("seeds triageState=untriaged", async () => {
    const signal = await Effect.runPromise(
      createSignal({
        id: "signal-1",
        source: "email",
        payload: "Client asked for updated timeline",
      }),
    );

    expect(signal.id).toBe("signal-1");
    expect(signal.triageState).toBe("untriaged");
  });
});

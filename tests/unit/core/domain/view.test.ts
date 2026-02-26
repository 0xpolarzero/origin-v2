import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createView } from "../../../../src/core/domain/view";

describe("createView", () => {
  test("persists filter/query schema safely", async () => {
    const filters = {
      status: "planned",
      includeEvents: true,
      daysAhead: 7,
    };

    const view = await Effect.runPromise(
      createView({
        id: "view-1",
        name: "This Week",
        query: "status:planned due<7d",
        filters,
      }),
    );

    expect(view.id).toBe("view-1");
    expect(view.filters).toEqual({
      status: "planned",
      includeEvents: true,
      daysAhead: 7,
    });
    expect(view.filters).not.toBe(filters);
  });
});

import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";
import { saveView } from "../../../../src/core/services/view-service";

describe("view-service", () => {
  test("saveView upserts saved query/filter", async () => {
    const repository = makeInMemoryCoreRepository();

    const created = await Effect.runPromise(
      saveView(repository, {
        viewId: "view-1",
        name: "This Week",
        query: "status:planned",
        filters: {
          status: "planned",
          daysAhead: 7,
        },
      }),
    );

    const updated = await Effect.runPromise(
      saveView(repository, {
        viewId: "view-1",
        name: "This Week",
        query: "status:planned due<3d",
        filters: {
          status: "planned",
          daysAhead: 3,
        },
      }),
    );

    const views = await Effect.runPromise(repository.listEntities("view"));

    expect(created.id).toBe("view-1");
    expect(updated.id).toBe("view-1");
    expect(updated.query).toBe("status:planned due<3d");
    expect(updated.filters).toEqual({ status: "planned", daysAhead: 3 });
    expect(views).toHaveLength(1);
  });
});

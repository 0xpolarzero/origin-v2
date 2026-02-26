import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";
import {
  getActivityView,
  getJobsView,
  saveActivityView,
  saveJobsView,
  saveView,
} from "../../../../src/core/services/view-service";

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

  test("saveView preserves existing filters when update omits filters", async () => {
    const repository = makeInMemoryCoreRepository();

    await Effect.runPromise(
      saveView(repository, {
        viewId: "view-preserve-filters-1",
        name: "Initial view",
        query: "status:planned",
        filters: {
          status: "planned",
          daysAhead: 7,
        },
      }),
    );

    const updated = await Effect.runPromise(
      saveView(repository, {
        viewId: "view-preserve-filters-1",
        name: "Updated view",
        query: "status:planned due<5d",
      }),
    );

    expect(updated.query).toBe("status:planned due<5d");
    expect(updated.filters).toEqual({
      status: "planned",
      daysAhead: 7,
    });
  });

  test("scoped Jobs/Activity views persist and load independent filters", async () => {
    const repository = makeInMemoryCoreRepository();

    await Effect.runPromise(
      saveJobsView(repository, {
        query: "runState:failed",
        filters: {
          runState: "failed",
          limit: 20,
        },
      }),
    );
    await Effect.runPromise(
      saveActivityView(repository, {
        query: "aiOnly:true entityType:checkpoint",
        filters: {
          aiOnly: true,
          entityType: "checkpoint",
        },
      }),
    );

    await Effect.runPromise(
      saveJobsView(repository, {
        query: "runState:retrying",
        filters: {
          runState: "retrying",
          limit: 10,
        },
      }),
    );

    const jobsView = await Effect.runPromise(getJobsView(repository));
    const activityView = await Effect.runPromise(getActivityView(repository));
    const allViews = await Effect.runPromise(repository.listEntities("view"));

    expect(jobsView?.query).toBe("runState:retrying");
    expect(jobsView?.filters).toEqual({
      runState: "retrying",
      limit: 10,
    });
    expect(activityView?.query).toBe("aiOnly:true entityType:checkpoint");
    expect(activityView?.filters).toEqual({
      aiOnly: true,
      entityType: "checkpoint",
    });
    expect(allViews).toHaveLength(2);
  });
});

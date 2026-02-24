import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { View } from "../../../../src/core/domain/view";
import {
  makeWorkflowSurfaceFiltersStore,
  WorkflowSurfaceViewPort,
} from "../../../../src/ui/workflows/workflow-surface-filters";

const makeViewPortStub = (
  initial: {
    jobsView?: View;
    activityView?: View;
  } = {},
): {
  viewPort: WorkflowSurfaceViewPort;
  calls: Array<{ method: string; input?: unknown }>;
  getState: () => { jobsView?: View; activityView?: View };
} => {
  const calls: Array<{ method: string; input?: unknown }> = [];
  const state: {
    jobsView?: View;
    activityView?: View;
  } = {
    jobsView: initial.jobsView,
    activityView: initial.activityView,
  };

  const viewPort: WorkflowSurfaceViewPort = {
    getJobsView: () =>
      Effect.sync(() => {
        calls.push({ method: "getJobsView" });
        return state.jobsView;
      }),
    saveJobsView: (input) =>
      Effect.sync(() => {
        calls.push({ method: "saveJobsView", input });
        const now = (input.at ?? new Date("2026-02-24T00:00:00.000Z")).toISOString();
        state.jobsView = {
          id: "view:workflow:jobs",
          name: input.name ?? "Jobs Filters",
          query: input.query,
          filters: { ...(input.filters ?? {}) },
          createdAt: state.jobsView?.createdAt ?? now,
          updatedAt: now,
        };
        return state.jobsView;
      }),
    getActivityView: () =>
      Effect.sync(() => {
        calls.push({ method: "getActivityView" });
        return state.activityView;
      }),
    saveActivityView: (input) =>
      Effect.sync(() => {
        calls.push({ method: "saveActivityView", input });
        const now = (input.at ?? new Date("2026-02-24T00:00:00.000Z")).toISOString();
        state.activityView = {
          id: "view:workflow:activity",
          name: input.name ?? "Activity Filters",
          query: input.query,
          filters: { ...(input.filters ?? {}) },
          createdAt: state.activityView?.createdAt ?? now,
          updatedAt: now,
        };
        return state.activityView;
      }),
  };

  return {
    viewPort,
    calls,
    getState: () => ({ ...state }),
  };
};

describe("workflow-surface-filters", () => {
  test("loadJobsFilters decodes saved date filters", async () => {
    const { viewPort } = makeViewPortStub({
      jobsView: {
        id: "view:workflow:jobs",
        name: "Jobs Filters",
        query: "runState:failed limit:10",
        filters: {
          runState: "failed",
          limit: 10,
          beforeUpdatedAt: "2026-02-23T10:00:00.000Z",
        },
        createdAt: "2026-02-23T09:00:00.000Z",
        updatedAt: "2026-02-23T09:00:00.000Z",
      },
    });
    const store = makeWorkflowSurfaceFiltersStore(viewPort);

    const filters = await Effect.runPromise(store.loadJobsFilters());

    expect(filters).toEqual({
      runState: "failed",
      limit: 10,
      beforeUpdatedAt: new Date("2026-02-23T10:00:00.000Z"),
    });
  });

  test("saveJobsFilters serializes Date and stores via scoped jobs view", async () => {
    const { viewPort, getState, calls } = makeViewPortStub();
    const store = makeWorkflowSurfaceFiltersStore(viewPort);

    await Effect.runPromise(
      store.saveJobsFilters({
        runState: "retrying",
        limit: 5,
        beforeUpdatedAt: new Date("2026-02-23T11:00:00.000Z"),
      }),
    );

    const savedView = getState().jobsView;
    expect(savedView?.filters).toEqual({
      runState: "retrying",
      limit: 5,
      beforeUpdatedAt: "2026-02-23T11:00:00.000Z",
    });
    expect(savedView?.query).toContain("runState:retrying");
    expect(calls.map((call) => call.method)).toEqual(["saveJobsView"]);
  });

  test("load/save activity filters round-trip aiOnly and beforeAt", async () => {
    const { viewPort } = makeViewPortStub();
    const store = makeWorkflowSurfaceFiltersStore(viewPort);

    await Effect.runPromise(
      store.saveActivityFilters({
        entityType: "checkpoint",
        entityId: "checkpoint-1",
        actorKind: "ai",
        aiOnly: true,
        limit: 20,
        beforeAt: new Date("2026-02-23T12:00:00.000Z"),
      }),
    );

    const loaded = await Effect.runPromise(store.loadActivityFilters());
    expect(loaded).toEqual({
      entityType: "checkpoint",
      entityId: "checkpoint-1",
      actorKind: "ai",
      aiOnly: true,
      limit: 20,
      beforeAt: new Date("2026-02-23T12:00:00.000Z"),
    });
  });
});

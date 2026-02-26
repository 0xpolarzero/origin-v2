import { Effect } from "effect";

import { ListActivityRequest, ListJobsRequest } from "../../api/workflows/contracts";
import { View, ViewFilters } from "../../core/domain/view";
import { SaveScopedViewInput } from "../../core/services/view-service";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isValidDate = (value: Date): boolean => !Number.isNaN(value.getTime());

const parseDateFilter = (value: unknown): Date | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = new Date(value);
  return isValidDate(parsed) ? parsed : undefined;
};

const toViewQuery = (scope: "jobs" | "activity", filters: ViewFilters): string => {
  const tokens = Object.entries(filters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${String(value)}`);

  return tokens.length > 0 ? tokens.join(" ") : `${scope}:all`;
};

const encodeJobsFilters = (filters: ListJobsRequest): ViewFilters => {
  const encoded: ViewFilters = {};

  if (filters.runState !== undefined) {
    encoded.runState = filters.runState;
  }

  if (filters.limit !== undefined) {
    encoded.limit = filters.limit;
  }

  if (filters.beforeUpdatedAt !== undefined) {
    encoded.beforeUpdatedAt = filters.beforeUpdatedAt.toISOString();
  }

  return encoded;
};

const decodeJobsFilters = (view: View | undefined): ListJobsRequest => {
  const filters = view?.filters;
  if (!isRecord(filters)) {
    return {};
  }

  const beforeUpdatedAt = parseDateFilter(filters.beforeUpdatedAt);
  const runState =
    filters.runState === "idle" ||
    filters.runState === "running" ||
    filters.runState === "succeeded" ||
    filters.runState === "failed" ||
    filters.runState === "retrying"
      ? filters.runState
      : undefined;

  const limit =
    typeof filters.limit === "number" &&
    Number.isFinite(filters.limit) &&
    Number.isInteger(filters.limit) &&
    filters.limit > 0
      ? filters.limit
      : undefined;

  return {
    runState,
    limit,
    beforeUpdatedAt,
  };
};

const encodeActivityFilters = (filters: ListActivityRequest): ViewFilters => {
  const encoded: ViewFilters = {};

  if (filters.entityType !== undefined) {
    encoded.entityType = filters.entityType;
  }

  if (filters.entityId !== undefined) {
    encoded.entityId = filters.entityId;
  }

  if (filters.actorKind !== undefined) {
    encoded.actorKind = filters.actorKind;
  }

  if (filters.aiOnly !== undefined) {
    encoded.aiOnly = filters.aiOnly;
  }

  if (filters.limit !== undefined) {
    encoded.limit = filters.limit;
  }

  if (filters.beforeAt !== undefined) {
    encoded.beforeAt = filters.beforeAt.toISOString();
  }

  return encoded;
};

const decodeActivityFilters = (view: View | undefined): ListActivityRequest => {
  const filters = view?.filters;
  if (!isRecord(filters)) {
    return {};
  }

  const actorKind =
    filters.actorKind === "user" ||
    filters.actorKind === "system" ||
    filters.actorKind === "ai"
      ? filters.actorKind
      : undefined;

  const limit =
    typeof filters.limit === "number" &&
    Number.isFinite(filters.limit) &&
    Number.isInteger(filters.limit) &&
    filters.limit > 0
      ? filters.limit
      : undefined;

  const aiOnly =
    typeof filters.aiOnly === "boolean" ? filters.aiOnly : undefined;

  const entityType =
    typeof filters.entityType === "string" ? filters.entityType : undefined;
  const entityId =
    typeof filters.entityId === "string" ? filters.entityId : undefined;

  return {
    entityType,
    entityId,
    actorKind,
    aiOnly,
    limit,
    beforeAt: parseDateFilter(filters.beforeAt),
  };
};

export interface WorkflowSurfaceViewPort {
  getJobsView: () => Effect.Effect<View | undefined, unknown>;
  saveJobsView: (input: SaveScopedViewInput) => Effect.Effect<View, unknown>;
  getActivityView: () => Effect.Effect<View | undefined, unknown>;
  saveActivityView: (
    input: SaveScopedViewInput,
  ) => Effect.Effect<View, unknown>;
}

export interface WorkflowSurfaceFiltersStore {
  loadJobsFilters: () => Effect.Effect<ListJobsRequest, unknown>;
  saveJobsFilters: (filters: ListJobsRequest) => Effect.Effect<void, unknown>;
  loadActivityFilters: () => Effect.Effect<ListActivityRequest, unknown>;
  saveActivityFilters: (
    filters: ListActivityRequest,
  ) => Effect.Effect<void, unknown>;
}

export const makeWorkflowSurfaceFiltersStore = (
  viewPort: WorkflowSurfaceViewPort,
): WorkflowSurfaceFiltersStore => ({
  loadJobsFilters: () =>
    viewPort.getJobsView().pipe(Effect.map((view) => decodeJobsFilters(view))),
  saveJobsFilters: (filters) => {
    const encoded = encodeJobsFilters(filters);

    return viewPort.saveJobsView({
      query: toViewQuery("jobs", encoded),
      filters: encoded,
    }).pipe(Effect.asVoid);
  },
  loadActivityFilters: () =>
    viewPort
      .getActivityView()
      .pipe(Effect.map((view) => decodeActivityFilters(view))),
  saveActivityFilters: (filters) => {
    const encoded = encodeActivityFilters(filters);

    return viewPort.saveActivityView({
      query: toViewQuery("activity", encoded),
      filters: encoded,
    }).pipe(Effect.asVoid);
  },
});

import { Data, Effect } from "effect";

import { ListActivityRequest } from "../../api/workflows/contracts";
import { Checkpoint } from "../../core/domain/checkpoint";
import { ActorRef } from "../../core/domain/common";
import { ActivityFeedItem } from "../../core/services/activity-service";
import {
  WorkflowSurfaceClient,
  WorkflowSurfaceClientError,
} from "./workflow-surface-client";
import { WorkflowSurfaceFiltersStore } from "./workflow-surface-filters";

export class ActivitySurfaceError extends Data.TaggedError(
  "ActivitySurfaceError",
)<{
  message: string;
  cause?: unknown;
}> {}

export interface ActivitySurfaceState {
  feed: ReadonlyArray<ActivityFeedItem>;
  filters: ListActivityRequest;
  selectedCheckpoint?: Checkpoint;
}

const toActivitySurfaceError = (
  error: unknown,
): ActivitySurfaceError => {
  if (error instanceof WorkflowSurfaceClientError) {
    return new ActivitySurfaceError({
      message: error.message,
      cause: error,
    });
  }

  const message = error instanceof Error ? error.message : String(error);
  return new ActivitySurfaceError({
    message,
    cause: error,
  });
};

export const loadActivitySurface = (
  client: WorkflowSurfaceClient,
  filtersStore: WorkflowSurfaceFiltersStore,
  input?: ListActivityRequest,
): Effect.Effect<ActivitySurfaceState, ActivitySurfaceError> =>
  Effect.gen(function* () {
    const filters = input ?? (yield* filtersStore.loadActivityFilters());

    if (input !== undefined) {
      yield* filtersStore.saveActivityFilters(filters);
    }

    const feed = yield* client.listActivity(filters);
    return {
      feed,
      filters: { ...filters },
    };
  }).pipe(Effect.mapError(toActivitySurfaceError));

export const inspectCheckpointFromActivity = (
  client: WorkflowSurfaceClient,
  state: ActivitySurfaceState,
  checkpointId: string,
): Effect.Effect<ActivitySurfaceState, ActivitySurfaceError> =>
  client.inspectWorkflowCheckpoint({ checkpointId }).pipe(
    Effect.map((selectedCheckpoint) => ({
      ...state,
      selectedCheckpoint,
    })),
    Effect.mapError(toActivitySurfaceError),
  );

export const keepCheckpointFromActivity = (
  client: WorkflowSurfaceClient,
  state: ActivitySurfaceState,
  input: {
    checkpointId: string;
    actor: ActorRef;
    at?: Date;
  },
): Effect.Effect<ActivitySurfaceState, ActivitySurfaceError> =>
  Effect.gen(function* () {
    yield* client.keepCheckpoint({
      checkpointId: input.checkpointId,
      actor: input.actor,
      at: input.at,
    });

    const selectedCheckpoint = yield* client.inspectWorkflowCheckpoint({
      checkpointId: input.checkpointId,
    });
    const feed = yield* client.listActivity(state.filters);

    return {
      ...state,
      selectedCheckpoint,
      feed,
    };
  }).pipe(Effect.mapError(toActivitySurfaceError));

export const recoverCheckpointFromActivity = (
  client: WorkflowSurfaceClient,
  state: ActivitySurfaceState,
  input: {
    checkpointId: string;
    actor: ActorRef;
    at?: Date;
  },
): Effect.Effect<ActivitySurfaceState, ActivitySurfaceError> =>
  Effect.gen(function* () {
    yield* client.recoverCheckpoint({
      checkpointId: input.checkpointId,
      actor: input.actor,
      at: input.at,
    });

    const selectedCheckpoint = yield* client.inspectWorkflowCheckpoint({
      checkpointId: input.checkpointId,
    });
    const feed = yield* client.listActivity(state.filters);

    return {
      ...state,
      selectedCheckpoint,
      feed,
    };
  }).pipe(Effect.mapError(toActivitySurfaceError));

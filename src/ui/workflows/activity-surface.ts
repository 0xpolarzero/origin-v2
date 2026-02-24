import { Data, Effect } from "effect";

import { ListActivityRequest } from "../../api/workflows/contracts";
import { Checkpoint } from "../../core/domain/checkpoint";
import { ActorRef } from "../../core/domain/common";
import { ActivityFeedItem } from "../../core/services/activity-service";
import {
  WorkflowSurfaceClient,
  WorkflowSurfaceClientError,
} from "./workflow-surface-client";

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
  error: WorkflowSurfaceClientError,
): ActivitySurfaceError =>
  new ActivitySurfaceError({
    message: error.message,
    cause: error,
  });

export const loadActivitySurface = (
  client: WorkflowSurfaceClient,
  input: ListActivityRequest = {},
): Effect.Effect<ActivitySurfaceState, ActivitySurfaceError> =>
  client.listActivity(input).pipe(
    Effect.map((feed) => ({
      feed,
      filters: { ...input },
    })),
    Effect.mapError(toActivitySurfaceError),
  );

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

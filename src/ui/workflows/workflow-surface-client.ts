import { Data, Effect } from "effect";

import {
  InspectJobRunRequest,
  InspectWorkflowCheckpointRequest,
  KeepCheckpointRequest,
  ListActivityRequest,
  ListJobsRequest,
  ListJobRunHistoryRequest,
  RecoverCheckpointRequest,
  RetryJobRequest,
  WorkflowRouteKey,
} from "../../api/workflows/contracts";
import {
  WorkflowHttpRequest,
  WorkflowHttpResponse,
} from "../../api/workflows/http-dispatch";
import { WORKFLOW_ROUTE_PATHS } from "../../api/workflows/routes";
import { Checkpoint } from "../../core/domain/checkpoint";
import { Job } from "../../core/domain/job";
import {
  RecoveryResult,
} from "../../core/services/checkpoint-service";
import { ActivityFeedItem } from "../../core/services/activity-service";
import {
  JobListItem,
  JobRunHistoryRecord,
  JobRunInspection,
} from "../../core/services/job-service";

export class WorkflowSurfaceClientError extends Data.TaggedError(
  "WorkflowSurfaceClientError",
)<{
  route: WorkflowRouteKey;
  status: number;
  message: string;
}> {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toErrorMessage = (
  route: WorkflowRouteKey,
  response: WorkflowHttpResponse,
): string => {
  if (isRecord(response.body) && typeof response.body.message === "string") {
    return response.body.message;
  }

  return `workflow route ${route} failed with status ${response.status}`;
};

const toDefectMessage = (route: WorkflowRouteKey, defect: unknown): string => {
  if (defect instanceof Error) {
    return defect.message;
  }

  return `workflow route ${route} dispatcher defect: ${String(defect)}`;
};

const callRoute = <Output>(
  dispatch: (request: WorkflowHttpRequest) => Effect.Effect<WorkflowHttpResponse, never>,
  route: WorkflowRouteKey,
  body: unknown,
): Effect.Effect<Output, WorkflowSurfaceClientError> =>
  Effect.try({
    try: () =>
      dispatch({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS[route],
        body,
      }),
    catch: (error) =>
      new WorkflowSurfaceClientError({
        route,
        status: 500,
        message: toDefectMessage(route, error),
      }),
  }).pipe(
    Effect.flatMap((responseEffect) => responseEffect),
    Effect.flatMap((response) => {
      if (response.status >= 200 && response.status <= 299) {
        return Effect.succeed(response.body as Output);
      }

      return Effect.fail(
        new WorkflowSurfaceClientError({
          route,
          status: response.status,
          message: toErrorMessage(route, response),
        }),
      );
    }),
    Effect.catchAllDefect((defect) =>
      Effect.fail(
        new WorkflowSurfaceClientError({
          route,
          status: 500,
          message: toDefectMessage(route, defect),
        }),
      ),
    ),
  );

export interface WorkflowSurfaceClient {
  listJobs: (
    input?: ListJobsRequest,
  ) => Effect.Effect<ReadonlyArray<JobListItem>, WorkflowSurfaceClientError>;
  inspectJobRun: (
    input: InspectJobRunRequest,
  ) => Effect.Effect<JobRunInspection, WorkflowSurfaceClientError>;
  listJobRunHistory: (
    input: ListJobRunHistoryRequest,
  ) => Effect.Effect<ReadonlyArray<JobRunHistoryRecord>, WorkflowSurfaceClientError>;
  retryJob: (
    input: RetryJobRequest,
  ) => Effect.Effect<Job, WorkflowSurfaceClientError>;
  listActivity: (
    input?: ListActivityRequest,
  ) => Effect.Effect<ReadonlyArray<ActivityFeedItem>, WorkflowSurfaceClientError>;
  inspectWorkflowCheckpoint: (
    input: InspectWorkflowCheckpointRequest,
  ) => Effect.Effect<Checkpoint, WorkflowSurfaceClientError>;
  keepCheckpoint: (
    input: KeepCheckpointRequest,
  ) => Effect.Effect<Checkpoint, WorkflowSurfaceClientError>;
  recoverCheckpoint: (
    input: RecoverCheckpointRequest,
  ) => Effect.Effect<RecoveryResult, WorkflowSurfaceClientError>;
}

export const makeWorkflowSurfaceClient = (
  dispatch: (request: WorkflowHttpRequest) => Effect.Effect<WorkflowHttpResponse, never>,
): WorkflowSurfaceClient => ({
  listJobs: (input = {}) => callRoute(dispatch, "job.list", input),
  inspectJobRun: (input) => callRoute(dispatch, "job.inspectRun", input),
  listJobRunHistory: (input) => callRoute(dispatch, "job.listHistory", input),
  retryJob: (input) => callRoute(dispatch, "job.retry", input),
  listActivity: (input = {}) => callRoute(dispatch, "activity.list", input),
  inspectWorkflowCheckpoint: (input) =>
    callRoute(dispatch, "checkpoint.inspect", input),
  keepCheckpoint: (input) => callRoute(dispatch, "checkpoint.keep", input),
  recoverCheckpoint: (input) => callRoute(dispatch, "checkpoint.recover", input),
});

import { Data, Effect } from "effect";

import { ListJobsRequest } from "../../api/workflows/contracts";
import { ActorRef } from "../../core/domain/common";
import {
  JobListItem,
  JobRunHistoryRecord,
  JobRunInspection,
} from "../../core/services/job-service";
import {
  WorkflowSurfaceClient,
  WorkflowSurfaceClientError,
} from "./workflow-surface-client";

export class JobsSurfaceError extends Data.TaggedError("JobsSurfaceError")<{
  message: string;
  cause?: unknown;
}> {}

export interface JobsSurfaceState {
  jobs: ReadonlyArray<JobListItem>;
  filters: ListJobsRequest;
  selectedJobId?: string;
  inspection?: JobRunInspection;
  history: ReadonlyArray<JobRunHistoryRecord>;
}

const toJobsSurfaceError = (error: WorkflowSurfaceClientError): JobsSurfaceError =>
  new JobsSurfaceError({
    message: error.message,
    cause: error,
  });

export const loadJobsSurface = (
  client: WorkflowSurfaceClient,
  input: ListJobsRequest = {},
): Effect.Effect<JobsSurfaceState, JobsSurfaceError> =>
  client.listJobs(input).pipe(
    Effect.map((jobs) => ({
      jobs,
      filters: { ...input },
      history: [],
    })),
    Effect.mapError(toJobsSurfaceError),
  );

export const inspectJobFromSurface = (
  client: WorkflowSurfaceClient,
  state: JobsSurfaceState,
  jobId: string,
): Effect.Effect<JobsSurfaceState, JobsSurfaceError> =>
  Effect.all({
    inspection: client.inspectJobRun({ jobId }),
    history: client.listJobRunHistory({ jobId }),
  }).pipe(
    Effect.map(({ inspection, history }) => ({
      ...state,
      selectedJobId: jobId,
      inspection,
      history,
    })),
    Effect.mapError(toJobsSurfaceError),
  );

export const retryJobFromSurface = (
  client: WorkflowSurfaceClient,
  state: JobsSurfaceState,
  input: {
    jobId: string;
    actor: ActorRef;
    at?: Date;
    fixSummary?: string;
  },
): Effect.Effect<JobsSurfaceState, JobsSurfaceError> =>
  Effect.gen(function* () {
    yield* client.retryJob({
      jobId: input.jobId,
      actor: input.actor,
      at: input.at,
      fixSummary: input.fixSummary,
    });

    const jobs = yield* client.listJobs(state.filters);
    const inspection = yield* client.inspectJobRun({ jobId: input.jobId });
    const history = yield* client.listJobRunHistory({ jobId: input.jobId });

    return {
      ...state,
      jobs,
      selectedJobId: input.jobId,
      inspection,
      history,
    };
  }).pipe(Effect.mapError(toJobsSurfaceError));

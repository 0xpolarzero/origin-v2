import { Data, Effect } from "effect";

import { createAuditTransition } from "../domain/audit-transition";
import { ActorRef } from "../domain/common";
import { Job } from "../domain/job";
import { CoreRepository } from "../repositories/core-repository";

export class JobServiceError extends Data.TaggedError("JobServiceError")<{
  message: string;
}> {}

export interface RecordJobRunInput {
  jobId: string;
  outcome: "succeeded" | "failed";
  diagnostics: string;
  actor: ActorRef;
  at?: Date;
}

export interface JobRunInspection {
  jobId: string;
  runState: Job["runState"];
  retryCount: number;
  diagnostics?: string;
  lastFailureReason?: string;
}

const loadJob = (
  repository: CoreRepository,
  jobId: string,
): Effect.Effect<Job, JobServiceError> =>
  Effect.gen(function* () {
    const job = yield* repository.getEntity<Job>("job", jobId);

    if (!job) {
      return yield* Effect.fail(
        new JobServiceError({ message: `job ${jobId} was not found` }),
      );
    }

    return job;
  });

export const recordJobRun = (
  repository: CoreRepository,
  input: RecordJobRunInput,
): Effect.Effect<Job, JobServiceError> =>
  Effect.gen(function* () {
    const job = yield* loadJob(repository, input.jobId);
    const at = input.at ?? new Date();
    const atIso = at.toISOString();

    const updated: Job = {
      ...job,
      runState: input.outcome,
      diagnostics: input.diagnostics,
      lastRunAt: atIso,
      lastSuccessAt: input.outcome === "succeeded" ? atIso : job.lastSuccessAt,
      lastFailureAt: input.outcome === "failed" ? atIso : job.lastFailureAt,
      lastFailureReason:
        input.outcome === "failed" ? input.diagnostics : job.lastFailureReason,
      updatedAt: atIso,
    };

    yield* repository.saveEntity("job", updated.id, updated);

    const transition = yield* createAuditTransition({
      entityType: "job",
      entityId: updated.id,
      fromState: job.runState,
      toState: updated.runState,
      actor: input.actor,
      reason: `Job run recorded (${input.outcome})`,
      at,
      metadata: {
        diagnostics: input.diagnostics,
      },
    }).pipe(
      Effect.mapError(
        (error) =>
          new JobServiceError({
            message: `failed to append job run transition: ${error.message}`,
          }),
      ),
    );

    yield* repository.appendAuditTransition(transition);

    return updated;
  });

export const retryJobRun = (
  repository: CoreRepository,
  jobId: string,
  actor: ActorRef,
  at: Date = new Date(),
): Effect.Effect<Job, JobServiceError> =>
  Effect.gen(function* () {
    const job = yield* loadJob(repository, jobId);
    const atIso = at.toISOString();

    const updated: Job = {
      ...job,
      runState: "retrying",
      retryCount: job.retryCount + 1,
      diagnostics: `Retry requested after failure: ${job.lastFailureReason ?? "unknown"}`,
      updatedAt: atIso,
    };

    yield* repository.saveEntity("job", updated.id, updated);

    const transition = yield* createAuditTransition({
      entityType: "job",
      entityId: updated.id,
      fromState: job.runState,
      toState: updated.runState,
      actor,
      reason: "Job retry requested",
      at,
      metadata: {
        previousFailure: job.lastFailureReason ?? "unknown",
      },
    }).pipe(
      Effect.mapError(
        (error) =>
          new JobServiceError({
            message: `failed to append job retry transition: ${error.message}`,
          }),
      ),
    );

    yield* repository.appendAuditTransition(transition);

    return updated;
  });

export const inspectJobRun = (
  repository: CoreRepository,
  jobId: string,
): Effect.Effect<JobRunInspection, JobServiceError> =>
  Effect.gen(function* () {
    const job = yield* loadJob(repository, jobId);
    return {
      jobId: job.id,
      runState: job.runState,
      retryCount: job.retryCount,
      diagnostics: job.diagnostics,
      lastFailureReason: job.lastFailureReason,
    };
  });

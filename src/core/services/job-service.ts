import { Data, Effect } from "effect";

import { createAuditTransition } from "../domain/audit-transition";
import { ActorKind, ActorRef, createId } from "../domain/common";
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

export interface JobRunHistoryRecord {
  id: string;
  jobId: string;
  outcome: "succeeded" | "failed";
  diagnostics: string;
  retryCount: number;
  actor: ActorRef;
  at: string;
  createdAt: string;
}

interface StoredJobRunHistoryRecord {
  id: string;
  jobId: string;
  outcome: "succeeded" | "failed";
  diagnostics: string;
  retryCount: number;
  actor: ActorRef;
  actorId: string;
  actorKind: ActorKind;
  at: string;
  createdAt: string;
}

const RUN_OUTCOMES: ReadonlyArray<JobRunHistoryRecord["outcome"]> = [
  "succeeded",
  "failed",
];
const ACTOR_KINDS: ReadonlyArray<ActorKind> = ["user", "system", "ai"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asActor = (value: unknown): ActorRef | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = value.id;
  const kind = value.kind;
  if (typeof id !== "string" || typeof kind !== "string") {
    return undefined;
  }

  if (!ACTOR_KINDS.includes(kind as ActorKind)) {
    return undefined;
  }

  return { id, kind: kind as ActorKind };
};

const toHistoryRecord = (value: unknown): JobRunHistoryRecord | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = value.id;
  const jobId = value.jobId;
  const outcome = value.outcome;
  const diagnostics = value.diagnostics;
  const retryCount = value.retryCount;
  const at = value.at;
  const createdAt = value.createdAt;

  if (
    typeof id !== "string" ||
    typeof jobId !== "string" ||
    typeof outcome !== "string" ||
    !RUN_OUTCOMES.includes(outcome as JobRunHistoryRecord["outcome"]) ||
    typeof diagnostics !== "string" ||
    typeof retryCount !== "number" ||
    !Number.isFinite(retryCount) ||
    typeof at !== "string" ||
    typeof createdAt !== "string"
  ) {
    return undefined;
  }

  const actor =
    asActor(value.actor) ??
    asActor({
      id: value.actorId,
      kind: value.actorKind,
    });
  if (!actor) {
    return undefined;
  }

  return {
    id,
    jobId,
    outcome: outcome as JobRunHistoryRecord["outcome"],
    diagnostics,
    retryCount,
    actor,
    at,
    createdAt,
  };
};

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

    const historyEntry: StoredJobRunHistoryRecord = {
      id: createId("job-run-history"),
      jobId: updated.id,
      outcome: input.outcome,
      diagnostics: input.diagnostics,
      retryCount: job.retryCount,
      actor: input.actor,
      actorId: input.actor.id,
      actorKind: input.actor.kind,
      at: atIso,
      createdAt: atIso,
    };
    yield* repository.saveEntity(
      "job_run_history",
      historyEntry.id,
      historyEntry,
    );

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

export const listJobRunHistory = (
  repository: CoreRepository,
  input: {
    jobId: string;
    limit?: number;
    beforeAt?: Date;
  },
): Effect.Effect<ReadonlyArray<JobRunHistoryRecord>, JobServiceError> =>
  Effect.gen(function* () {
    if (
      input.limit !== undefined &&
      (!Number.isInteger(input.limit) || input.limit <= 0)
    ) {
      return yield* Effect.fail(
        new JobServiceError({
          message: "limit must be a positive integer",
        }),
      );
    }

    yield* loadJob(repository, input.jobId);
    const beforeAtIso = input.beforeAt?.toISOString();

    const rawRows = yield* repository.listEntities<unknown>("job_run_history");
    const historyRows = rawRows
      .map((row) => toHistoryRecord(row))
      .filter(
        (row): row is JobRunHistoryRecord =>
          row !== undefined && row.jobId === input.jobId,
      )
      .filter((row) => beforeAtIso === undefined || row.at < beforeAtIso)
      .sort(
        (left, right) =>
          right.at.localeCompare(left.at) ||
          right.createdAt.localeCompare(left.createdAt) ||
          right.id.localeCompare(left.id),
      );

    if (input.limit === undefined) {
      return historyRows;
    }

    return historyRows.slice(0, input.limit);
  });

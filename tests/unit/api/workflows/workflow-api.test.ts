import { describe, expect, test } from "bun:test";
import { Either, Effect } from "effect";

import { CorePlatform } from "../../../../src/core/app/core-platform";
import {
  WorkflowApi,
  WorkflowRouteKey,
} from "../../../../src/api/workflows/contracts";
import { WorkflowApiError } from "../../../../src/api/workflows/errors";
import { ApprovalServiceError } from "../../../../src/core/services/approval-service";
import { CheckpointServiceError } from "../../../../src/core/services/checkpoint-service";
import { EntryServiceError } from "../../../../src/core/services/entry-service";
import { EventServiceError } from "../../../../src/core/services/event-service";
import { JobServiceError } from "../../../../src/core/services/job-service";
import { SignalServiceError } from "../../../../src/core/services/signal-service";
import { TaskTransitionError } from "../../../../src/core/services/task-service";
import { makeWorkflowApi } from "../../../../src/api/workflows/workflow-api";

const ACTOR = { id: "user-1", kind: "user" } as const;
const AT = new Date("2026-02-23T10:00:00.000Z");

const captureEntryInput = {
  entryId: "entry-api-1",
  content: "Draft quarterly update",
  actor: ACTOR,
  at: AT,
};
const suggestEntryInput = {
  entryId: "entry-api-1",
  suggestedTitle: "Draft and send quarterly update",
  actor: { id: "ai-1", kind: "ai" } as const,
  at: new Date("2026-02-23T10:01:00.000Z"),
};
const editSuggestionInput = {
  entryId: "entry-api-1",
  suggestedTitle: "Draft and send Q1 customer update",
  actor: ACTOR,
  at: new Date("2026-02-23T10:02:00.000Z"),
};
const rejectSuggestionInput = {
  entryId: "entry-api-1",
  reason: "No longer relevant",
  actor: ACTOR,
  at: new Date("2026-02-23T10:03:00.000Z"),
};
const acceptAsTaskInput = {
  entryId: "entry-api-1",
  taskId: "task-api-1",
  actor: ACTOR,
  at: new Date("2026-02-23T10:04:00.000Z"),
};
const ingestSignalInput = {
  signalId: "signal-api-1",
  source: "email",
  payload: "Please follow up",
  actor: ACTOR,
  at: new Date("2026-02-23T10:05:00.000Z"),
};
const triageSignalInput = {
  signalId: "signal-api-1",
  decision: "ready_for_conversion",
  actor: ACTOR,
  at: new Date("2026-02-23T10:06:00.000Z"),
};
const convertSignalInput = {
  signalId: "signal-api-1",
  targetType: "task" as const,
  targetId: "task-from-signal-1",
  actor: ACTOR,
  at: new Date("2026-02-23T10:07:00.000Z"),
};
const completeTaskInput = {
  taskId: "task-api-1",
  actor: ACTOR,
  at: new Date("2026-02-23T10:08:00.000Z"),
};
const deferTaskInput = {
  taskId: "task-api-1",
  until: new Date("2026-02-24T09:00:00.000Z"),
  actor: ACTOR,
  at: new Date("2026-02-23T10:09:00.000Z"),
};
const rescheduleTaskInput = {
  taskId: "task-api-1",
  nextAt: new Date("2026-02-24T11:00:00.000Z"),
  actor: ACTOR,
  at: new Date("2026-02-23T10:10:00.000Z"),
};
const requestEventSyncInput = {
  eventId: "event-api-1",
  actor: ACTOR,
  at: new Date("2026-02-23T10:11:00.000Z"),
};
const requestOutboundDraftExecutionInput = {
  draftId: "outbound-draft-api-1",
  actor: ACTOR,
  at: new Date("2026-02-23T10:12:00.000Z"),
};
const approveOutboundActionInput = {
  actionType: "event_sync" as const,
  entityType: "event",
  entityId: "event-api-1",
  approved: true,
  actor: ACTOR,
  at: new Date("2026-02-23T10:13:00.000Z"),
};
const createJobInput = {
  jobId: "job-api-1",
  name: "Daily workflow sweep",
  actor: { id: "system-1", kind: "system" } as const,
  at: new Date("2026-02-23T10:14:00.000Z"),
};
const recordJobRunInput = {
  jobId: "job-api-1",
  outcome: "failed" as const,
  diagnostics: "Timeout",
  actor: { id: "system-1", kind: "system" } as const,
  at: new Date("2026-02-23T10:15:00.000Z"),
};
const inspectJobRunInput = {
  jobId: "job-api-1",
};
const listJobsInput = {
  runState: "failed" as const,
  limit: 20,
  beforeUpdatedAt: new Date("2026-02-23T11:29:00.000Z"),
};
const listJobRunHistoryInput = {
  jobId: "job-api-1",
  limit: 20,
  beforeAt: new Date("2026-02-23T11:30:00.000Z"),
};
const retryJobInput = {
  jobId: "job-api-1",
  actor: ACTOR,
  at: new Date("2026-02-23T10:16:00.000Z"),
  fixSummary: "Increase timeout and retry",
};
const createCheckpointInput = {
  checkpointId: "checkpoint-api-1",
  name: "Before AI update",
  snapshotEntityRefs: [{ entityType: "task" as const, entityId: "task-api-1" }],
  auditCursor: 4,
  rollbackTarget: "audit-4",
  actor: ACTOR,
  at: new Date("2026-02-23T10:17:00.000Z"),
};
const keepCheckpointInput = {
  checkpointId: "checkpoint-api-1",
  actor: ACTOR,
  at: new Date("2026-02-23T10:18:00.000Z"),
};
const inspectCheckpointInput = {
  checkpointId: "checkpoint-api-1",
};
const recoverCheckpointInput = {
  checkpointId: "checkpoint-api-1",
  actor: ACTOR,
  at: new Date("2026-02-23T10:19:00.000Z"),
};
const listActivityInput = {
  entityType: "job",
  entityId: "job-api-1",
  actorKind: "ai" as const,
  aiOnly: true,
  limit: 20,
  beforeAt: new Date("2026-02-23T11:31:00.000Z"),
};

interface HandlerCase {
  name: keyof WorkflowApi;
  route: WorkflowRouteKey;
  invoke: (api: WorkflowApi) => Effect.Effect<unknown, WorkflowApiError>;
  expectedArgs: ReadonlyArray<unknown>;
  setMethod: (
    impl: (...args: ReadonlyArray<unknown>) => Effect.Effect<unknown, unknown>,
  ) => Record<string, unknown>;
}

const HANDLER_CASES: ReadonlyArray<HandlerCase> = [
  {
    name: "captureEntry",
    route: "capture.entry",
    invoke: (api) => api.captureEntry(captureEntryInput),
    expectedArgs: [captureEntryInput],
    setMethod: (impl) => ({
      captureEntry: (input: unknown) => impl(input),
    }),
  },
  {
    name: "suggestEntryAsTask",
    route: "capture.suggest",
    invoke: (api) => api.suggestEntryAsTask(suggestEntryInput),
    expectedArgs: [suggestEntryInput],
    setMethod: (impl) => ({
      suggestEntryAsTask: (input: unknown) => impl(input),
    }),
  },
  {
    name: "editEntrySuggestion",
    route: "capture.editSuggestion",
    invoke: (api) => api.editEntrySuggestion(editSuggestionInput),
    expectedArgs: [editSuggestionInput],
    setMethod: (impl) => ({
      editEntrySuggestion: (input: unknown) => impl(input),
    }),
  },
  {
    name: "rejectEntrySuggestion",
    route: "capture.rejectSuggestion",
    invoke: (api) => api.rejectEntrySuggestion(rejectSuggestionInput),
    expectedArgs: [rejectSuggestionInput],
    setMethod: (impl) => ({
      rejectEntrySuggestion: (input: unknown) => impl(input),
    }),
  },
  {
    name: "acceptEntryAsTask",
    route: "capture.acceptAsTask",
    invoke: (api) => api.acceptEntryAsTask(acceptAsTaskInput),
    expectedArgs: [acceptAsTaskInput],
    setMethod: (impl) => ({
      acceptEntryAsTask: (input: unknown) => impl(input),
    }),
  },
  {
    name: "ingestSignal",
    route: "signal.ingest",
    invoke: (api) => api.ingestSignal(ingestSignalInput),
    expectedArgs: [ingestSignalInput],
    setMethod: (impl) => ({
      ingestSignal: (input: unknown) => impl(input),
    }),
  },
  {
    name: "triageSignal",
    route: "signal.triage",
    invoke: (api) => api.triageSignal(triageSignalInput),
    expectedArgs: [
      triageSignalInput.signalId,
      triageSignalInput.decision,
      triageSignalInput.actor,
      triageSignalInput.at,
    ],
    setMethod: (impl) => ({
      triageSignal: (
        signalId: string,
        decision: string,
        actor: unknown,
        at: Date,
      ) => impl(signalId, decision, actor, at),
    }),
  },
  {
    name: "convertSignal",
    route: "signal.convert",
    invoke: (api) => api.convertSignal(convertSignalInput),
    expectedArgs: [convertSignalInput],
    setMethod: (impl) => ({
      convertSignal: (input: unknown) => impl(input),
    }),
  },
  {
    name: "completeTask",
    route: "planning.completeTask",
    invoke: (api) => api.completeTask(completeTaskInput),
    expectedArgs: [
      completeTaskInput.taskId,
      completeTaskInput.actor,
      completeTaskInput.at,
    ],
    setMethod: (impl) => ({
      completeTask: (taskId: string, actor: unknown, at: Date) =>
        impl(taskId, actor, at),
    }),
  },
  {
    name: "deferTask",
    route: "planning.deferTask",
    invoke: (api) => api.deferTask(deferTaskInput),
    expectedArgs: [
      deferTaskInput.taskId,
      deferTaskInput.until,
      deferTaskInput.actor,
      deferTaskInput.at,
    ],
    setMethod: (impl) => ({
      deferTask: (taskId: string, until: Date, actor: unknown, at: Date) =>
        impl(taskId, until, actor, at),
    }),
  },
  {
    name: "rescheduleTask",
    route: "planning.rescheduleTask",
    invoke: (api) => api.rescheduleTask(rescheduleTaskInput),
    expectedArgs: [
      rescheduleTaskInput.taskId,
      rescheduleTaskInput.nextAt,
      rescheduleTaskInput.actor,
      rescheduleTaskInput.at,
    ],
    setMethod: (impl) => ({
      rescheduleTask: (
        taskId: string,
        nextAt: Date,
        actor: unknown,
        at: Date,
      ) => impl(taskId, nextAt, actor, at),
    }),
  },
  {
    name: "requestEventSync",
    route: "approval.requestEventSync",
    invoke: (api) => api.requestEventSync(requestEventSyncInput),
    expectedArgs: [
      requestEventSyncInput.eventId,
      requestEventSyncInput.actor,
      requestEventSyncInput.at,
    ],
    setMethod: (impl) => ({
      requestEventSync: (eventId: string, actor: unknown, at: Date) =>
        impl(eventId, actor, at),
    }),
  },
  {
    name: "requestOutboundDraftExecution",
    route: "approval.requestOutboundDraftExecution",
    invoke: (api) =>
      api.requestOutboundDraftExecution(requestOutboundDraftExecutionInput),
    expectedArgs: [
      requestOutboundDraftExecutionInput.draftId,
      requestOutboundDraftExecutionInput.actor,
      requestOutboundDraftExecutionInput.at,
    ],
    setMethod: (impl) => ({
      requestOutboundDraftExecution: (
        draftId: string,
        actor: unknown,
        at: Date,
      ) => impl(draftId, actor, at),
    }),
  },
  {
    name: "approveOutboundAction",
    route: "approval.approveOutboundAction",
    invoke: (api) => api.approveOutboundAction(approveOutboundActionInput),
    expectedArgs: [approveOutboundActionInput],
    setMethod: (impl) => ({
      approveOutboundAction: (input: unknown) => impl(input),
    }),
  },
  {
    name: "createJob",
    route: "job.create",
    invoke: (api) => api.createJob(createJobInput),
    expectedArgs: [createJobInput],
    setMethod: (impl) => ({
      createJob: (input: unknown) => impl(input),
    }),
  },
  {
    name: "recordJobRun",
    route: "job.recordRun",
    invoke: (api) => api.recordJobRun(recordJobRunInput),
    expectedArgs: [recordJobRunInput],
    setMethod: (impl) => ({
      recordJobRun: (input: unknown) => impl(input),
    }),
  },
  {
    name: "inspectJobRun",
    route: "job.inspectRun",
    invoke: (api) => api.inspectJobRun(inspectJobRunInput),
    expectedArgs: [inspectJobRunInput.jobId],
    setMethod: (impl) => ({
      inspectJobRun: (jobId: string) => impl(jobId),
    }),
  },
  {
    name: "listJobs",
    route: "job.list",
    invoke: (api) => api.listJobs(listJobsInput),
    expectedArgs: [listJobsInput],
    setMethod: (impl) => ({
      listJobs: (options: unknown) => impl(options),
    }),
  },
  {
    name: "listJobRunHistory",
    route: "job.listHistory",
    invoke: (api) => api.listJobRunHistory(listJobRunHistoryInput),
    expectedArgs: [
      listJobRunHistoryInput.jobId,
      {
        limit: listJobRunHistoryInput.limit,
        beforeAt: listJobRunHistoryInput.beforeAt,
      },
    ],
    setMethod: (impl) => ({
      listJobRunHistory: (
        jobId: string,
        options: { limit?: number; beforeAt?: Date },
      ) => impl(jobId, options),
    }),
  },
  {
    name: "retryJob",
    route: "job.retry",
    invoke: (api) => api.retryJob(retryJobInput),
    expectedArgs: [
      retryJobInput.jobId,
      retryJobInput.actor,
      retryJobInput.at,
      retryJobInput.fixSummary,
    ],
    setMethod: (impl) => ({
      retryJob: (
        jobId: string,
        actor: unknown,
        at: Date,
        fixSummary?: string,
      ) => impl(jobId, actor, at, fixSummary),
    }),
  },
  {
    name: "createWorkflowCheckpoint",
    route: "checkpoint.create",
    invoke: (api) => api.createWorkflowCheckpoint(createCheckpointInput),
    expectedArgs: [createCheckpointInput],
    setMethod: (impl) => ({
      createWorkflowCheckpoint: (input: unknown) => impl(input),
    }),
  },
  {
    name: "keepCheckpoint",
    route: "checkpoint.keep",
    invoke: (api) => api.keepCheckpoint(keepCheckpointInput),
    expectedArgs: [
      keepCheckpointInput.checkpointId,
      keepCheckpointInput.actor,
      keepCheckpointInput.at,
    ],
    setMethod: (impl) => ({
      keepCheckpoint: (checkpointId: string, actor: unknown, at: Date) =>
        impl(checkpointId, actor, at),
    }),
  },
  {
    name: "inspectWorkflowCheckpoint",
    route: "checkpoint.inspect",
    invoke: (api) => api.inspectWorkflowCheckpoint(inspectCheckpointInput),
    expectedArgs: [inspectCheckpointInput.checkpointId],
    setMethod: (impl) => ({
      inspectWorkflowCheckpoint: (checkpointId: string) => impl(checkpointId),
    }),
  },
  {
    name: "recoverCheckpoint",
    route: "checkpoint.recover",
    invoke: (api) => api.recoverCheckpoint(recoverCheckpointInput),
    expectedArgs: [
      recoverCheckpointInput.checkpointId,
      recoverCheckpointInput.actor,
      recoverCheckpointInput.at,
    ],
    setMethod: (impl) => ({
      recoverCheckpoint: (checkpointId: string, actor: unknown, at: Date) =>
        impl(checkpointId, actor, at),
    }),
  },
  {
    name: "listActivity",
    route: "activity.list",
    invoke: (api) => api.listActivity(listActivityInput),
    expectedArgs: [listActivityInput],
    setMethod: (impl) => ({
      listActivityFeed: (options: unknown) => impl(options),
    }),
  },
];

const makePlatformStub = (methods: Record<string, unknown>): CorePlatform =>
  methods as unknown as CorePlatform;

describe("api/workflows/workflow-api", () => {
  test("makeWorkflowApi returns all required workflow handlers", () => {
    const api = makeWorkflowApi({
      platform: makePlatformStub({}),
    });

    expect(Object.keys(api).sort()).toEqual([
      "acceptEntryAsTask",
      "approveOutboundAction",
      "captureEntry",
      "completeTask",
      "convertSignal",
      "createJob",
      "createWorkflowCheckpoint",
      "deferTask",
      "editEntrySuggestion",
      "ingestSignal",
      "inspectJobRun",
      "inspectWorkflowCheckpoint",
      "keepCheckpoint",
      "listActivity",
      "listJobRunHistory",
      "listJobs",
      "recordJobRun",
      "recoverCheckpoint",
      "rejectEntrySuggestion",
      "requestEventSync",
      "requestOutboundDraftExecution",
      "rescheduleTask",
      "retryJob",
      "suggestEntryAsTask",
      "triageSignal",
    ]);
  });

  for (const handlerCase of HANDLER_CASES) {
    test(`${handlerCase.name} delegates to matching CorePlatform method`, async () => {
      const capturedCalls: Array<ReadonlyArray<unknown>> = [];
      const expected = { handler: handlerCase.name };

      const platform = makePlatformStub(
        handlerCase.setMethod((...args) =>
          Effect.sync(() => {
            capturedCalls.push(args);
            return expected;
          }),
        ),
      );

      const api = makeWorkflowApi({ platform });
      const result = await Effect.runPromise(handlerCase.invoke(api));

      expect(result).toEqual(expected);
      expect(capturedCalls).toHaveLength(1);
      expect(capturedCalls[0]).toEqual(handlerCase.expectedArgs);
    });

    test(`${handlerCase.name} maps platform failures into WorkflowApiError`, async () => {
      const errorMessage = `failed:${handlerCase.route}`;
      const platform = makePlatformStub(
        handlerCase.setMethod(() => Effect.fail(new Error(errorMessage))),
      );

      const api = makeWorkflowApi({ platform });
      const result = await Effect.runPromise(
        Effect.either(handlerCase.invoke(api)),
      );

      expect(Either.isLeft(result)).toBe(true);

      if (Either.isLeft(result)) {
        expect(result.left).toMatchObject({
          _tag: "WorkflowApiError",
          route: handlerCase.route,
          message: errorMessage,
          code: "unknown",
          statusCode: 400,
        });
      }
    });

    test(`${handlerCase.name} maps synchronous throws into WorkflowApiError`, async () => {
      const errorMessage = `thrown:${handlerCase.route}`;
      const platform = makePlatformStub(
        handlerCase.setMethod(() => {
          throw new Error(errorMessage);
        }),
      );

      const api = makeWorkflowApi({ platform });
      const result = await Effect.runPromise(
        Effect.either(handlerCase.invoke(api)),
      );

      expect(Either.isLeft(result)).toBe(true);

      if (Either.isLeft(result)) {
        expect(result.left).toMatchObject({
          _tag: "WorkflowApiError",
          route: handlerCase.route,
          message: errorMessage,
          code: "unknown",
          statusCode: 400,
        });
      }
    });

    test(`${handlerCase.name} maps defects into WorkflowApiError`, async () => {
      const errorMessage = `defect:${handlerCase.route}`;
      const platform = makePlatformStub(
        handlerCase.setMethod(() => Effect.die(new Error(errorMessage))),
      );

      const api = makeWorkflowApi({ platform });
      const result = await Effect.runPromise(
        Effect.either(handlerCase.invoke(api)),
      );

      expect(Either.isLeft(result)).toBe(true);

      if (Either.isLeft(result)) {
        expect(result.left).toMatchObject({
          _tag: "WorkflowApiError",
          route: handlerCase.route,
          message: errorMessage,
          code: "unknown",
          statusCode: 400,
        });
      }
    });

    test(`${handlerCase.name} preserves pre-mapped WorkflowApiError failures`, async () => {
      const expectedError = new WorkflowApiError({
        route: handlerCase.route,
        message: `pre-mapped:${handlerCase.route}`,
        code: "validation",
        statusCode: 400,
      });
      const platform = makePlatformStub(
        handlerCase.setMethod(() => Effect.fail(expectedError)),
      );

      const api = makeWorkflowApi({ platform });
      const result = await Effect.runPromise(
        Effect.either(handlerCase.invoke(api)),
      );

      expect(Either.isLeft(result)).toBe(true);

      if (Either.isLeft(result)) {
        expect(result.left).toBe(expectedError);
      }
    });
  }

  test("workflow handlers preserve forbidden/conflict metadata from service failures", async () => {
    const platform = makePlatformStub({
      requestEventSync: () =>
        Effect.fail(
          new EventServiceError({
            message:
              "event event-api-1 must be local_only before requesting sync",
            code: "conflict",
          }),
        ),
      approveOutboundAction: () =>
        Effect.fail(
          new ApprovalServiceError({
            message: "only user actors may approve outbound actions",
            code: "forbidden",
          }),
        ),
    });

    const api = makeWorkflowApi({ platform });
    const syncResult = await Effect.runPromise(
      Effect.either(api.requestEventSync(requestEventSyncInput)),
    );
    const approvalResult = await Effect.runPromise(
      Effect.either(api.approveOutboundAction(approveOutboundActionInput)),
    );

    expect(Either.isLeft(syncResult)).toBe(true);
    if (Either.isLeft(syncResult)) {
      expect(syncResult.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "approval.requestEventSync",
        code: "conflict",
        statusCode: 409,
      });
    }

    expect(Either.isLeft(approvalResult)).toBe(true);
    if (Either.isLeft(approvalResult)) {
      expect(approvalResult.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "approval.approveOutboundAction",
        code: "forbidden",
        statusCode: 403,
      });
    }
  });

  test("retryJob preserves mapped JobServiceError metadata", async () => {
    const platform = makePlatformStub({
      retryJob: () =>
        Effect.fail(
          new JobServiceError({
            message: "job job-api-404 was not found",
            code: "not_found",
          }),
        ),
    });
    const api = makeWorkflowApi({ platform });

    const result = await Effect.runPromise(
      Effect.either(api.retryJob(retryJobInput)),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "job.retry",
        code: "not_found",
        statusCode: 404,
        message: "job job-api-404 was not found",
      });
    }
  });

  test("capture.suggest/planning.completeTask/signal.triage preserve not_found mapping and signal.convert preserves conflict mapping", async () => {
    const platform = makePlatformStub({
      suggestEntryAsTask: () =>
        Effect.fail(
          new EntryServiceError({
            message: "entry entry-api-404 was not found",
            code: "not_found",
          }),
        ),
      completeTask: () =>
        Effect.fail(
          new TaskTransitionError({
            message: "task task-api-404 was not found",
            code: "not_found",
          }),
        ),
      triageSignal: () =>
        Effect.fail(
          new SignalServiceError({
            message: "signal signal-api-404 was not found",
            code: "not_found",
          }),
        ),
      convertSignal: () =>
        Effect.fail(
          new SignalServiceError({
            message: "signal signal-api-1 must be triaged before conversion",
            code: "conflict",
          }),
        ),
    });
    const api = makeWorkflowApi({ platform });

    const suggestResult = await Effect.runPromise(
      Effect.either(api.suggestEntryAsTask(suggestEntryInput)),
    );
    const completeResult = await Effect.runPromise(
      Effect.either(api.completeTask(completeTaskInput)),
    );
    const triageResult = await Effect.runPromise(
      Effect.either(api.triageSignal(triageSignalInput)),
    );
    const convertResult = await Effect.runPromise(
      Effect.either(api.convertSignal(convertSignalInput)),
    );

    expect(Either.isLeft(suggestResult)).toBe(true);
    if (Either.isLeft(suggestResult)) {
      expect(suggestResult.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "capture.suggest",
        code: "not_found",
        statusCode: 404,
        message: "entry entry-api-404 was not found",
      });
    }

    expect(Either.isLeft(completeResult)).toBe(true);
    if (Either.isLeft(completeResult)) {
      expect(completeResult.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "planning.completeTask",
        code: "not_found",
        statusCode: 404,
        message: "task task-api-404 was not found",
      });
    }

    expect(Either.isLeft(triageResult)).toBe(true);
    if (Either.isLeft(triageResult)) {
      expect(triageResult.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "signal.triage",
        code: "not_found",
        statusCode: 404,
        message: "signal signal-api-404 was not found",
      });
    }

    expect(Either.isLeft(convertResult)).toBe(true);
    if (Either.isLeft(convertResult)) {
      expect(convertResult.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "signal.convert",
        code: "conflict",
        statusCode: 409,
        message: "signal signal-api-1 must be triaged before conversion",
      });
    }
  });

  test("checkpoint handlers preserve mapped CheckpointServiceError metadata", async () => {
    const platform = makePlatformStub({
      keepCheckpoint: () =>
        Effect.fail(
          new CheckpointServiceError({
            message: "checkpoint checkpoint-404 was not found",
            code: "not_found",
          }),
        ),
      recoverCheckpoint: () =>
        Effect.fail(
          new CheckpointServiceError({
            message:
              "checkpoint checkpoint-1 cannot transition recovered -> recovered",
            code: "conflict",
          }),
        ),
    });
    const api = makeWorkflowApi({ platform });

    const keepResult = await Effect.runPromise(
      Effect.either(api.keepCheckpoint(keepCheckpointInput)),
    );
    const recoverResult = await Effect.runPromise(
      Effect.either(api.recoverCheckpoint(recoverCheckpointInput)),
    );

    expect(Either.isLeft(keepResult)).toBe(true);
    if (Either.isLeft(keepResult)) {
      expect(keepResult.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "checkpoint.keep",
        code: "not_found",
        statusCode: 404,
        message: "checkpoint checkpoint-404 was not found",
      });
    }

    expect(Either.isLeft(recoverResult)).toBe(true);
    if (Either.isLeft(recoverResult)) {
      expect(recoverResult.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "checkpoint.recover",
        code: "conflict",
        statusCode: 409,
        message:
          "checkpoint checkpoint-1 cannot transition recovered -> recovered",
      });
    }
  });
});

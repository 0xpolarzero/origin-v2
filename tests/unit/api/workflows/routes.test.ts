import { describe, expect, test } from "bun:test";
import { Either, Effect } from "effect";

import {
  WorkflowApi,
  WorkflowRouteKey,
} from "../../../../src/api/workflows/contracts";
import {
  makeWorkflowRoutes,
  WORKFLOW_ROUTE_PATHS,
} from "../../../../src/api/workflows/routes";

const ACTOR = { id: "user-1", kind: "user" } as const;
const AT = new Date("2026-02-23T10:00:00.000Z");

const REQUIRED_ROUTE_KEYS: ReadonlyArray<WorkflowRouteKey> = [
  "capture.entry",
  "capture.suggest",
  "capture.editSuggestion",
  "capture.rejectSuggestion",
  "capture.acceptAsTask",
  "signal.ingest",
  "signal.triage",
  "signal.convert",
  "planning.completeTask",
  "planning.deferTask",
  "planning.rescheduleTask",
  "approval.requestEventSync",
  "approval.requestOutboundDraftExecution",
  "approval.approveOutboundAction",
  "job.create",
  "job.recordRun",
  "job.inspectRun",
  "job.listHistory",
  "job.retry",
  "checkpoint.create",
  "checkpoint.keep",
  "checkpoint.recover",
];

const VALID_ROUTE_INPUTS: Record<WorkflowRouteKey, unknown> = {
  "capture.entry": {
    entryId: "entry-route-1",
    content: "Capture content",
    actor: ACTOR,
    at: AT,
  },
  "capture.suggest": {
    entryId: "entry-route-1",
    suggestedTitle: "Turn this into a task",
    actor: ACTOR,
    at: AT,
  },
  "capture.editSuggestion": {
    entryId: "entry-route-1",
    suggestedTitle: "Refined suggestion",
    actor: ACTOR,
    at: AT,
  },
  "capture.rejectSuggestion": {
    entryId: "entry-route-1",
    reason: "Not relevant",
    actor: ACTOR,
    at: AT,
  },
  "capture.acceptAsTask": {
    entryId: "entry-route-1",
    taskId: "task-route-1",
    actor: ACTOR,
    at: AT,
  },
  "signal.ingest": {
    signalId: "signal-route-1",
    source: "email",
    payload: "Follow up with account",
    actor: ACTOR,
    at: AT,
  },
  "signal.triage": {
    signalId: "signal-route-1",
    decision: "ready_for_conversion",
    actor: ACTOR,
    at: AT,
  },
  "signal.convert": {
    signalId: "signal-route-1",
    targetType: "task",
    targetId: "task-from-signal-1",
    actor: ACTOR,
    at: AT,
  },
  "planning.completeTask": {
    taskId: "task-route-1",
    actor: ACTOR,
    at: AT,
  },
  "planning.deferTask": {
    taskId: "task-route-1",
    until: new Date("2026-02-24T10:00:00.000Z"),
    actor: ACTOR,
    at: AT,
  },
  "planning.rescheduleTask": {
    taskId: "task-route-1",
    nextAt: new Date("2026-02-24T12:00:00.000Z"),
    actor: ACTOR,
    at: AT,
  },
  "approval.requestEventSync": {
    eventId: "event-route-1",
    actor: ACTOR,
    at: AT,
  },
  "approval.requestOutboundDraftExecution": {
    draftId: "draft-route-1",
    actor: ACTOR,
    at: AT,
  },
  "approval.approveOutboundAction": {
    actionType: "event_sync",
    entityType: "event",
    entityId: "event-route-1",
    approved: true,
    actor: ACTOR,
    at: AT,
  },
  "job.create": {
    jobId: "job-route-1",
    name: "Workflow sweep",
    actor: { id: "system-1", kind: "system" } as const,
    at: AT,
  },
  "job.recordRun": {
    jobId: "job-route-1",
    outcome: "failed",
    diagnostics: "timeout",
    actor: { id: "system-1", kind: "system" } as const,
    at: AT,
  },
  "job.inspectRun": {
    jobId: "job-route-1",
  },
  "job.listHistory": {
    jobId: "job-route-1",
    limit: 10,
    beforeAt: new Date("2026-02-24T00:00:00.000Z"),
  },
  "job.retry": {
    jobId: "job-route-1",
    actor: ACTOR,
    at: AT,
  },
  "checkpoint.create": {
    checkpointId: "checkpoint-route-1",
    name: "Before conversion",
    snapshotEntityRefs: [{ entityType: "task", entityId: "task-route-1" }],
    auditCursor: 1,
    rollbackTarget: "audit-1",
    actor: ACTOR,
    at: AT,
  },
  "checkpoint.keep": {
    checkpointId: "checkpoint-route-1",
    actor: ACTOR,
    at: AT,
  },
  "checkpoint.recover": {
    checkpointId: "checkpoint-route-1",
    actor: ACTOR,
    at: AT,
  },
};

const makeApiStub = (): WorkflowApi => ({
  captureEntry: (_input) => Effect.die("unused"),
  suggestEntryAsTask: (_input) => Effect.die("unused"),
  editEntrySuggestion: (_input) => Effect.die("unused"),
  rejectEntrySuggestion: (_input) => Effect.die("unused"),
  acceptEntryAsTask: (_input) => Effect.die("unused"),
  ingestSignal: (_input) => Effect.die("unused"),
  triageSignal: (_input) => Effect.die("unused"),
  convertSignal: (_input) => Effect.die("unused"),
  completeTask: (_input) => Effect.die("unused"),
  deferTask: (_input) => Effect.die("unused"),
  rescheduleTask: (_input) => Effect.die("unused"),
  requestEventSync: (_input) => Effect.die("unused"),
  requestOutboundDraftExecution: (_input) => Effect.die("unused"),
  approveOutboundAction: (_input) => Effect.die("unused"),
  createJob: (_input) => Effect.die("unused"),
  recordJobRun: (_input) => Effect.die("unused"),
  inspectJobRun: (_input) => Effect.die("unused"),
  listJobRunHistory: (_input) => Effect.die("unused"),
  retryJob: (_input) => Effect.die("unused"),
  createWorkflowCheckpoint: (_input) => Effect.die("unused"),
  keepCheckpoint: (_input) => Effect.die("unused"),
  recoverCheckpoint: (_input) => Effect.die("unused"),
});

const makeApiSpy = (
  onCall: (route: WorkflowRouteKey, input: unknown) => void,
): WorkflowApi =>
  ({
    captureEntry: (input: unknown) =>
      Effect.sync(() => {
        onCall("capture.entry", input);
        return "capture.entry";
      }),
    suggestEntryAsTask: (input: unknown) =>
      Effect.sync(() => {
        onCall("capture.suggest", input);
        return "capture.suggest";
      }),
    editEntrySuggestion: (input: unknown) =>
      Effect.sync(() => {
        onCall("capture.editSuggestion", input);
        return "capture.editSuggestion";
      }),
    rejectEntrySuggestion: (input: unknown) =>
      Effect.sync(() => {
        onCall("capture.rejectSuggestion", input);
        return "capture.rejectSuggestion";
      }),
    acceptEntryAsTask: (input: unknown) =>
      Effect.sync(() => {
        onCall("capture.acceptAsTask", input);
        return "capture.acceptAsTask";
      }),
    ingestSignal: (input: unknown) =>
      Effect.sync(() => {
        onCall("signal.ingest", input);
        return "signal.ingest";
      }),
    triageSignal: (input: unknown) =>
      Effect.sync(() => {
        onCall("signal.triage", input);
        return "signal.triage";
      }),
    convertSignal: (input: unknown) =>
      Effect.sync(() => {
        onCall("signal.convert", input);
        return "signal.convert";
      }),
    completeTask: (input: unknown) =>
      Effect.sync(() => {
        onCall("planning.completeTask", input);
        return "planning.completeTask";
      }),
    deferTask: (input: unknown) =>
      Effect.sync(() => {
        onCall("planning.deferTask", input);
        return "planning.deferTask";
      }),
    rescheduleTask: (input: unknown) =>
      Effect.sync(() => {
        onCall("planning.rescheduleTask", input);
        return "planning.rescheduleTask";
      }),
    requestEventSync: (input: unknown) =>
      Effect.sync(() => {
        onCall("approval.requestEventSync", input);
        return "approval.requestEventSync";
      }),
    requestOutboundDraftExecution: (input: unknown) =>
      Effect.sync(() => {
        onCall("approval.requestOutboundDraftExecution", input);
        return "approval.requestOutboundDraftExecution";
      }),
    approveOutboundAction: (input: unknown) =>
      Effect.sync(() => {
        onCall("approval.approveOutboundAction", input);
        return "approval.approveOutboundAction";
      }),
    createJob: (input: unknown) =>
      Effect.sync(() => {
        onCall("job.create", input);
        return "job.create";
      }),
    recordJobRun: (input: unknown) =>
      Effect.sync(() => {
        onCall("job.recordRun", input);
        return "job.recordRun";
      }),
    inspectJobRun: (input: unknown) =>
      Effect.sync(() => {
        onCall("job.inspectRun", input);
        return "job.inspectRun";
      }),
    listJobRunHistory: (input: unknown) =>
      Effect.sync(() => {
        onCall("job.listHistory", input);
        return "job.listHistory";
      }),
    retryJob: (input: unknown) =>
      Effect.sync(() => {
        onCall("job.retry", input);
        return "job.retry";
      }),
    createWorkflowCheckpoint: (input: unknown) =>
      Effect.sync(() => {
        onCall("checkpoint.create", input);
        return "checkpoint.create";
      }),
    keepCheckpoint: (input: unknown) =>
      Effect.sync(() => {
        onCall("checkpoint.keep", input);
        return "checkpoint.keep";
      }),
    recoverCheckpoint: (input: unknown) =>
      Effect.sync(() => {
        onCall("checkpoint.recover", input);
        return "checkpoint.recover";
      }),
  }) as unknown as WorkflowApi;

describe("api/workflows/routes", () => {
  test("includes all required workflow route keys", () => {
    expect(Object.keys(WORKFLOW_ROUTE_PATHS).sort()).toEqual(
      [...REQUIRED_ROUTE_KEYS].sort(),
    );
  });

  test("maps keys to unique POST paths under /api/workflows/", () => {
    const paths = Object.values(WORKFLOW_ROUTE_PATHS);
    const uniquePaths = new Set(paths);

    expect(uniquePaths.size).toBe(paths.length);
    expect(paths.every((path) => path.startsWith("/api/workflows/"))).toBe(
      true,
    );
  });

  test("makeWorkflowRoutes returns POST definitions for every required route", () => {
    const routes = makeWorkflowRoutes(makeApiStub());

    expect(routes).toHaveLength(REQUIRED_ROUTE_KEYS.length);
    expect(routes.every((route) => route.method === "POST")).toBe(true);

    const byKey = new Map(routes.map((route) => [route.key, route]));

    for (const key of REQUIRED_ROUTE_KEYS) {
      const route = byKey.get(key);

      expect(route?.path).toBe(WORKFLOW_ROUTE_PATHS[key]);
      expect(route?.handle).toBeDefined();
    }
  });

  test("route handlers invoke their mapped workflow api methods", async () => {
    const calls: Array<{ route: WorkflowRouteKey; input: unknown }> = [];
    const routes = makeWorkflowRoutes(
      makeApiSpy((route, input) => {
        calls.push({ route, input });
      }),
    );

    for (const route of routes) {
      const result = await Effect.runPromise(
        route.handle(VALID_ROUTE_INPUTS[route.key]),
      );
      expect(result).toBe(route.key);
    }

    expect(calls).toHaveLength(REQUIRED_ROUTE_KEYS.length);
    expect(calls.map((call) => call.route).sort()).toEqual(
      [...REQUIRED_ROUTE_KEYS].sort(),
    );
    for (const call of calls) {
      expect(call.input).toEqual(VALID_ROUTE_INPUTS[call.route]);
    }
  });

  test("route handlers reject undefined payloads with WorkflowApiError", async () => {
    const routes = makeWorkflowRoutes(makeApiSpy(() => undefined));

    for (const route of routes) {
      const result = await Effect.runPromise(
        Effect.either(route.handle(undefined)),
      );

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left).toMatchObject({
          _tag: "WorkflowApiError",
          route: route.key,
        });
        expect(result.left.message).toContain("invalid request payload");
      }
    }
  });

  test("route handlers reject malformed field types with WorkflowApiError", async () => {
    const routes = makeWorkflowRoutes(makeApiSpy(() => undefined));
    const byKey = new Map(routes.map((route) => [route.key, route]));
    const deferRoute = byKey.get("planning.deferTask");

    expect(deferRoute).toBeDefined();
    const result = await Effect.runPromise(
      Effect.either(
        deferRoute!.handle({
          taskId: "task-route-1",
          until: "not-a-date",
          actor: ACTOR,
          at: AT,
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "planning.deferTask",
      });
      expect(result.left.message).toContain("until");
    }
  });

  test("capture.entry rejects whitespace-only content", async () => {
    const routes = makeWorkflowRoutes(makeApiSpy(() => undefined));
    const byKey = new Map(routes.map((route) => [route.key, route]));
    const captureRoute = byKey.get("capture.entry");

    expect(captureRoute).toBeDefined();
    const result = await Effect.runPromise(
      Effect.either(
        captureRoute!.handle({
          entryId: "entry-route-1",
          content: "   ",
          actor: ACTOR,
          at: AT,
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "capture.entry",
      });
      expect(result.left.message).toContain("content");
    }
  });

  test("signal.ingest rejects whitespace-only source", async () => {
    const routes = makeWorkflowRoutes(makeApiSpy(() => undefined));
    const byKey = new Map(routes.map((route) => [route.key, route]));
    const ingestRoute = byKey.get("signal.ingest");

    expect(ingestRoute).toBeDefined();
    const result = await Effect.runPromise(
      Effect.either(
        ingestRoute!.handle({
          signalId: "signal-route-1",
          source: "   ",
          payload: "payload",
          actor: ACTOR,
          at: AT,
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "signal.ingest",
      });
      expect(result.left.message).toContain("source");
    }
  });

  test("signal.ingest rejects whitespace-only payload", async () => {
    const routes = makeWorkflowRoutes(makeApiSpy(() => undefined));
    const byKey = new Map(routes.map((route) => [route.key, route]));
    const ingestRoute = byKey.get("signal.ingest");

    expect(ingestRoute).toBeDefined();
    const result = await Effect.runPromise(
      Effect.either(
        ingestRoute!.handle({
          signalId: "signal-route-1",
          source: "email",
          payload: "   ",
          actor: ACTOR,
          at: AT,
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "signal.ingest",
      });
      expect(result.left.message).toContain("payload");
    }
  });

  test("approval.approveOutboundAction rejects whitespace-only entityId", async () => {
    const routes = makeWorkflowRoutes(makeApiSpy(() => undefined));
    const byKey = new Map(routes.map((route) => [route.key, route]));
    const approveRoute = byKey.get("approval.approveOutboundAction");

    expect(approveRoute).toBeDefined();

    const result = await Effect.runPromise(
      Effect.either(
        approveRoute!.handle({
          actionType: "event_sync",
          entityType: "event",
          entityId: "   ",
          approved: true,
          actor: ACTOR,
          at: AT,
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "approval.approveOutboundAction",
      });
      expect(result.left.message).toContain("entityId");
    }
  });

  test("approval routes reject whitespace-only actor.id", async () => {
    const routes = makeWorkflowRoutes(makeApiSpy(() => undefined));
    const byKey = new Map(routes.map((route) => [route.key, route]));
    const approvalRoutes: ReadonlyArray<WorkflowRouteKey> = [
      "approval.requestEventSync",
      "approval.requestOutboundDraftExecution",
      "approval.approveOutboundAction",
    ];

    for (const key of approvalRoutes) {
      const route = byKey.get(key);
      expect(route).toBeDefined();
      const payload = {
        ...(VALID_ROUTE_INPUTS[key] as Record<string, unknown>),
        actor: {
          id: "   ",
          kind: "user",
        },
      };

      const result = await Effect.runPromise(
        Effect.either(route!.handle(payload)),
      );
      expect(Either.isLeft(result)).toBe(true);

      if (Either.isLeft(result)) {
        expect(result.left).toMatchObject({
          _tag: "WorkflowApiError",
          route: key,
        });
        expect(result.left.message).toContain("actor.id");
      }
    }
  });

  test("approval request routes reject blank eventId and draftId", async () => {
    const routes = makeWorkflowRoutes(makeApiSpy(() => undefined));
    const byKey = new Map(routes.map((route) => [route.key, route]));
    const eventSyncRoute = byKey.get("approval.requestEventSync");
    const outboundDraftRoute = byKey.get(
      "approval.requestOutboundDraftExecution",
    );

    expect(eventSyncRoute).toBeDefined();
    expect(outboundDraftRoute).toBeDefined();

    const blankEventId = await Effect.runPromise(
      Effect.either(
        eventSyncRoute!.handle({
          eventId: "",
          actor: ACTOR,
          at: AT,
        }),
      ),
    );
    expect(Either.isLeft(blankEventId)).toBe(true);
    if (Either.isLeft(blankEventId)) {
      expect(blankEventId.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "approval.requestEventSync",
      });
      expect(blankEventId.left.message).toContain("eventId");
    }

    const blankDraftId = await Effect.runPromise(
      Effect.either(
        outboundDraftRoute!.handle({
          draftId: "   ",
          actor: ACTOR,
          at: AT,
        }),
      ),
    );
    expect(Either.isLeft(blankDraftId)).toBe(true);
    if (Either.isLeft(blankDraftId)) {
      expect(blankDraftId.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "approval.requestOutboundDraftExecution",
      });
      expect(blankDraftId.left.message).toContain("draftId");
    }
  });

  test("checkpoint.create rejects blank rollbackTarget", async () => {
    const routes = makeWorkflowRoutes(makeApiSpy(() => undefined));
    const byKey = new Map(routes.map((route) => [route.key, route]));
    const checkpointCreateRoute = byKey.get("checkpoint.create");

    expect(checkpointCreateRoute).toBeDefined();

    const result = await Effect.runPromise(
      Effect.either(
        checkpointCreateRoute!.handle({
          checkpointId: "checkpoint-route-1",
          name: "Before conversion",
          snapshotEntityRefs: [{ entityType: "task", entityId: "task-route-1" }],
          auditCursor: 1,
          rollbackTarget: "   ",
          actor: ACTOR,
          at: AT,
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "checkpoint.create",
      });
      expect(result.left.message).toContain("rollbackTarget");
    }
  });

  test("job.create rejects whitespace-only name", async () => {
    const routes = makeWorkflowRoutes(makeApiSpy(() => undefined));
    const byKey = new Map(routes.map((route) => [route.key, route]));
    const createRoute = byKey.get("job.create");

    expect(createRoute).toBeDefined();
    const result = await Effect.runPromise(
      Effect.either(
        createRoute!.handle({
          jobId: "job-route-1",
          name: "   ",
          actor: { id: "system-1", kind: "system" },
          at: AT,
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "job.create",
      });
      expect(result.left.message).toContain("name");
    }
  });

  test("job.retry rejects whitespace-only jobId", async () => {
    const routes = makeWorkflowRoutes(makeApiSpy(() => undefined));
    const byKey = new Map(routes.map((route) => [route.key, route]));
    const retryRoute = byKey.get("job.retry");

    expect(retryRoute).toBeDefined();
    const result = await Effect.runPromise(
      Effect.either(
        retryRoute!.handle({
          jobId: "   ",
          actor: ACTOR,
          at: AT,
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "job.retry",
      });
      expect(result.left.message).toContain("jobId");
    }
  });

  test("checkpoint.keep rejects whitespace-only checkpointId", async () => {
    const routes = makeWorkflowRoutes(makeApiSpy(() => undefined));
    const byKey = new Map(routes.map((route) => [route.key, route]));
    const keepRoute = byKey.get("checkpoint.keep");

    expect(keepRoute).toBeDefined();
    const result = await Effect.runPromise(
      Effect.either(
        keepRoute!.handle({
          checkpointId: "   ",
          actor: ACTOR,
          at: AT,
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "checkpoint.keep",
      });
      expect(result.left.message).toContain("checkpointId");
    }
  });

  test("checkpoint.recover rejects whitespace-only checkpointId", async () => {
    const routes = makeWorkflowRoutes(makeApiSpy(() => undefined));
    const byKey = new Map(routes.map((route) => [route.key, route]));
    const recoverRoute = byKey.get("checkpoint.recover");

    expect(recoverRoute).toBeDefined();
    const result = await Effect.runPromise(
      Effect.either(
        recoverRoute!.handle({
          checkpointId: "   ",
          actor: ACTOR,
          at: AT,
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "checkpoint.recover",
      });
      expect(result.left.message).toContain("checkpointId");
    }
  });

  test("job.listHistory validator requires jobId and enforces optional filters", async () => {
    const routes = makeWorkflowRoutes(makeApiSpy(() => undefined));
    const byKey = new Map(routes.map((route) => [route.key, route]));
    const listHistoryRoute = byKey.get("job.listHistory");

    expect(listHistoryRoute).toBeDefined();

    const missingJobId = await Effect.runPromise(
      Effect.either(listHistoryRoute!.handle({ limit: 5 })),
    );
    expect(Either.isLeft(missingJobId)).toBe(true);
    if (Either.isLeft(missingJobId)) {
      expect(missingJobId.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "job.listHistory",
      });
      expect(missingJobId.left.message).toContain("jobId");
    }

    const invalidLimit = await Effect.runPromise(
      Effect.either(
        listHistoryRoute!.handle({
          jobId: "job-route-1",
          limit: 0,
        }),
      ),
    );
    expect(Either.isLeft(invalidLimit)).toBe(true);
    if (Either.isLeft(invalidLimit)) {
      expect(invalidLimit.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "job.listHistory",
      });
      expect(invalidLimit.left.message).toContain("limit");
    }

    const invalidBeforeAt = await Effect.runPromise(
      Effect.either(
        listHistoryRoute!.handle({
          jobId: "job-route-1",
          beforeAt: "invalid-date",
        }),
      ),
    );
    expect(Either.isLeft(invalidBeforeAt)).toBe(true);
    if (Either.isLeft(invalidBeforeAt)) {
      expect(invalidBeforeAt.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "job.listHistory",
      });
      expect(invalidBeforeAt.left.message).toContain("beforeAt");
    }
  });

  test("route handlers coerce ISO timestamp strings for workflow payloads", async () => {
    const calls: Array<{ route: WorkflowRouteKey; input: unknown }> = [];
    const routes = makeWorkflowRoutes(
      makeApiSpy((route, input) => {
        calls.push({ route, input });
      }),
    );
    const byKey = new Map(routes.map((route) => [route.key, route]));

    const dateString = "2026-02-23T10:00:00.000Z";

    const cases: ReadonlyArray<{ key: WorkflowRouteKey; payload: unknown }> = [
      {
        key: "capture.entry",
        payload: {
          entryId: "entry-route-iso-1",
          content: "Capture content",
          actor: ACTOR,
          at: dateString,
        },
      },
      {
        key: "signal.triage",
        payload: {
          signalId: "signal-route-iso-1",
          decision: "ready_for_conversion",
          actor: ACTOR,
          at: dateString,
        },
      },
      {
        key: "job.retry",
        payload: {
          jobId: "job-route-1",
          actor: ACTOR,
          at: dateString,
        },
      },
      {
        key: "checkpoint.recover",
        payload: {
          checkpointId: "checkpoint-route-1",
          actor: ACTOR,
          at: dateString,
        },
      },
      {
        key: "job.listHistory",
        payload: {
          jobId: "job-route-1",
          beforeAt: dateString,
          limit: 5,
        },
      },
    ];

    for (const entry of cases) {
      const route = byKey.get(entry.key);
      expect(route).toBeDefined();
      await Effect.runPromise(route!.handle(entry.payload));
    }

    const callByRoute = new Map(calls.map((call) => [call.route, call]));
    for (const entry of cases) {
      const call = callByRoute.get(entry.key);
      expect(call).toBeDefined();
      const payload = call!.input as { at?: unknown; beforeAt?: unknown };
      if ("at" in (entry.payload as Record<string, unknown>)) {
        expect(payload.at).toBeInstanceOf(Date);
      }
      if ("beforeAt" in (entry.payload as Record<string, unknown>)) {
        expect(payload.beforeAt).toBeInstanceOf(Date);
      }
    }
  });

  test("route handlers accept ISO timestamp offsets in payload date fields", async () => {
    const calls: Array<{ route: WorkflowRouteKey; input: unknown }> = [];
    const routes = makeWorkflowRoutes(
      makeApiSpy((route, input) => {
        calls.push({ route, input });
      }),
    );
    const byKey = new Map(routes.map((route) => [route.key, route]));
    const listHistoryRoute = byKey.get("job.listHistory");

    expect(listHistoryRoute).toBeDefined();

    await Effect.runPromise(
      listHistoryRoute!.handle({
        jobId: "job-route-offset-1",
        beforeAt: "2026-02-23T10:00:00+01:00",
        limit: 5,
      }),
    );

    const call = calls.find((entry) => entry.route === "job.listHistory");
    expect(call).toBeDefined();
    expect((call!.input as { beforeAt: Date }).beforeAt.toISOString()).toBe(
      "2026-02-23T09:00:00.000Z",
    );
  });

  test("route handlers accept broader ISO-8601 variants for timestamp fields", async () => {
    const calls: Array<{ route: WorkflowRouteKey; input: unknown }> = [];
    const routes = makeWorkflowRoutes(
      makeApiSpy((route, input) => {
        calls.push({ route, input });
      }),
    );
    const byKey = new Map(routes.map((route) => [route.key, route]));
    const captureRoute = byKey.get("capture.entry");
    const historyRoute = byKey.get("job.listHistory");

    expect(captureRoute).toBeDefined();
    expect(historyRoute).toBeDefined();

    await Effect.runPromise(
      captureRoute!.handle({
        entryId: "entry-route-iso-variant-1",
        content: "Capture content",
        actor: ACTOR,
        at: "2026-02-23T10:00:00.1Z",
      }),
    );

    await Effect.runPromise(
      historyRoute!.handle({
        jobId: "job-route-iso-variant-1",
        beforeAt: "2026-02-23T10:00:00",
        limit: 5,
      }),
    );

    const captureCall = calls.find((entry) => entry.route === "capture.entry");
    const historyCall = calls.find((entry) => entry.route === "job.listHistory");

    expect(captureCall).toBeDefined();
    expect(historyCall).toBeDefined();
    expect((captureCall!.input as { at: Date }).at).toBeInstanceOf(Date);
    expect((historyCall!.input as { beforeAt: Date }).beforeAt).toBeInstanceOf(
      Date,
    );
  });
});

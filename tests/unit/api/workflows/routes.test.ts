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
  "task.create",
  "task.update",
  "task.list",
  "event.create",
  "event.update",
  "event.list",
  "event.listConflicts",
  "project.create",
  "project.update",
  "project.setLifecycle",
  "project.list",
  "note.create",
  "note.update",
  "note.linkEntity",
  "note.unlinkEntity",
  "note.list",
  "notification.list",
  "notification.acknowledge",
  "notification.dismiss",
  "search.query",
  "approval.requestEventSync",
  "approval.requestOutboundDraftExecution",
  "approval.approveOutboundAction",
  "job.create",
  "job.recordRun",
  "job.inspectRun",
  "job.list",
  "job.listHistory",
  "job.retry",
  "checkpoint.create",
  "checkpoint.inspect",
  "checkpoint.keep",
  "checkpoint.recover",
  "activity.list",
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
  "task.create": {
    taskId: "task-route-created-1",
    title: "Create task from route",
    description: "Task description",
    scheduledFor: new Date("2026-02-24T08:00:00.000Z"),
    dueAt: new Date("2026-02-24T17:00:00.000Z"),
    projectId: "project-route-1",
    sourceEntryId: "entry-route-1",
    actor: ACTOR,
    at: AT,
  },
  "task.update": {
    taskId: "task-route-1",
    title: "Updated task title",
    description: "Updated description",
    scheduledFor: new Date("2026-02-25T09:00:00.000Z"),
    dueAt: null,
    projectId: "project-route-1",
    actor: ACTOR,
    at: AT,
  },
  "task.list": {
    status: "planned",
    projectId: "project-route-1",
    scheduledFrom: new Date("2026-02-23T00:00:00.000Z"),
    scheduledTo: new Date("2026-02-26T00:00:00.000Z"),
  },
  "event.create": {
    eventId: "event-route-created-1",
    title: "Route-created event",
    startAt: new Date("2026-02-24T09:00:00.000Z"),
    endAt: new Date("2026-02-24T10:00:00.000Z"),
    actor: ACTOR,
    at: AT,
  },
  "event.update": {
    eventId: "event-route-1",
    title: "Updated route event",
    startAt: new Date("2026-02-24T11:00:00.000Z"),
    endAt: null,
    actor: ACTOR,
    at: AT,
  },
  "event.list": {
    from: new Date("2026-02-23T00:00:00.000Z"),
    to: new Date("2026-02-26T00:00:00.000Z"),
    syncState: "local_only",
    sort: "startAt_asc",
    limit: 10,
  },
  "event.listConflicts": {
    eventId: "event-route-1",
  },
  "project.create": {
    projectId: "project-route-created-1",
    name: "Route-created project",
    description: "Project description",
    actor: ACTOR,
    at: AT,
  },
  "project.update": {
    projectId: "project-route-1",
    name: "Updated project name",
    description: "Updated project description",
    actor: ACTOR,
    at: AT,
  },
  "project.setLifecycle": {
    projectId: "project-route-1",
    lifecycle: "paused",
    actor: ACTOR,
    at: AT,
  },
  "project.list": {
    lifecycle: "active",
  },
  "note.create": {
    noteId: "note-route-created-1",
    body: "Note body from route",
    linkedEntityRefs: ["task:task-route-1", "project:project-route-1"],
    actor: ACTOR,
    at: AT,
  },
  "note.update": {
    noteId: "note-route-1",
    body: "Updated note body",
    actor: ACTOR,
    at: AT,
  },
  "note.linkEntity": {
    noteId: "note-route-1",
    entityRef: "task:task-route-1",
    actor: ACTOR,
    at: AT,
  },
  "note.unlinkEntity": {
    noteId: "note-route-1",
    entityRef: "task:task-route-1",
    actor: ACTOR,
    at: AT,
  },
  "note.list": {
    entityRef: "task:task-route-1",
  },
  "notification.list": {
    status: "pending",
    type: "event_sync_required",
    relatedEntity: {
      entityType: "event",
      entityId: "event-route-1",
    },
    limit: 10,
  },
  "notification.acknowledge": {
    notificationId: "notification-route-1",
    actor: ACTOR,
    at: AT,
  },
  "notification.dismiss": {
    notificationId: "notification-route-1",
    actor: ACTOR,
    at: AT,
  },
  "search.query": {
    query: "follow up",
    entityTypes: ["task", "note"],
    limit: 10,
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
  "job.list": {
    runState: "failed",
    limit: 10,
    beforeUpdatedAt: new Date("2026-02-24T00:00:00.000Z"),
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
  "checkpoint.inspect": {
    checkpointId: "checkpoint-route-1",
  },
  "checkpoint.recover": {
    checkpointId: "checkpoint-route-1",
    actor: ACTOR,
    at: AT,
  },
  "activity.list": {
    entityType: "job",
    entityId: "job-route-1",
    actorKind: "ai",
    aiOnly: true,
    limit: 10,
    beforeAt: new Date("2026-02-24T00:00:00.000Z"),
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
  createTask: (_input) => Effect.die("unused"),
  updateTask: (_input) => Effect.die("unused"),
  listTasks: (_input) => Effect.die("unused"),
  createEvent: (_input) => Effect.die("unused"),
  updateEvent: (_input) => Effect.die("unused"),
  listEvents: (_input) => Effect.die("unused"),
  listEventConflicts: (_input) => Effect.die("unused"),
  createProject: (_input) => Effect.die("unused"),
  updateProject: (_input) => Effect.die("unused"),
  setProjectLifecycle: (_input) => Effect.die("unused"),
  listProjects: (_input) => Effect.die("unused"),
  createNote: (_input) => Effect.die("unused"),
  updateNote: (_input) => Effect.die("unused"),
  linkNoteEntity: (_input) => Effect.die("unused"),
  unlinkNoteEntity: (_input) => Effect.die("unused"),
  listNotes: (_input) => Effect.die("unused"),
  listNotifications: (_input) => Effect.die("unused"),
  acknowledgeNotification: (_input) => Effect.die("unused"),
  dismissNotification: (_input) => Effect.die("unused"),
  searchQuery: (_input) => Effect.die("unused"),
  requestEventSync: (_input) => Effect.die("unused"),
  requestOutboundDraftExecution: (_input) => Effect.die("unused"),
  approveOutboundAction: (_input) => Effect.die("unused"),
  createJob: (_input) => Effect.die("unused"),
  recordJobRun: (_input) => Effect.die("unused"),
  inspectJobRun: (_input) => Effect.die("unused"),
  listJobs: (_input) => Effect.die("unused"),
  listJobRunHistory: (_input) => Effect.die("unused"),
  retryJob: (_input) => Effect.die("unused"),
  createWorkflowCheckpoint: (_input) => Effect.die("unused"),
  inspectWorkflowCheckpoint: (_input) => Effect.die("unused"),
  keepCheckpoint: (_input) => Effect.die("unused"),
  recoverCheckpoint: (_input) => Effect.die("unused"),
  listActivity: (_input) => Effect.die("unused"),
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
    createTask: (input: unknown) =>
      Effect.sync(() => {
        onCall("task.create", input);
        return "task.create";
      }),
    updateTask: (input: unknown) =>
      Effect.sync(() => {
        onCall("task.update", input);
        return "task.update";
      }),
    listTasks: (input: unknown) =>
      Effect.sync(() => {
        onCall("task.list", input);
        return "task.list";
      }),
    createEvent: (input: unknown) =>
      Effect.sync(() => {
        onCall("event.create", input);
        return "event.create";
      }),
    updateEvent: (input: unknown) =>
      Effect.sync(() => {
        onCall("event.update", input);
        return "event.update";
      }),
    listEvents: (input: unknown) =>
      Effect.sync(() => {
        onCall("event.list", input);
        return "event.list";
      }),
    listEventConflicts: (input: unknown) =>
      Effect.sync(() => {
        onCall("event.listConflicts", input);
        return "event.listConflicts";
      }),
    createProject: (input: unknown) =>
      Effect.sync(() => {
        onCall("project.create", input);
        return "project.create";
      }),
    updateProject: (input: unknown) =>
      Effect.sync(() => {
        onCall("project.update", input);
        return "project.update";
      }),
    setProjectLifecycle: (input: unknown) =>
      Effect.sync(() => {
        onCall("project.setLifecycle", input);
        return "project.setLifecycle";
      }),
    listProjects: (input: unknown) =>
      Effect.sync(() => {
        onCall("project.list", input);
        return "project.list";
      }),
    createNote: (input: unknown) =>
      Effect.sync(() => {
        onCall("note.create", input);
        return "note.create";
      }),
    updateNote: (input: unknown) =>
      Effect.sync(() => {
        onCall("note.update", input);
        return "note.update";
      }),
    linkNoteEntity: (input: unknown) =>
      Effect.sync(() => {
        onCall("note.linkEntity", input);
        return "note.linkEntity";
      }),
    unlinkNoteEntity: (input: unknown) =>
      Effect.sync(() => {
        onCall("note.unlinkEntity", input);
        return "note.unlinkEntity";
      }),
    listNotes: (input: unknown) =>
      Effect.sync(() => {
        onCall("note.list", input);
        return "note.list";
      }),
    listNotifications: (input: unknown) =>
      Effect.sync(() => {
        onCall("notification.list", input);
        return "notification.list";
      }),
    acknowledgeNotification: (input: unknown) =>
      Effect.sync(() => {
        onCall("notification.acknowledge", input);
        return "notification.acknowledge";
      }),
    dismissNotification: (input: unknown) =>
      Effect.sync(() => {
        onCall("notification.dismiss", input);
        return "notification.dismiss";
      }),
    searchQuery: (input: unknown) =>
      Effect.sync(() => {
        onCall("search.query", input);
        return "search.query";
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
    listJobs: (input: unknown) =>
      Effect.sync(() => {
        onCall("job.list", input);
        return "job.list";
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
    inspectWorkflowCheckpoint: (input: unknown) =>
      Effect.sync(() => {
        onCall("checkpoint.inspect", input);
        return "checkpoint.inspect";
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
    listActivity: (input: unknown) =>
      Effect.sync(() => {
        onCall("activity.list", input);
        return "activity.list";
      }),
  }) as unknown as WorkflowApi;

const getRouteHandle = (
  routes: ReturnType<typeof makeWorkflowRoutes>,
  key: WorkflowRouteKey,
): ReturnType<typeof makeWorkflowRoutes>[number]["handle"] => {
  const route = routes.find((entry) => entry.key === key);
  expect(route).toBeDefined();
  return route!.handle;
};

const expectWorkflowValidationLeft = (
  result: Either.Either<unknown, unknown>,
  route: WorkflowRouteKey,
  messageIncludes: string,
): void => {
  expect(Either.isLeft(result)).toBe(true);
  if (Either.isLeft(result)) {
    const left = result.left as {
      _tag: string;
      route: WorkflowRouteKey;
      message: string;
    };
    expect(left).toMatchObject({
      _tag: "WorkflowApiError",
      route,
    });
    expect(left.message).toContain(messageIncludes);
  }
};

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

  test("approval.approveOutboundAction route is marked as trusted-actor-bound", () => {
    const routes = makeWorkflowRoutes(makeApiStub());
    const byKey = new Map(routes.map((route) => [route.key, route]));
    const approveRoute = byKey.get("approval.approveOutboundAction");

    expect(approveRoute).toBeDefined();
    expect(
      (approveRoute as { actorSource?: string } | undefined)?.actorSource,
    ).toBe("trusted");
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

  test("route handlers enforce undefined payload rules by route requirements", async () => {
    const routes = makeWorkflowRoutes(makeApiSpy(() => undefined));
    const routesAcceptingOmittedBody = new Set<WorkflowRouteKey>([
      "task.list",
      "event.list",
      "event.listConflicts",
      "project.list",
      "note.list",
      "notification.list",
      "job.list",
      "activity.list",
    ]);

    for (const route of routes) {
      const result = await Effect.runPromise(
        Effect.either(route.handle(undefined)),
      );

      if (routesAcceptingOmittedBody.has(route.key)) {
        expect(Either.isRight(result)).toBe(true);
        if (Either.isRight(result)) {
          expect(result.right).toBe(route.key);
        }
        continue;
      }

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

  test("uncovered routes reject empty object payloads with route-specific validation errors", async () => {
    const routes = makeWorkflowRoutes(makeApiSpy(() => undefined));
    const cases: ReadonlyArray<{
      route: WorkflowRouteKey;
      messageIncludes: string;
    }> = [
      { route: "capture.suggest", messageIncludes: "entryId" },
      { route: "capture.editSuggestion", messageIncludes: "entryId" },
      { route: "capture.acceptAsTask", messageIncludes: "entryId" },
      { route: "signal.triage", messageIncludes: "signalId" },
      { route: "signal.convert", messageIncludes: "signalId" },
      { route: "planning.completeTask", messageIncludes: "taskId" },
      { route: "planning.rescheduleTask", messageIncludes: "taskId" },
      { route: "task.create", messageIncludes: "title" },
      { route: "task.update", messageIncludes: "taskId" },
      { route: "event.create", messageIncludes: "title" },
      { route: "event.update", messageIncludes: "eventId" },
      { route: "project.create", messageIncludes: "name" },
      { route: "project.update", messageIncludes: "projectId" },
      { route: "project.setLifecycle", messageIncludes: "projectId" },
      { route: "note.create", messageIncludes: "body" },
      { route: "note.update", messageIncludes: "noteId" },
      { route: "note.linkEntity", messageIncludes: "noteId" },
      { route: "note.unlinkEntity", messageIncludes: "noteId" },
      { route: "notification.acknowledge", messageIncludes: "notificationId" },
      { route: "notification.dismiss", messageIncludes: "notificationId" },
      { route: "search.query", messageIncludes: "query" },
      { route: "job.recordRun", messageIncludes: "jobId" },
      { route: "job.inspectRun", messageIncludes: "jobId" },
    ];

    for (const entry of cases) {
      const result = await Effect.runPromise(
        Effect.either(getRouteHandle(routes, entry.route)({})),
      );
      expectWorkflowValidationLeft(
        result,
        entry.route,
        entry.messageIncludes,
      );
    }
  });

  test("uncovered routes reject malformed payload fields with route-specific validation errors", async () => {
    const routes = makeWorkflowRoutes(makeApiSpy(() => undefined));
    const cases: ReadonlyArray<{
      route: WorkflowRouteKey;
      payload: unknown;
      messageIncludes: string;
    }> = [
      {
        route: "capture.suggest",
        payload: {
          entryId: "entry-route-1",
          suggestedTitle: 123,
          actor: ACTOR,
          at: AT,
        },
        messageIncludes: "suggestedTitle",
      },
      {
        route: "capture.editSuggestion",
        payload: {
          entryId: "entry-route-1",
          suggestedTitle: 123,
          actor: ACTOR,
          at: AT,
        },
        messageIncludes: "suggestedTitle",
      },
      {
        route: "capture.acceptAsTask",
        payload: {
          entryId: "entry-route-1",
          taskId: "task-route-1",
          actor: { id: "user-1", kind: "robot" },
          at: AT,
        },
        messageIncludes: "actor.kind",
      },
      {
        route: "signal.triage",
        payload: {
          signalId: "signal-route-1",
          decision: 1,
          actor: ACTOR,
          at: AT,
        },
        messageIncludes: "decision",
      },
      {
        route: "signal.convert",
        payload: {
          signalId: "signal-route-1",
          targetType: "invalid",
          targetId: "task-route-1",
          actor: ACTOR,
          at: AT,
        },
        messageIncludes: "targetType",
      },
      {
        route: "planning.completeTask",
        payload: {
          taskId: 1,
          actor: ACTOR,
          at: AT,
        },
        messageIncludes: "taskId",
      },
      {
        route: "planning.rescheduleTask",
        payload: {
          taskId: "task-route-1",
          nextAt: "not-a-date",
          actor: ACTOR,
          at: AT,
        },
        messageIncludes: "nextAt",
      },
      {
        route: "task.list",
        payload: {
          status: "unknown",
        },
        messageIncludes: "status",
      },
      {
        route: "event.list",
        payload: {
          syncState: "unknown",
        },
        messageIncludes: "syncState",
      },
      {
        route: "event.listConflicts",
        payload: {
          eventId: "   ",
        },
        messageIncludes: "eventId",
      },
      {
        route: "project.list",
        payload: {
          lifecycle: "archived",
        },
        messageIncludes: "lifecycle",
      },
      {
        route: "note.list",
        payload: {
          entityRef: "   ",
        },
        messageIncludes: "entityRef",
      },
      {
        route: "notification.list",
        payload: {
          status: "unknown",
        },
        messageIncludes: "status",
      },
      {
        route: "search.query",
        payload: {
          query: "follow up",
          entityTypes: ["task", 1],
        },
        messageIncludes: "entityTypes",
      },
      {
        route: "job.recordRun",
        payload: {
          jobId: "job-route-1",
          outcome: "partial",
          actor: { id: "system-1", kind: "system" },
          at: AT,
        },
        messageIncludes: "outcome",
      },
      {
        route: "job.inspectRun",
        payload: {
          jobId: "   ",
        },
        messageIncludes: "jobId",
      },
    ];

    for (const entry of cases) {
      const result = await Effect.runPromise(
        Effect.either(getRouteHandle(routes, entry.route)(entry.payload)),
      );
      expectWorkflowValidationLeft(
        result,
        entry.route,
        entry.messageIncludes,
      );
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

  test("capture.entry rejects invalid actor.kind", async () => {
    const routes = makeWorkflowRoutes(makeApiSpy(() => undefined));
    const byKey = new Map(routes.map((route) => [route.key, route]));
    const captureRoute = byKey.get("capture.entry");

    expect(captureRoute).toBeDefined();
    const result = await Effect.runPromise(
      Effect.either(
        captureRoute!.handle({
          entryId: "entry-route-1",
          content: "Capture content",
          actor: { id: "user-1", kind: "robot" },
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
      expect(result.left.message).toContain("actor.kind");
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
          snapshotEntityRefs: [
            { entityType: "task", entityId: "task-route-1" },
          ],
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

  test("checkpoint.create rejects blank snapshotEntityRefs entityId", async () => {
    const routes = makeWorkflowRoutes(makeApiSpy(() => undefined));
    const byKey = new Map(routes.map((route) => [route.key, route]));
    const checkpointCreateRoute = byKey.get("checkpoint.create");

    expect(checkpointCreateRoute).toBeDefined();

    const result = await Effect.runPromise(
      Effect.either(
        checkpointCreateRoute!.handle({
          checkpointId: "checkpoint-route-1",
          name: "Before conversion",
          snapshotEntityRefs: [{ entityType: "task", entityId: "   " }],
          auditCursor: 1,
          rollbackTarget: "audit-1",
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
      expect(result.left.message).toContain("snapshotEntityRefs[0].entityId");
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

  test("job.create rejects invalid provided optional actor.kind", async () => {
    const routes = makeWorkflowRoutes(makeApiSpy(() => undefined));
    const byKey = new Map(routes.map((route) => [route.key, route]));
    const createRoute = byKey.get("job.create");

    expect(createRoute).toBeDefined();
    const result = await Effect.runPromise(
      Effect.either(
        createRoute!.handle({
          jobId: "job-route-1",
          name: "Workflow sweep",
          actor: { id: "system-1", kind: "robot" },
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
      expect(result.left.message).toContain("actor.kind");
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

  test("job.list validator accepts undefined body and enforces runState/limit/beforeUpdatedAt", async () => {
    const calls: Array<{ route: WorkflowRouteKey; input: unknown }> = [];
    const routes = makeWorkflowRoutes(
      makeApiSpy((route, input) => {
        calls.push({ route, input });
      }),
    );
    const byKey = new Map(routes.map((route) => [route.key, route]));
    const listRoute = byKey.get("job.list");

    expect(listRoute).toBeDefined();

    await Effect.runPromise(listRoute!.handle(undefined));
    expect(calls[0]).toEqual({
      route: "job.list",
      input: {
        runState: undefined,
        limit: undefined,
        beforeUpdatedAt: undefined,
      },
    });

    await Effect.runPromise(
      listRoute!.handle({
        runState: "failed",
        limit: 5,
        beforeUpdatedAt: "2026-02-23T10:00:00.000Z",
      }),
    );

    const invalidRunState = await Effect.runPromise(
      Effect.either(
        listRoute!.handle({
          runState: "unknown",
        }),
      ),
    );
    expect(Either.isLeft(invalidRunState)).toBe(true);
    if (Either.isLeft(invalidRunState)) {
      expect(invalidRunState.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "job.list",
      });
      expect(invalidRunState.left.message).toContain("runState");
    }

    const invalidLimit = await Effect.runPromise(
      Effect.either(
        listRoute!.handle({
          limit: 0,
        }),
      ),
    );
    expect(Either.isLeft(invalidLimit)).toBe(true);
    if (Either.isLeft(invalidLimit)) {
      expect(invalidLimit.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "job.list",
      });
      expect(invalidLimit.left.message).toContain("limit");
    }

    const invalidBefore = await Effect.runPromise(
      Effect.either(
        listRoute!.handle({
          beforeUpdatedAt: "invalid-date",
        }),
      ),
    );
    expect(Either.isLeft(invalidBefore)).toBe(true);
    if (Either.isLeft(invalidBefore)) {
      expect(invalidBefore.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "job.list",
      });
      expect(invalidBefore.left.message).toContain("beforeUpdatedAt");
    }

    const jobListCall = calls.find(
      (call) =>
        call.route === "job.list" &&
        (call.input as { beforeUpdatedAt?: unknown }).beforeUpdatedAt instanceof
          Date,
    );
    expect(jobListCall).toBeDefined();
    expect(
      (jobListCall!.input as { beforeUpdatedAt: unknown }).beforeUpdatedAt,
    ).toBeInstanceOf(Date);
  });

  test("checkpoint.inspect validator requires checkpointId", async () => {
    const routes = makeWorkflowRoutes(makeApiSpy(() => undefined));
    const byKey = new Map(routes.map((route) => [route.key, route]));
    const inspectRoute = byKey.get("checkpoint.inspect");

    expect(inspectRoute).toBeDefined();

    const missingCheckpointId = await Effect.runPromise(
      Effect.either(inspectRoute!.handle({})),
    );
    expect(Either.isLeft(missingCheckpointId)).toBe(true);
    if (Either.isLeft(missingCheckpointId)) {
      expect(missingCheckpointId.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "checkpoint.inspect",
      });
      expect(missingCheckpointId.left.message).toContain("checkpointId");
    }
  });

  test("activity.list validator accepts undefined body and enforces actor/filter/pagination fields", async () => {
    const calls: Array<{ route: WorkflowRouteKey; input: unknown }> = [];
    const routes = makeWorkflowRoutes(
      makeApiSpy((route, input) => {
        calls.push({ route, input });
      }),
    );
    const byKey = new Map(routes.map((route) => [route.key, route]));
    const activityRoute = byKey.get("activity.list");

    expect(activityRoute).toBeDefined();

    await Effect.runPromise(activityRoute!.handle(undefined));
    expect(calls[0]).toEqual({
      route: "activity.list",
      input: {
        entityType: undefined,
        entityId: undefined,
        actorKind: undefined,
        aiOnly: undefined,
        limit: undefined,
        beforeAt: undefined,
      },
    });

    const invalidActorKind = await Effect.runPromise(
      Effect.either(
        activityRoute!.handle({
          actorKind: "robot",
        }),
      ),
    );
    expect(Either.isLeft(invalidActorKind)).toBe(true);
    if (Either.isLeft(invalidActorKind)) {
      expect(invalidActorKind.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "activity.list",
      });
      expect(invalidActorKind.left.message).toContain("actorKind");
    }

    const invalidAiOnly = await Effect.runPromise(
      Effect.either(
        activityRoute!.handle({
          aiOnly: "true",
        }),
      ),
    );
    expect(Either.isLeft(invalidAiOnly)).toBe(true);
    if (Either.isLeft(invalidAiOnly)) {
      expect(invalidAiOnly.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "activity.list",
      });
      expect(invalidAiOnly.left.message).toContain("aiOnly");
    }

    const invalidLimit = await Effect.runPromise(
      Effect.either(
        activityRoute!.handle({
          limit: -1,
        }),
      ),
    );
    expect(Either.isLeft(invalidLimit)).toBe(true);
    if (Either.isLeft(invalidLimit)) {
      expect(invalidLimit.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "activity.list",
      });
      expect(invalidLimit.left.message).toContain("limit");
    }

    const invalidZeroLimit = await Effect.runPromise(
      Effect.either(
        activityRoute!.handle({
          limit: 0,
        }),
      ),
    );
    expect(Either.isLeft(invalidZeroLimit)).toBe(true);
    if (Either.isLeft(invalidZeroLimit)) {
      expect(invalidZeroLimit.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "activity.list",
      });
      expect(invalidZeroLimit.left.message).toContain("limit");
    }

    const invalidBeforeAt = await Effect.runPromise(
      Effect.either(
        activityRoute!.handle({
          beforeAt: "not-a-date",
        }),
      ),
    );
    expect(Either.isLeft(invalidBeforeAt)).toBe(true);
    if (Either.isLeft(invalidBeforeAt)) {
      expect(invalidBeforeAt.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "activity.list",
      });
      expect(invalidBeforeAt.left.message).toContain("beforeAt");
    }
  });

  test("job.retry validator forwards optional fixSummary", async () => {
    const calls: Array<{ route: WorkflowRouteKey; input: unknown }> = [];
    const routes = makeWorkflowRoutes(
      makeApiSpy((route, input) => {
        calls.push({ route, input });
      }),
    );
    const byKey = new Map(routes.map((route) => [route.key, route]));
    const retryRoute = byKey.get("job.retry");

    expect(retryRoute).toBeDefined();

    await Effect.runPromise(
      retryRoute!.handle({
        jobId: "job-route-1",
        actor: ACTOR,
        at: "2026-02-23T11:00:00.000Z",
        fixSummary: "Increase timeout and retry",
      }),
    );

    const retryCall = calls.find((call) => call.route === "job.retry");
    expect(retryCall).toBeDefined();
    expect(retryCall?.input).toMatchObject({
      jobId: "job-route-1",
      fixSummary: "Increase timeout and retry",
    });
    expect((retryCall?.input as { at: unknown }).at).toBeInstanceOf(Date);
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

  test("route handlers reject timezone-less ISO timestamps in payload date fields", async () => {
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

    const timezoneLessTimestamp = await Effect.runPromise(
      Effect.either(
        historyRoute!.handle({
          jobId: "job-route-iso-variant-1",
          beforeAt: "2026-02-23T10:00:00",
          limit: 5,
        }),
      ),
    );

    const captureCall = calls.find((entry) => entry.route === "capture.entry");
    const historyCall = calls.find(
      (entry) => entry.route === "job.listHistory",
    );

    expect(captureCall).toBeDefined();
    expect((captureCall!.input as { at: Date }).at).toBeInstanceOf(Date);
    expect(historyCall).toBeUndefined();
    expect(Either.isLeft(timezoneLessTimestamp)).toBe(true);
    if (Either.isLeft(timezoneLessTimestamp)) {
      expect(timezoneLessTimestamp.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "job.listHistory",
      });
      expect(timezoneLessTimestamp.left.message).toContain("beforeAt");
    }
  });
});

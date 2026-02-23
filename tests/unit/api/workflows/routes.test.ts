import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import {
  WorkflowApi,
  WorkflowRouteKey,
} from "../../../../src/api/workflows/contracts";
import {
  makeWorkflowRoutes,
  WORKFLOW_ROUTE_PATHS,
} from "../../../../src/api/workflows/routes";

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
  "job.retry",
  "checkpoint.create",
  "checkpoint.keep",
  "checkpoint.recover",
];

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
  retryJob: (_input) => Effect.die("unused"),
  createWorkflowCheckpoint: (_input) => Effect.die("unused"),
  keepCheckpoint: (_input) => Effect.die("unused"),
  recoverCheckpoint: (_input) => Effect.die("unused"),
});

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
});

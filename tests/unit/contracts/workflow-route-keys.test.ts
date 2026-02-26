import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { WORKFLOW_ROUTE_KEYS } from "../../../src/contracts/workflow-route-keys";

const EXPECTED_WORKFLOW_ROUTE_KEYS = [
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
  "job.list",
  "job.listHistory",
  "job.retry",
  "checkpoint.create",
  "checkpoint.inspect",
  "checkpoint.keep",
  "checkpoint.recover",
  "activity.list",
] as const;

describe("workflow-route-keys", () => {
  test("WORKFLOW_ROUTE_KEYS defines the canonical key set without duplicates", () => {
    expect(WORKFLOW_ROUTE_KEYS).toEqual(EXPECTED_WORKFLOW_ROUTE_KEYS);
    expect(new Set(WORKFLOW_ROUTE_KEYS).size).toBe(WORKFLOW_ROUTE_KEYS.length);
  });

  test("api workflow contracts source WorkflowRouteKey from neutral contracts module", () => {
    const contractsSource = readFileSync(
      resolve(import.meta.dir, "../../../src/api/workflows/contracts.ts"),
      "utf8",
    );

    expect(contractsSource).toContain(
      'import type { WorkflowRouteKey as SharedWorkflowRouteKey } from "../../contracts/workflow-route-keys";',
    );
    expect(contractsSource).toContain(
      "export type WorkflowRouteKey = SharedWorkflowRouteKey;",
    );
    expect(contractsSource).not.toContain('| "capture.entry"');
  });
});

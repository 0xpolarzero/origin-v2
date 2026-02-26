import { describe, expect, test } from "bun:test";

import type { WorkflowRouteKey } from "../../../src/api/workflows/contracts";
import {
  findPersistedSchemaContractViolations,
  findWorkflowRouteContractViolations,
  parsePersistedSchemaContract,
  parseMarkdownTableRows,
  parseWorkflowRouteContractRows,
  type PersistedSchemaContract,
  type PersistedSchemaContractExpected,
  type WorkflowRouteContractRow,
} from "../../../src/core/tooling/contract-doc-policy";

describe("contract-doc-policy", () => {
  test("parseMarkdownTableRows extracts rows from the requested heading table", () => {
    const markdown = `
# Contracts

## Route Matrix

| Route Key | Method | Path |
| --- | --- | --- |
| capture.entry | POST | /api/workflows/capture/entry |
| signal.ingest | POST | /api/workflows/signal/ingest |

## Other Table

| Route Key | Method | Path |
| --- | --- | --- |
| job.list | POST | /api/workflows/job/list |
`;

    expect(parseMarkdownTableRows(markdown, "Route Matrix")).toEqual([
      {
        "Route Key": "capture.entry",
        Method: "POST",
        Path: "/api/workflows/capture/entry",
      },
      {
        "Route Key": "signal.ingest",
        Method: "POST",
        Path: "/api/workflows/signal/ingest",
      },
    ]);
  });

  test("parseWorkflowRouteContractRows parses key/method/path rows", () => {
    const markdown = `
## Route Matrix

| Route Key | Method | Path |
| --- | --- | --- |
| capture.entry | POST | /api/workflows/capture/entry |
| signal.ingest | POST | /api/workflows/signal/ingest |
`;

    expect(parseWorkflowRouteContractRows(markdown)).toEqual([
      {
        key: "capture.entry",
        method: "POST",
        path: "/api/workflows/capture/entry",
      },
      {
        key: "signal.ingest",
        method: "POST",
        path: "/api/workflows/signal/ingest",
      },
    ]);
  });

  test("parseWorkflowRouteContractRows rejects duplicate route keys", () => {
    const markdown = `
## Route Matrix

| Route Key | Method | Path |
| --- | --- | --- |
| capture.entry | POST | /api/workflows/capture/entry |
| capture.entry | POST | /api/workflows/capture/entry |
`;

    expect(() => parseWorkflowRouteContractRows(markdown)).toThrow(
      "duplicate documented workflow route key: capture.entry",
    );
  });

  test("findWorkflowRouteContractViolations reports missing, extra, method mismatch, and path mismatch", () => {
    const documented: ReadonlyArray<WorkflowRouteContractRow> = [
      {
        key: "capture.entry",
        method: "GET",
        path: "/api/workflows/capture/entry-v2",
      } as unknown as WorkflowRouteContractRow,
      {
        key: "signal.ingest",
        method: "POST",
        path: "/api/workflows/signal/ingest",
      },
      {
        key: "job.list" as WorkflowRouteKey,
        method: "POST",
        path: "/api/workflows/job/list",
      },
    ];

    const expectedPaths = {
      "capture.entry": "/api/workflows/capture/entry",
      "signal.ingest": "/api/workflows/signal/ingest",
      "job.inspectRun": "/api/workflows/job/inspect-run",
    } as Record<WorkflowRouteKey, string>;

    const expectedMethodByKey = {
      "capture.entry": "POST",
      "signal.ingest": "POST",
      "job.inspectRun": "POST",
    } as Record<WorkflowRouteKey, "POST">;

    expect(
      findWorkflowRouteContractViolations({
        documented,
        expectedPaths,
        expectedMethodByKey,
      }),
    ).toEqual([
      {
        key: "capture.entry",
        issue: "method-mismatch",
        expectedMethod: "POST",
        documentedMethod: "GET",
      },
      {
        key: "capture.entry",
        issue: "path-mismatch",
        expectedPath: "/api/workflows/capture/entry",
        documentedPath: "/api/workflows/capture/entry-v2",
      },
      {
        key: "job.inspectRun",
        issue: "missing",
        expectedMethod: "POST",
        expectedPath: "/api/workflows/job/inspect-run",
      },
      {
        key: "job.list",
        issue: "extra",
        documentedMethod: "POST",
        documentedPath: "/api/workflows/job/list",
      },
    ]);
  });

  test("parsePersistedSchemaContract parses migration ids, tables, triggers, and indexes", () => {
    const markdown = `
## Migration Ledger

| Migration ID |
| --- |
| 001_core_schema |
| 002_core_constraints_indexes |

## Table Column Matrix

| Table | Columns |
| --- | --- |
| entry | id, content, source |
| task | id, title, status |

## Trigger Contract

| Trigger Name |
| --- |
| task_status_check_insert |
| task_status_check_update |

## Index Contract

| Index Name |
| --- |
| idx_task_status |
| idx_task_project_id |
`;

    expect(parsePersistedSchemaContract(markdown)).toEqual({
      migrationIds: ["001_core_schema", "002_core_constraints_indexes"],
      tables: [
        {
          table: "entry",
          columns: ["id", "content", "source"],
        },
        {
          table: "task",
          columns: ["id", "title", "status"],
        },
      ],
      triggerNames: ["task_status_check_insert", "task_status_check_update"],
      indexNames: ["idx_task_status", "idx_task_project_id"],
    });
  });

  test("findPersistedSchemaContractViolations reports missing, extra, and mismatch differences", () => {
    const documented: PersistedSchemaContract = {
      migrationIds: ["001_core_schema", "003_relation_integrity"],
      tables: [
        { table: "entry", columns: ["id", "content"] },
        { table: "task", columns: ["id", "title", "status"] },
      ],
      triggerNames: ["task_status_check_insert", "task_status_check_update"],
      indexNames: ["idx_task_status", "idx_task_project_id"],
    };

    const expected: PersistedSchemaContractExpected = {
      migrationIds: ["001_core_schema", "002_core_constraints_indexes"],
      tables: [
        { table: "entry", columns: ["id", "content", "source"] },
        { table: "event", columns: ["id", "title"] },
      ],
      triggerNames: ["task_status_check_insert", "job_run_state_check_insert"],
      indexNames: ["idx_task_status", "idx_event_sync_state"],
    };

    expect(
      findPersistedSchemaContractViolations({
        documented,
        expected,
      }),
    ).toEqual([
      {
        subject: "migration:002_core_constraints_indexes",
        issue: "missing",
        expected: "002_core_constraints_indexes",
      },
      {
        subject: "migration:003_relation_integrity",
        issue: "extra",
        documented: "003_relation_integrity",
      },
      {
        subject: "table:entry",
        issue: "mismatch",
        expected: "id,content,source",
        documented: "id,content",
      },
      {
        subject: "table:event",
        issue: "missing",
        expected: "id,title",
      },
      {
        subject: "table:task",
        issue: "extra",
        documented: "id,title,status",
      },
      {
        subject: "trigger:job_run_state_check_insert",
        issue: "missing",
        expected: "job_run_state_check_insert",
      },
      {
        subject: "trigger:task_status_check_update",
        issue: "extra",
        documented: "task_status_check_update",
      },
      {
        subject: "index:idx_event_sync_state",
        issue: "missing",
        expected: "idx_event_sync_state",
      },
      {
        subject: "index:idx_task_project_id",
        issue: "extra",
        documented: "idx_task_project_id",
      },
    ]);
  });

  test("findPersistedSchemaContractViolations reports duplicated documented values as extra rows", () => {
    const documented: PersistedSchemaContract = {
      migrationIds: ["001_core_schema", "001_core_schema"],
      tables: [{ table: "entry", columns: ["id", "content", "source"] }],
      triggerNames: ["task_status_check_insert", "task_status_check_insert"],
      indexNames: ["idx_task_status", "idx_task_status"],
    };

    const expected: PersistedSchemaContractExpected = {
      migrationIds: ["001_core_schema"],
      tables: [{ table: "entry", columns: ["id", "content", "source"] }],
      triggerNames: ["task_status_check_insert"],
      indexNames: ["idx_task_status"],
    };

    expect(
      findPersistedSchemaContractViolations({
        documented,
        expected,
      }),
    ).toEqual([
      {
        subject: "migration:001_core_schema",
        issue: "extra",
        documented: "001_core_schema",
      },
      {
        subject: "trigger:task_status_check_insert",
        issue: "extra",
        documented: "task_status_check_insert",
      },
      {
        subject: "index:idx_task_status",
        issue: "extra",
        documented: "idx_task_status",
      },
    ]);
  });
});

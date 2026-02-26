import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Effect } from "effect";

import type {
  WorkflowApi,
} from "../../src/api/workflows/contracts";
import {
  WORKFLOW_ROUTE_KEYS,
  type WorkflowRouteKey,
} from "../../src/contracts/workflow-route-keys";
import {
  WORKFLOW_ROUTE_PATHS,
  makeWorkflowRoutes,
} from "../../src/api/workflows/routes";
import { runSqliteMigrations } from "../../src/core/repositories/sqlite/migration-runner";
import { CORE_DB_MIGRATIONS } from "../../src/core/repositories/sqlite/migrations";
import {
  findWorkflowRouteContractViolations,
  parseMarkdownTableRows,
  parseAuthoritativeWorkflowContract,
} from "../../src/core/tooling/contract-doc-policy";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const AUTHORITATIVE_WORKFLOW_CONTRACT_DOC_PATH =
  "docs/contracts/workflow-api-schema-contract.md";

const applyCoreMigrations = (db: Database): Promise<void> =>
  Effect.runPromise(runSqliteMigrations(db, CORE_DB_MIGRATIONS));

const asTableNameRows = (value: unknown): ReadonlyArray<{ name: string }> =>
  value as ReadonlyArray<{ name: string }>;

const asColumnRows = (value: unknown): ReadonlyArray<{ name: string }> =>
  value as ReadonlyArray<{ name: string }>;

const readMigratedTableColumnMatrix = async (
  db: Database,
): Promise<
  ReadonlyArray<{ table: string; columns: ReadonlyArray<string> }>
> => {
  const tableRows = asTableNameRows(
    db
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all(),
  );

  return tableRows.map(({ name }) => {
    const escapedName = name.replace(/'/g, "''");
    const columnRows = asColumnRows(
      db.query(`PRAGMA table_info('${escapedName}')`).all(),
    );

    return {
      table: name,
      columns: columnRows.map((column) => column.name),
    };
  });
};

const readUserDefinedObjectNames = (
  db: Database,
  type: "trigger" | "index",
): ReadonlyArray<string> =>
  asTableNameRows(
    db
      .query(
        `SELECT name FROM sqlite_master WHERE type = '${type}' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      )
      .all(),
  ).map((row) => row.name);

const readAuthoritativeWorkflowContract = (): string =>
  readFileSync(
    resolve(repositoryRoot, AUTHORITATIVE_WORKFLOW_CONTRACT_DOC_PATH),
    "utf8",
  );

const readMarkdownSection = (markdown: string, heading: string): string => {
  const headingPattern = new RegExp(`^##\\s+${heading}\\s*$`, "m");
  const headingMatch = headingPattern.exec(markdown);
  if (!headingMatch) {
    return "";
  }

  const startIndex = headingMatch.index + headingMatch[0].length;
  const remainder = markdown.slice(startIndex);
  const nextHeading = /\n##\s+/.exec(remainder);
  return nextHeading
    ? remainder.slice(0, nextHeading.index).trim()
    : remainder.trim();
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
  listJobs: (_input) => Effect.die("unused"),
  listJobRunHistory: (_input) => Effect.die("unused"),
  retryJob: (_input) => Effect.die("unused"),
  createWorkflowCheckpoint: (_input) => Effect.die("unused"),
  inspectWorkflowCheckpoint: (_input) => Effect.die("unused"),
  keepCheckpoint: (_input) => Effect.die("unused"),
  recoverCheckpoint: (_input) => Effect.die("unused"),
  listActivity: (_input) => Effect.die("unused"),
});

describe("api contract docs", () => {
  test("neutral route-key manifest matches runtime route paths and contract-doc route rows", () => {
    const documentedRouteKeys = parseAuthoritativeWorkflowContract(
      readAuthoritativeWorkflowContract(),
    ).routes
      .map((row) => row.key)
      .sort() as WorkflowRouteKey[];

    const neutralRouteKeys = [...WORKFLOW_ROUTE_KEYS].sort();
    const runtimeRouteKeys = Object.keys(
      WORKFLOW_ROUTE_PATHS,
    ).sort() as WorkflowRouteKey[];

    expect(neutralRouteKeys).toEqual(runtimeRouteKeys);
    expect(documentedRouteKeys).toEqual(runtimeRouteKeys);
  });

  test("authoritative workflow contract route matrix matches runtime route registry", () => {
    const documented = parseAuthoritativeWorkflowContract(
      readAuthoritativeWorkflowContract(),
    ).routes;
    const expectedMethodByKey = Object.fromEntries(
      makeWorkflowRoutes(makeApiStub()).map((route) => [
        route.key,
        route.method,
      ]),
    ) as Record<WorkflowRouteKey, "POST">;

    expect(
      findWorkflowRouteContractViolations({
        documented,
        expectedPaths: WORKFLOW_ROUTE_PATHS,
        expectedMethodByKey,
      }),
    ).toEqual([]);

    expect(documented).toHaveLength(WORKFLOW_ROUTE_KEYS.length);
  });

  test("authoritative workflow contract includes API validation, error mapping, and dispatcher sections", () => {
    const markdown = readAuthoritativeWorkflowContract();
    const validationSection = readMarkdownSection(markdown, "Shared Validation Rules");
    const dispatcherSection = readMarkdownSection(markdown, "HTTP Dispatcher Contract");
    const errorMappingRows = parseMarkdownTableRows(
      markdown,
      "Service Error to API Status Mapping",
    );
    const errorMappings = new Map(
      errorMappingRows.map((row) => [
        (row["Service Error Code"] ?? "").trim(),
        {
          apiErrorCode: (row["API Error Code"] ?? "").trim(),
          status: (row["HTTP Status"] ?? "").trim(),
        },
      ]),
    );

    expect(markdown).toContain("## Shared Validation Rules");
    expect(validationSection).toMatch(/date fields/i);
    expect(validationSection).toMatch(/ISO-8601/i);
    expect(validationSection).toMatch(/non-empty strings?/i);
    expect(validationSection).toMatch(/trusted actor/i);
    expect(validationSection).toMatch(/approval\.approveOutboundAction/i);

    expect(markdown).toContain("## Service Error to API Status Mapping");
    expect(errorMappings.get("invalid_request")).toEqual({
      apiErrorCode: "validation",
      status: "400",
    });
    expect(errorMappings.get("forbidden")).toEqual({
      apiErrorCode: "forbidden",
      status: "403",
    });
    expect(errorMappings.get("conflict")).toEqual({
      apiErrorCode: "conflict",
      status: "409",
    });
    expect(errorMappings.get("not_found")).toEqual({
      apiErrorCode: "not_found",
      status: "404",
    });

    expect(markdown).toContain("## HTTP Dispatcher Contract");
    expect(dispatcherSection).toMatch(/404/);
    expect(dispatcherSection).toMatch(/405/);
    expect(dispatcherSection).toMatch(/sanitized body shape/i);
    expect(dispatcherSection).toMatch(/error,\s*route,\s*message/i);
    expect(dispatcherSection).toMatch(/500/);
    expect(dispatcherSection).toMatch(/trusted actor context/i);
    expect(dispatcherSection).toMatch(/spoof/i);
  });

  test("authoritative workflow contract defines request/response payload schemas per route", () => {
    const markdown = readAuthoritativeWorkflowContract();
    const payloadRows = parseMarkdownTableRows(
      markdown,
      "Route Payload Schema Matrix",
    );
    const rowByKey = new Map(
      payloadRows.map((row) => [(row["Route Key"] ?? "").trim(), row]),
    );

    expect(payloadRows).toHaveLength(WORKFLOW_ROUTE_KEYS.length);

    for (const routeKey of Object.keys(WORKFLOW_ROUTE_PATHS).sort()) {
      const row = rowByKey.get(routeKey);
      expect(row).toBeDefined();
      expect(((row?.["Request Required Fields"] ?? "") as string).trim()).not.toBe(
        "",
      );
      expect(((row?.["Success Response Fields"] ?? "") as string).trim()).not.toBe(
        "",
      );
    }

    const approvalRow = rowByKey.get("approval.approveOutboundAction");
    expect(approvalRow).toBeDefined();
    expect(
      ((approvalRow?.["Request Required Fields"] ?? "") as string).toLowerCase(),
    ).toContain("trusted");
  });

  test("authoritative workflow contract schema sections match migrated sqlite objects", async () => {
    const documented = parseAuthoritativeWorkflowContract(
      readAuthoritativeWorkflowContract(),
    ).persistedSchema;

    const db = new Database(":memory:");
    try {
      await applyCoreMigrations(db);
      const migratedTables = await readMigratedTableColumnMatrix(db);
      const triggerNames = readUserDefinedObjectNames(db, "trigger");
      const indexNames = readUserDefinedObjectNames(db, "index");

      expect(documented.migrationIds).toEqual(
        CORE_DB_MIGRATIONS.map((migration) => migration.id),
      );
      expect(documented.tables).toEqual(migratedTables);
      expect(documented.triggerNames).toEqual(triggerNames);
      expect(documented.indexNames).toEqual(indexNames);
    } finally {
      db.close();
    }
  });

  test("authoritative workflow contract includes persisted schema type/nullability/relation details", () => {
    const markdown = readAuthoritativeWorkflowContract();
    const documentedSchema = parseAuthoritativeWorkflowContract(markdown).persistedSchema;

    const tableDetails = parseMarkdownTableRows(
      markdown,
      "Persisted Table Detail Matrix",
    );
    const triggerBehaviorRows = parseMarkdownTableRows(
      markdown,
      "Trigger Behavior Matrix",
    );

    expect(tableDetails).toHaveLength(documentedSchema.tables.length);
    for (const row of tableDetails) {
      expect((row["Table"] ?? "").trim()).not.toBe("");
      expect((row["Column Contracts"] ?? "").trim()).not.toBe("");
      expect((row["Column Contracts"] ?? "").toLowerCase()).toMatch(
        /(required|optional)/,
      );
      expect((row["Column Contracts"] ?? "").toLowerCase()).toContain(":");
      expect((row["Relation + Trigger Notes"] ?? "").trim()).not.toBe("");
    }

    expect(triggerBehaviorRows.length).toBeGreaterThan(0);
    for (const row of triggerBehaviorRows) {
      expect((row["Trigger Scope"] ?? "").trim()).not.toBe("");
      expect((row["Enforced Contract"] ?? "").trim()).not.toBe("");
    }
  });

  test("authoritative workflow contract includes traceability + audit checklist sections", () => {
    const markdown = readAuthoritativeWorkflowContract();

    expect(markdown).toContain(
      "## Traceability Matrix (Contract -> Implementation -> Tests)",
    );
    expect(markdown).toContain("`src/api/workflows/routes.ts`");
    expect(markdown).toContain("`src/core/repositories/sqlite/migrations.ts`");
    expect(markdown).toContain(
      "`tests/integration/api-contract-docs.integration.test.ts`",
    );

    expect(markdown).toContain("## Audit Verification Commands");
    expect(markdown).toContain(
      "bun test tests/integration/api-contract-docs.integration.test.ts",
    );
    expect(markdown).toContain(
      "bun test tests/integration/workflow-api-http.integration.test.ts",
    );
    expect(markdown).toContain("bun run typecheck");
  });

  test("README links authoritative contract doc and compatibility docs", () => {
    const readme = readFileSync(resolve(repositoryRoot, "README.md"), "utf8");

    expect(readme).toContain(AUTHORITATIVE_WORKFLOW_CONTRACT_DOC_PATH);
    expect(readme).toContain("docs/contracts/workflow-api-routes.md");
    expect(readme).toContain("docs/contracts/persisted-schema.md");
  });

  test("README links API-006 TDD audit evidence and the audit doc records red/green proof", () => {
    const readme = readFileSync(resolve(repositoryRoot, "README.md"), "utf8");

    expect(readme).toContain("docs/contracts/api-006-tdd-audit.md");

    const auditLog = readFileSync(
      resolve(repositoryRoot, "docs/contracts/api-006-tdd-audit.md"),
      "utf8",
    );
    expect(auditLog).toContain("## Review Finding");
    expect(auditLog).toContain("## TDD Evidence");
    expect(auditLog).toContain("RED:");
    expect(auditLog).toContain("GREEN:");
  });

  test("legacy contract docs point to the authoritative contract doc", () => {
    const routeDoc = readFileSync(
      resolve(repositoryRoot, "docs/contracts/workflow-api-routes.md"),
      "utf8",
    );
    const schemaDoc = readFileSync(
      resolve(repositoryRoot, "docs/contracts/persisted-schema.md"),
      "utf8",
    );

    expect(routeDoc).toContain(AUTHORITATIVE_WORKFLOW_CONTRACT_DOC_PATH);
    expect(schemaDoc).toContain(AUTHORITATIVE_WORKFLOW_CONTRACT_DOC_PATH);
    expect(routeDoc.toLowerCase()).toContain("version");
    expect(schemaDoc.toLowerCase()).toContain("version");
    expect(routeDoc.toLowerCase()).toContain("update");
    expect(schemaDoc.toLowerCase()).toContain("update");
    expect(routeDoc).toMatch(
      /Current pointer verification date:\s*`\d{4}-\d{2}-\d{2}`/,
    );
    expect(schemaDoc).toMatch(
      /Current pointer verification date:\s*`\d{4}-\d{2}-\d{2}`/,
    );
  });
});

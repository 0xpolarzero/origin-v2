import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Effect } from "effect";

import type {
  WorkflowApi,
  WorkflowRouteKey,
} from "../../src/api/workflows/contracts";
import {
  WORKFLOW_ROUTE_PATHS,
  makeWorkflowRoutes,
} from "../../src/api/workflows/routes";
import { runSqliteMigrations } from "../../src/core/repositories/sqlite/migration-runner";
import { CORE_DB_MIGRATIONS } from "../../src/core/repositories/sqlite/migrations";
import {
  findWorkflowRouteContractViolations,
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

    expect(documented).toHaveLength(Object.keys(WORKFLOW_ROUTE_PATHS).length);
  });

  test("authoritative workflow contract includes API validation, error mapping, and dispatcher sections", () => {
    const markdown = readAuthoritativeWorkflowContract();

    expect(markdown).toContain("## Shared Validation Rules");
    expect(markdown).toContain(
      "Date fields accept either a Date instance or an ISO-8601 string with timezone (`Z` or offset).",
    );
    expect(markdown).toContain(
      "Fields documented as non-empty strings reject blank values after trimming.",
    );

    expect(markdown).toContain("## Service Error to API Status Mapping");
    expect(markdown).toContain(
      "| Service Error Code | API Error Code | HTTP Status |",
    );
    expect(markdown).toMatch(
      /\|\s*invalid_request\s*\|\s*validation\s*\|\s*400\s*\|/,
    );
    expect(markdown).toMatch(/\|\s*forbidden\s*\|\s*forbidden\s*\|\s*403\s*\|/);
    expect(markdown).toMatch(/\|\s*conflict\s*\|\s*conflict\s*\|\s*409\s*\|/);
    expect(markdown).toMatch(/\|\s*not_found\s*\|\s*not_found\s*\|\s*404\s*\|/);

    expect(markdown).toContain("## HTTP Dispatcher Contract");
    expect(markdown).toContain("Unknown route path returns `404`.");
    expect(markdown).toContain(
      "Unsupported method for a known path returns `405`.",
    );
    expect(markdown).toContain(
      "Mapped route failures return a sanitized body shape: `{ error, route, message }`.",
    );
    expect(markdown).toContain(
      "Unexpected dispatch defects return `500` with a generic internal server error message.",
    );
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
  });
});

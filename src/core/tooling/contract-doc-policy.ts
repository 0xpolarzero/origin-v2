import type { WorkflowRouteKey } from "../../contracts/workflow-route-keys";

export interface WorkflowRouteContractRow {
  key: WorkflowRouteKey;
  method: "POST";
  path: string;
}

export interface WorkflowRouteContractViolation {
  key: string;
  issue: "missing" | "extra" | "method-mismatch" | "path-mismatch";
  expectedMethod?: string;
  expectedPath?: string;
  documentedMethod?: string;
  documentedPath?: string;
}

export interface PersistedSchemaContract {
  migrationIds: ReadonlyArray<string>;
  tables: ReadonlyArray<{ table: string; columns: ReadonlyArray<string> }>;
  triggerNames: ReadonlyArray<string>;
  indexNames: ReadonlyArray<string>;
}

export type PersistedSchemaContractExpected = PersistedSchemaContract;

export interface PersistedSchemaContractViolation {
  subject: string;
  issue: "missing" | "extra" | "mismatch";
  expected?: string;
  documented?: string;
}

export interface AuthoritativeWorkflowContract {
  routes: ReadonlyArray<WorkflowRouteContractRow>;
  persistedSchema: PersistedSchemaContract;
}

const isHeadingLine = (line: string): boolean => /^#{1,6}\s+/.test(line.trim());

const headingTextFromLine = (line: string): string | null => {
  const match = /^#{1,6}\s+(.+)$/.exec(line.trim());
  return match ? match[1].trim() : null;
};

const splitMarkdownCells = (line: string): ReadonlyArray<string> => {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) {
    return [];
  }

  return trimmed
    .slice(1, trimmed.endsWith("|") ? -1 : undefined)
    .split("|")
    .map((cell) => cell.trim());
};

const isTableDelimiterRow = (line: string): boolean => {
  const cells = splitMarkdownCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
};

export const parseMarkdownTableRows = (
  markdown: string,
  heading: string,
): ReadonlyArray<Record<string, string>> => {
  const lines = markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex(
    (line) => headingTextFromLine(line) === heading,
  );

  if (headingIndex === -1) {
    return [];
  }

  let headerCells: ReadonlyArray<string> = [];
  let rowStartIndex = -1;

  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";

    if (line === "") {
      continue;
    }

    if (isHeadingLine(line)) {
      break;
    }

    const maybeHeaderCells = splitMarkdownCells(line);
    if (maybeHeaderCells.length === 0) {
      continue;
    }

    const delimiterLine = lines[index + 1] ?? "";
    if (!isTableDelimiterRow(delimiterLine)) {
      continue;
    }

    headerCells = maybeHeaderCells;
    rowStartIndex = index + 2;
    break;
  }

  if (headerCells.length === 0 || rowStartIndex === -1) {
    return [];
  }

  const rows: Array<Record<string, string>> = [];

  for (let index = rowStartIndex; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";

    if (line === "") {
      continue;
    }

    if (isHeadingLine(line)) {
      break;
    }

    const cells = splitMarkdownCells(line);
    if (cells.length === 0) {
      continue;
    }

    if (cells.length < headerCells.length) {
      continue;
    }

    const row: Record<string, string> = {};

    for (
      let columnIndex = 0;
      columnIndex < headerCells.length;
      columnIndex += 1
    ) {
      const key = headerCells[columnIndex];
      if (!key) {
        continue;
      }
      row[key] = cells[columnIndex] ?? "";
    }

    rows.push(row);
  }

  return rows;
};

export const parseWorkflowRouteContractRows = (
  markdown: string,
): ReadonlyArray<WorkflowRouteContractRow> => {
  const tableRows = parseMarkdownTableRows(markdown, "Route Matrix");
  const rows: WorkflowRouteContractRow[] = [];
  const seenKeys = new Set<string>();

  for (const row of tableRows) {
    const key = (row["Route Key"] ?? "").trim();
    const method = (row.Method ?? "").trim();
    const path = (row.Path ?? "").trim();

    if (key === "" || method === "" || path === "") {
      continue;
    }

    if (seenKeys.has(key)) {
      throw new Error(`duplicate documented workflow route key: ${key}`);
    }

    seenKeys.add(key);
    rows.push({
      key: key as WorkflowRouteKey,
      method: method as "POST",
      path,
    });
  }

  return rows;
};

export const findWorkflowRouteContractViolations = (params: {
  documented: ReadonlyArray<WorkflowRouteContractRow>;
  expectedPaths: Record<WorkflowRouteKey, string>;
  expectedMethodByKey?: Record<WorkflowRouteKey, "POST">;
}): ReadonlyArray<WorkflowRouteContractViolation> => {
  const expectedMethodByKey =
    params.expectedMethodByKey ??
    (Object.fromEntries(
      Object.keys(params.expectedPaths).map((key) => [key, "POST"]),
    ) as Record<WorkflowRouteKey, "POST">);

  const documentedByKey = new Map<string, WorkflowRouteContractRow>();
  for (const row of params.documented) {
    documentedByKey.set(row.key, row);
  }

  const violations: WorkflowRouteContractViolation[] = [];

  const expectedKeys = Object.keys(params.expectedPaths).sort();
  for (const key of expectedKeys) {
    const expectedMethod = expectedMethodByKey[key as WorkflowRouteKey];
    const expectedPath = params.expectedPaths[key as WorkflowRouteKey];
    const documented = documentedByKey.get(key);

    if (!documented) {
      violations.push({
        key,
        issue: "missing",
        expectedMethod,
        expectedPath,
      });
      continue;
    }

    if (documented.method !== expectedMethod) {
      violations.push({
        key,
        issue: "method-mismatch",
        expectedMethod,
        documentedMethod: documented.method,
      });
    }

    if (documented.path !== expectedPath) {
      violations.push({
        key,
        issue: "path-mismatch",
        expectedPath,
        documentedPath: documented.path,
      });
    }
  }

  const expectedKeySet = new Set<string>(Object.keys(params.expectedPaths));
  const extraKeys = params.documented
    .map((row) => row.key)
    .filter((key) => !expectedKeySet.has(key))
    .sort();

  for (const key of extraKeys) {
    const documented = documentedByKey.get(key);
    if (!documented) {
      continue;
    }

    violations.push({
      key,
      issue: "extra",
      documentedMethod: documented.method,
      documentedPath: documented.path,
    });
  }

  return violations;
};

const parseCommaSeparatedList = (value: string): ReadonlyArray<string> =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");

const joinValues = (values: ReadonlyArray<string>): string => values.join(",");
const normalizedValues = (values: ReadonlyArray<string>): ReadonlyArray<string> =>
  [...values].sort((left, right) => left.localeCompare(right));
const joinNormalizedValues = (values: ReadonlyArray<string>): string =>
  joinValues(normalizedValues(values));

const countValues = (values: ReadonlyArray<string>): Map<string, number> => {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
};

const listDiffViolations = (params: {
  documented: ReadonlyArray<string>;
  expected: ReadonlyArray<string>;
  subjectPrefix: string;
}): PersistedSchemaContractViolation[] => {
  const violations: PersistedSchemaContractViolation[] = [];
  const documentedCounts = countValues(params.documented);
  const expectedCounts = countValues(params.expected);
  const matchedDocumentedCounts = new Map<string, number>();
  const matchedExpectedCounts = new Map<string, number>();

  for (const expectedValue of params.expected) {
    const documentedCount = documentedCounts.get(expectedValue) ?? 0;
    const matchedCount = matchedDocumentedCounts.get(expectedValue) ?? 0;
    if (matchedCount < documentedCount) {
      matchedDocumentedCounts.set(expectedValue, matchedCount + 1);
      continue;
    }

    violations.push({
      subject: `${params.subjectPrefix}:${expectedValue}`,
      issue: "missing",
      expected: expectedValue,
    });
  }

  for (const documentedValue of params.documented) {
    const expectedCount = expectedCounts.get(documentedValue) ?? 0;
    const matchedCount = matchedExpectedCounts.get(documentedValue) ?? 0;
    if (matchedCount < expectedCount) {
      matchedExpectedCounts.set(documentedValue, matchedCount + 1);
      continue;
    }

    violations.push({
      subject: `${params.subjectPrefix}:${documentedValue}`,
      issue: "extra",
      documented: documentedValue,
    });
  }

  return violations;
};

export const parsePersistedSchemaContract = (
  markdown: string,
): PersistedSchemaContract => {
  const migrationIds = parseMarkdownTableRows(markdown, "Migration Ledger")
    .map((row) => (row["Migration ID"] ?? "").trim())
    .filter((value) => value !== "");

  const tables = parseMarkdownTableRows(markdown, "Table Column Matrix")
    .map((row) => {
      const table = (row.Table ?? "").trim();
      const columns = parseCommaSeparatedList(row.Columns ?? "");

      return { table, columns };
    })
    .filter((row) => row.table !== "" && row.columns.length > 0);

  const triggerNames = parseMarkdownTableRows(markdown, "Trigger Contract")
    .map((row) => (row["Trigger Name"] ?? "").trim())
    .filter((value) => value !== "");

  const indexNames = parseMarkdownTableRows(markdown, "Index Contract")
    .map((row) => (row["Index Name"] ?? "").trim())
    .filter((value) => value !== "");

  return {
    migrationIds,
    tables,
    triggerNames,
    indexNames,
  };
};

const assertRequiredContractSection = (
  section: string,
  count: number,
): void => {
  if (count <= 0) {
    throw new Error(`missing required contract section: ${section}`);
  }
};

export const parseAuthoritativeWorkflowContract = (
  markdown: string,
): AuthoritativeWorkflowContract => {
  const routes = parseWorkflowRouteContractRows(markdown);
  assertRequiredContractSection("Route Matrix", routes.length);

  const persistedSchema = parsePersistedSchemaContract(markdown);
  assertRequiredContractSection(
    "Migration Ledger",
    persistedSchema.migrationIds.length,
  );
  assertRequiredContractSection(
    "Table Column Matrix",
    persistedSchema.tables.length,
  );
  assertRequiredContractSection(
    "Trigger Contract",
    persistedSchema.triggerNames.length,
  );
  assertRequiredContractSection(
    "Index Contract",
    persistedSchema.indexNames.length,
  );

  return {
    routes,
    persistedSchema,
  };
};

export const findPersistedSchemaContractViolations = (params: {
  documented: PersistedSchemaContract;
  expected: PersistedSchemaContractExpected;
}): ReadonlyArray<PersistedSchemaContractViolation> => {
  const violations: PersistedSchemaContractViolation[] = [];

  violations.push(
    ...listDiffViolations({
      documented: params.documented.migrationIds,
      expected: params.expected.migrationIds,
      subjectPrefix: "migration",
    }),
  );

  const documentedTables = new Map<
    string,
    Array<{ table: string; columns: ReadonlyArray<string> }>
  >();
  for (const tableContract of params.documented.tables) {
    const existingRows = documentedTables.get(tableContract.table);
    if (existingRows) {
      existingRows.push(tableContract);
      violations.push({
        subject: `table:${tableContract.table}`,
        issue: "extra",
        documented: joinValues(tableContract.columns),
      });
      continue;
    }

    documentedTables.set(tableContract.table, [tableContract]);
  }
  const expectedTables = new Set(
    params.expected.tables.map((table) => table.table),
  );

  for (const expectedTable of params.expected.tables) {
    const documentedTable = documentedTables.get(expectedTable.table)?.[0];
    if (!documentedTable) {
      violations.push({
        subject: `table:${expectedTable.table}`,
        issue: "missing",
        expected: joinNormalizedValues(expectedTable.columns),
      });
      continue;
    }

    if (
      joinNormalizedValues(documentedTable.columns) !==
      joinNormalizedValues(expectedTable.columns)
    ) {
      violations.push({
        subject: `table:${expectedTable.table}`,
        issue: "mismatch",
        expected: joinNormalizedValues(expectedTable.columns),
        documented: joinNormalizedValues(documentedTable.columns),
      });
    }
  }

  for (const documentedTable of params.documented.tables) {
    if (!expectedTables.has(documentedTable.table)) {
      violations.push({
        subject: `table:${documentedTable.table}`,
        issue: "extra",
        documented: joinValues(documentedTable.columns),
      });
    }
  }

  violations.push(
    ...listDiffViolations({
      documented: params.documented.triggerNames,
      expected: params.expected.triggerNames,
      subjectPrefix: "trigger",
    }),
  );

  violations.push(
    ...listDiffViolations({
      documented: params.documented.indexNames,
      expected: params.expected.indexNames,
      subjectPrefix: "index",
    }),
  );

  return violations;
};

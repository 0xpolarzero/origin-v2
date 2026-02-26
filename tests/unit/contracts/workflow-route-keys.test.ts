import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ScriptTarget,
  SyntaxKind,
  createSourceFile,
  isIdentifier,
  isImportDeclaration,
  isNamedImports,
  isStringLiteral,
  isTypeAliasDeclaration,
  isTypeReferenceNode,
  type SourceFile,
} from "typescript";

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

const readTypeScriptSource = (relativePath: string): SourceFile =>
  createSourceFile(
    relativePath,
    readFileSync(resolve(import.meta.dir, relativePath), "utf8"),
    ScriptTarget.Latest,
    true,
  );

const findImportedLocalNames = (params: {
  source: SourceFile;
  modulePath: string;
  importedName: string;
}): Set<string> => {
  const localNames = new Set<string>();

  for (const statement of params.source.statements) {
    if (!isImportDeclaration(statement)) {
      continue;
    }
    if (
      !isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== params.modulePath
    ) {
      continue;
    }

    const namedBindings = statement.importClause?.namedBindings;
    if (!namedBindings || !isNamedImports(namedBindings)) {
      continue;
    }

    for (const element of namedBindings.elements) {
      const imported = element.propertyName?.text ?? element.name.text;
      if (imported === params.importedName) {
        localNames.add(element.name.text);
      }
    }
  }

  return localNames;
};

describe("workflow-route-keys", () => {
  test("WORKFLOW_ROUTE_KEYS defines the canonical key set without duplicates", () => {
    expect(WORKFLOW_ROUTE_KEYS).toEqual(EXPECTED_WORKFLOW_ROUTE_KEYS);
    expect(new Set(WORKFLOW_ROUTE_KEYS).size).toBe(WORKFLOW_ROUTE_KEYS.length);
  });

  test("api workflow contracts source WorkflowRouteKey from neutral contracts module", () => {
    const contractsSource = readTypeScriptSource(
      "../../../src/api/workflows/contracts.ts",
    );
    const importedWorkflowRouteKeyLocalNames = findImportedLocalNames({
      source: contractsSource,
      modulePath: "../../contracts/workflow-route-keys",
      importedName: "WorkflowRouteKey",
    });

    expect(importedWorkflowRouteKeyLocalNames.size).toBeGreaterThan(0);

    const exportedTypeAlias = contractsSource.statements.find(
      (statement) =>
        isTypeAliasDeclaration(statement) &&
        statement.name.text === "WorkflowRouteKey" &&
        (statement.modifiers?.some(
          (modifier) => modifier.kind === SyntaxKind.ExportKeyword,
        ) ??
          false),
    );

    expect(exportedTypeAlias).toBeDefined();
    if (!exportedTypeAlias || !isTypeAliasDeclaration(exportedTypeAlias)) {
      return;
    }

    expect(isTypeReferenceNode(exportedTypeAlias.type)).toBe(true);
    if (!isTypeReferenceNode(exportedTypeAlias.type)) {
      return;
    }
    expect(isIdentifier(exportedTypeAlias.type.typeName)).toBe(true);
    if (!isIdentifier(exportedTypeAlias.type.typeName)) {
      return;
    }

    expect(
      importedWorkflowRouteKeyLocalNames.has(
        exportedTypeAlias.type.typeName.text,
      ),
    ).toBe(true);
  });
});

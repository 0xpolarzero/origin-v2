import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { parseMarkdownTableRows } from "./contract-doc-policy";

export interface ReferenceRepository {
  name: string;
  url: string;
  expectedPath?: string;
}

export type ReferenceStrategyMode = "submodules" | "repository-links";

export interface ReferenceDocContract {
  mode: ReferenceStrategyMode;
  repositories: ReadonlyArray<ReferenceRepository>;
}

export interface ReferenceDocContractViolation {
  code: "missing-gitmodules" | "missing-path" | "stale-submodule-claim";
  detail: string;
}

const parseReferenceStrategyMode = (markdown: string): ReferenceStrategyMode => {
  const sectionMatch = /##\s+Reference Strategy\s*([\s\S]*?)(?:\n##\s+|$)/i.exec(
    markdown,
  );

  if (!sectionMatch) {
    throw new Error("missing or invalid reference strategy mode");
  }

  const modeMatch = /\bmode\b[^\n`]*(?:`)?(submodules|repository-links)(?:`)?/i.exec(
    sectionMatch[1] ?? "",
  );

  if (!modeMatch) {
    throw new Error("missing or invalid reference strategy mode");
  }

  return modeMatch[1]?.toLowerCase() as ReferenceStrategyMode;
};

const normalizeOptionalCell = (value: string | undefined): string | undefined => {
  const normalized = (value ?? "").trim();
  if (normalized === "" || normalized === "-" || normalized.toLowerCase() === "n/a") {
    return undefined;
  }

  return normalized;
};

export const parseReferenceDocContract = (
  markdown: string,
): ReferenceDocContract => {
  const mode = parseReferenceStrategyMode(markdown);
  const rows = parseMarkdownTableRows(markdown, "Reference Repositories");

  if (rows.length === 0) {
    throw new Error("missing reference repositories table");
  }

  const repositories = rows
    .map((row) => {
      const name = (row.Name ?? row.Repository ?? "").trim();
      const url = (row["Repository URL"] ?? row.URL ?? row.Repository ?? "").trim();
      const expectedPath = normalizeOptionalCell(row["Expected Local Path"]);

      if (name === "" || url === "") {
        return null;
      }

      return {
        name,
        url,
        ...(expectedPath ? { expectedPath } : {}),
      };
    })
    .filter((repository): repository is ReferenceRepository => repository !== null);

  return {
    mode,
    repositories,
  };
};

export const findReferenceDocContractViolations = (params: {
  contract: ReferenceDocContract;
  repoRoot: string;
}): ReadonlyArray<ReferenceDocContractViolation> => {
  const violations: ReferenceDocContractViolation[] = [];

  if (params.contract.mode === "submodules") {
    if (!existsSync(resolve(params.repoRoot, ".gitmodules"))) {
      violations.push({
        code: "missing-gitmodules",
        detail: "expected .gitmodules to exist for submodule reference strategy",
      });
    }

    for (const repository of params.contract.repositories) {
      if (!repository.expectedPath) {
        continue;
      }

      if (!existsSync(resolve(params.repoRoot, repository.expectedPath))) {
        violations.push({
          code: "missing-path",
          detail: `missing documented submodule path: ${repository.expectedPath} (${repository.name})`,
        });
      }
    }

    return violations;
  }

  for (const repository of params.contract.repositories) {
    if (!repository.expectedPath) {
      continue;
    }

    violations.push({
      code: "stale-submodule-claim",
      detail: `repository-links strategy cannot require local submodule path: ${repository.expectedPath} (${repository.name})`,
    });
  }

  return violations;
};

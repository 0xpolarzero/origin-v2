import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  findReferenceDocContractViolations,
  parseReferenceDocContract,
} from "../../src/core/tooling/reference-doc-policy";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const referencesDocPath = resolve(repositoryRoot, "docs/references.md");
const readmePath = resolve(repositoryRoot, "README.md");
const superRalphPromptPath = resolve(repositoryRoot, "docs/super-ralph.prompt.md");

const readText = (filePath: string): string => readFileSync(filePath, "utf8");

describe("reference docs contract integration", () => {
  test("docs/references strategy aligns with repository state", () => {
    const contract = parseReferenceDocContract(readText(referencesDocPath));

    expect(
      findReferenceDocContractViolations({
        contract,
        repoRoot: repositoryRoot,
      }),
    ).toEqual([]);
  });

  test("README and super-ralph prompt use the same declared reference strategy", () => {
    const contract = parseReferenceDocContract(readText(referencesDocPath));
    const readme = readText(readmePath).toLowerCase();
    const prompt = readText(superRalphPromptPath).toLowerCase();

    if (contract.mode === "repository-links") {
      expect(readme).toContain("repository-links");
      expect(prompt).toContain("repository-links");
      expect(readme).not.toContain("as submodules");
      expect(prompt).not.toContain("as submodules");
      return;
    }

    expect(readme).toContain("submodule");
    expect(prompt).toContain("submodule");
  });
});

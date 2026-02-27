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
const generatedPromptPath = resolve(repositoryRoot, ".super-ralph/generated/PROMPT.md");
const generatedWorkflowPath = resolve(
  repositoryRoot,
  ".super-ralph/generated/workflow.tsx",
);

const readText = (filePath: string): string => readFileSync(filePath, "utf8");
const extractReferencesPolicySection = (markdown: string): string => {
  const match = /##\s+References policy\s*([\s\S]*?)(?:\n##\s+|$)/i.exec(markdown);
  if (!match?.[1]) {
    throw new Error("Missing references policy section");
  }

  return match[1].trim();
};

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
    const prompt = readText(superRalphPromptPath);
    const promptLower = prompt.toLowerCase();

    if (contract.mode === "repository-links") {
      expect(readme).toContain("repository-links");
      expect(promptLower).toContain("repository-links");
      expect(readme).not.toContain("as submodules");
      expect(promptLower).not.toContain("as submodules");
      return;
    }

    expect(readme).toContain("submodule");
    expect(promptLower).toContain("submodule");
  });

  test("generated prompt references policy section stays aligned with docs/super-ralph.prompt.md", () => {
    const canonicalPrompt = readText(superRalphPromptPath);
    const generatedPrompt = readText(generatedPromptPath);

    expect(extractReferencesPolicySection(generatedPrompt)).toBe(
      extractReferencesPolicySection(canonicalPrompt),
    );
  });

  test("generated workflow embeds repository-links policy and bans stale submodule wording", () => {
    const canonicalPrompt = readText(superRalphPromptPath);
    const workflowSource = readText(generatedWorkflowPath);
    const canonicalPolicy = extractReferencesPolicySection(canonicalPrompt);

    expect(canonicalPolicy).toContain("repository-links");
    expect(canonicalPolicy).toContain(
      "local submodule checkouts under `docs/references/*` are optional.",
    );

    expect(workflowSource).toContain(
      "Follow the `repository-links` strategy documented there; local submodule checkouts under `docs/references/*` are optional.",
    );
    expect(workflowSource).not.toContain(
      "Use them as submodules under `docs/references/*` when available.",
    );
  });
});

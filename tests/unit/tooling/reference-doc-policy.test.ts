import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  findReferenceDocContractViolations,
  parseReferenceDocContract,
  type ReferenceDocContract,
} from "../../../src/core/tooling/reference-doc-policy";

const validRepositoryLinksMarkdown = `
## Reference Strategy

Mode: repository-links

## Reference Repositories

| Name | Repository URL | Expected Local Path |
| --- | --- | --- |
| effect | https://github.com/Effect-TS/effect | |
| pi-mono | https://github.com/badlogic/pi-mono | |
`;

const withTempRepositoryRoot = (
  run: (repoRoot: string) => void,
): void => {
  const repoRoot = mkdtempSync(join(tmpdir(), "origin-v2-reference-doc-policy-"));

  try {
    run(repoRoot);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
};

describe("reference-doc-policy", () => {
  test("parseReferenceDocContract parses mode and repository rows", () => {
    expect(parseReferenceDocContract(validRepositoryLinksMarkdown)).toEqual({
      mode: "repository-links",
      repositories: [
        {
          name: "effect",
          url: "https://github.com/Effect-TS/effect",
        },
        {
          name: "pi-mono",
          url: "https://github.com/badlogic/pi-mono",
        },
      ],
    });
  });

  test("parseReferenceDocContract throws when required strategy section is missing", () => {
    const markdown = `
## Reference Repositories

| Name | Repository URL |
| --- | --- |
| effect | https://github.com/Effect-TS/effect |
`;

    expect(() => parseReferenceDocContract(markdown)).toThrow(
      "missing or invalid reference strategy mode",
    );
  });

  test("findReferenceDocContractViolations reports missing-gitmodules in submodules mode", () => {
    const contract: ReferenceDocContract = {
      mode: "submodules",
      repositories: [
        {
          name: "effect",
          url: "https://github.com/Effect-TS/effect",
          expectedPath: "docs/references/effect",
        },
      ],
    };

    withTempRepositoryRoot((repoRoot) => {
      expect(
        findReferenceDocContractViolations({
          contract,
          repoRoot,
        }),
      ).toEqual([
        {
          code: "missing-gitmodules",
          detail: "expected .gitmodules to exist for submodule reference strategy",
        },
        {
          code: "missing-path",
          detail: "missing documented submodule path: docs/references/effect (effect)",
        },
      ]);
    });
  });

  test("findReferenceDocContractViolations reports missing-path for absent documented local path", () => {
    const contract: ReferenceDocContract = {
      mode: "submodules",
      repositories: [
        {
          name: "effect",
          url: "https://github.com/Effect-TS/effect",
          expectedPath: "docs/references/effect",
        },
      ],
    };

    withTempRepositoryRoot((repoRoot) => {
      writeFileSync(resolve(repoRoot, ".gitmodules"), "", "utf8");

      expect(
        findReferenceDocContractViolations({
          contract,
          repoRoot,
        }),
      ).toEqual([
        {
          code: "missing-path",
          detail: "missing documented submodule path: docs/references/effect (effect)",
        },
      ]);
    });
  });

  test("findReferenceDocContractViolations reports stale-submodule-claim in repository-links mode", () => {
    const contract: ReferenceDocContract = {
      mode: "repository-links",
      repositories: [
        {
          name: "effect",
          url: "https://github.com/Effect-TS/effect",
          expectedPath: "docs/references/effect",
        },
      ],
    };

    withTempRepositoryRoot((repoRoot) => {
      expect(
        findReferenceDocContractViolations({
          contract,
          repoRoot,
        }),
      ).toEqual([
        {
          code: "stale-submodule-claim",
          detail:
            "repository-links strategy cannot require local submodule path: docs/references/effect (effect)",
        },
      ]);
    });
  });

  test("findReferenceDocContractViolations returns no violations when contract and repository align", () => {
    const contract: ReferenceDocContract = {
      mode: "submodules",
      repositories: [
        {
          name: "effect",
          url: "https://github.com/Effect-TS/effect",
          expectedPath: "docs/references/effect",
        },
      ],
    };

    withTempRepositoryRoot((repoRoot) => {
      writeFileSync(resolve(repoRoot, ".gitmodules"), "", "utf8");
      mkdirSync(resolve(repoRoot, "docs/references/effect"), { recursive: true });

      expect(
        findReferenceDocContractViolations({
          contract,
          repoRoot,
        }),
      ).toEqual([]);
    });
  });
});

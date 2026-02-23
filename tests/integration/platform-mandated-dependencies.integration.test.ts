import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  MANDATED_VERSION_SNAPSHOT,
  buildMandatedDependencySpecs,
  findManifestDependencyViolations,
  type PackageJsonLike,
} from "../../src/core/tooling/platform-dependency-policy";

const repositoryRoot = process.cwd();
const packageJsonPath = resolve(repositoryRoot, "package.json");
const lockfilePath = resolve(repositoryRoot, "bun.lock");
const engineeringChoicesPath = resolve(
  repositoryRoot,
  "docs/engineering.choices.md",
);

const escapeForRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const readPackageJson = (): PackageJsonLike & {
  scripts?: Record<string, string>;
} =>
  JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJsonLike & {
    scripts?: Record<string, string>;
  };

describe("platform mandated dependencies integration", () => {
  test("current package.json satisfies all mandated specs with exact versions", () => {
    const specs = buildMandatedDependencySpecs(MANDATED_VERSION_SNAPSHOT);
    const packageJson = readPackageJson();

    const violations = findManifestDependencyViolations(packageJson, specs);

    expect(violations).toEqual([]);
  });

  test("bun.lock contains resolved entries for each mandated package/version", () => {
    const specs = buildMandatedDependencySpecs(MANDATED_VERSION_SNAPSHOT);
    const lockfileText = readFileSync(lockfilePath, "utf8");

    for (const spec of specs) {
      const packageName = escapeForRegExp(spec.packageName);
      const version = escapeForRegExp(spec.expectedVersion);
      const entryPattern = new RegExp(
        `"${packageName}"\\s*:\\s*\\["${packageName}@${version}"`,
      );

      expect(entryPattern.test(lockfileText)).toBe(true);
    }
  });

  test("core policy snapshot remains aligned with engineering choices source list", () => {
    const engineeringChoices = readFileSync(engineeringChoicesPath, "utf8");
    const packageJson = readPackageJson();

    expect(engineeringChoices).toContain("Desktop shell: Electron");
    expect(engineeringChoices).toContain("Language/build: TypeScript + Vite");
    expect(engineeringChoices).toContain("UI: React + shadcn/ui");
    expect(engineeringChoices).toContain("Effect system: Effect");
    expect(engineeringChoices).toContain("AI integration: pi-mono");

    expect(packageJson.scripts?.["test:integration:platform"]).toBe(
      "bun test tests/integration/platform-mandated-dependencies.integration.test.ts",
    );
  });
});

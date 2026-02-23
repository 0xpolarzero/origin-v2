import { describe, expect, test } from "bun:test";

import {
  buildMandatedDependencySpecs,
  findManifestDependencyViolations,
  isExactVersionPin,
  type MandatedVersionSnapshot,
} from "../../../src/core/tooling/platform-dependency-policy";

const mandatedVersions: MandatedVersionSnapshot = {
  electron: "40.6.0",
  typescript: "5.9.3",
  vite: "7.3.1",
  react: "19.2.4",
  reactDom: "19.2.4",
  shadcn: "3.8.5",
  effect: "3.19.19",
  piAi: "0.54.2",
};

describe("platform-dependency-policy", () => {
  test("isExactVersionPin accepts exact pins and rejects ranges/tags", () => {
    expect(isExactVersionPin("40.6.0")).toBe(true);
    expect(isExactVersionPin("19.2.4")).toBe(true);

    expect(isExactVersionPin("^40.6.0")).toBe(false);
    expect(isExactVersionPin("~7.3.1")).toBe(false);
    expect(isExactVersionPin("latest")).toBe(false);
    expect(isExactVersionPin("github:evmts/super-ralph#ef8726d")).toBe(false);
    expect(isExactVersionPin("workspace:*")).toBe(false);
  });

  test("buildMandatedDependencySpecs maps stack requirements to package specs", () => {
    expect(buildMandatedDependencySpecs(mandatedVersions)).toEqual([
      {
        stackItem: "electron",
        packageName: "electron",
        expectedSection: "devDependencies",
        expectedVersion: "40.6.0",
      },
      {
        stackItem: "typescript",
        packageName: "typescript",
        expectedSection: "devDependencies",
        expectedVersion: "5.9.3",
      },
      {
        stackItem: "vite",
        packageName: "vite",
        expectedSection: "devDependencies",
        expectedVersion: "7.3.1",
      },
      {
        stackItem: "react",
        packageName: "react",
        expectedSection: "dependencies",
        expectedVersion: "19.2.4",
      },
      {
        stackItem: "react",
        packageName: "react-dom",
        expectedSection: "dependencies",
        expectedVersion: "19.2.4",
      },
      {
        stackItem: "shadcn",
        packageName: "shadcn",
        expectedSection: "devDependencies",
        expectedVersion: "3.8.5",
      },
      {
        stackItem: "effect",
        packageName: "effect",
        expectedSection: "dependencies",
        expectedVersion: "3.19.19",
      },
      {
        stackItem: "pi-mono",
        packageName: "@mariozechner/pi-ai",
        expectedSection: "dependencies",
        expectedVersion: "0.54.2",
      },
    ]);
  });

  test("findManifestDependencyViolations detects missing, wrong section, and pin/version issues", () => {
    const violations = findManifestDependencyViolations(
      {
        dependencies: {
          react: "^19.2.4",
          vite: "7.3.1",
        },
        devDependencies: {
          electron: "40.5.0",
        },
      },
      [
        {
          stackItem: "react",
          packageName: "react",
          expectedSection: "dependencies",
          expectedVersion: "19.2.4",
        },
        {
          stackItem: "vite",
          packageName: "vite",
          expectedSection: "devDependencies",
          expectedVersion: "7.3.1",
        },
        {
          stackItem: "electron",
          packageName: "electron",
          expectedSection: "devDependencies",
          expectedVersion: "40.6.0",
        },
        {
          stackItem: "pi-mono",
          packageName: "@mariozechner/pi-ai",
          expectedSection: "dependencies",
          expectedVersion: "0.54.2",
        },
      ],
    );

    expect(violations).toEqual([
      {
        packageName: "react",
        issue: "not-pinned",
        expectedSection: "dependencies",
        expectedVersion: "19.2.4",
        actualSection: "dependencies",
        actualVersion: "^19.2.4",
      },
      {
        packageName: "vite",
        issue: "wrong-section",
        expectedSection: "devDependencies",
        expectedVersion: "7.3.1",
        actualSection: "dependencies",
        actualVersion: "7.3.1",
      },
      {
        packageName: "electron",
        issue: "version-mismatch",
        expectedSection: "devDependencies",
        expectedVersion: "40.6.0",
        actualSection: "devDependencies",
        actualVersion: "40.5.0",
      },
      {
        packageName: "@mariozechner/pi-ai",
        issue: "missing",
        expectedSection: "dependencies",
        expectedVersion: "0.54.2",
      },
    ]);
  });

  test("findManifestDependencyViolations flags mandated packages declared in both sections", () => {
    const violations = findManifestDependencyViolations(
      {
        dependencies: {
          react: "19.2.4",
        },
        devDependencies: {
          react: "19.2.4",
        },
      },
      [
        {
          stackItem: "react",
          packageName: "react",
          expectedSection: "dependencies",
          expectedVersion: "19.2.4",
        },
      ],
    );

    expect(violations).toEqual([
      {
        packageName: "react",
        issue: "wrong-section",
        expectedSection: "dependencies",
        expectedVersion: "19.2.4",
        actualSection: "devDependencies",
        actualVersion: "19.2.4",
      },
    ]);
  });
});

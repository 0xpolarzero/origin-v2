import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";

import {
  buildFallbackConfig,
  toRepoRelativePath,
} from "super-ralph/cli/fallback-config";

function makeTempRepoFixture(): string {
  const repoRoot = mkdtempSync(join(tmpdir(), "fallback-config-portability-"));
  mkdirSync(join(repoRoot, "docs/specs"), { recursive: true });
  mkdirSync(join(repoRoot, ".super-ralph/generated"), { recursive: true });
  writeFileSync(join(repoRoot, "docs/specs/engineering.md"), "# Spec\n");
  writeFileSync(
    join(repoRoot, ".super-ralph/generated/PROMPT.md"),
    "# Prompt\n",
  );
  writeFileSync(join(repoRoot, "README.md"), "# Fixture\n");
  return repoRoot;
}

function assertRepoRelative(pathValue: string): void {
  expect(isAbsolute(pathValue)).toBe(false);
  expect(pathValue.startsWith("..")).toBe(false);
}

describe("fallback config portability", () => {
  test("toRepoRelativePath normalizes absolute/relative inputs into repo-relative paths", () => {
    const repoRoot = makeTempRepoFixture();

    try {
      const absolutePromptPath = join(
        repoRoot,
        ".super-ralph/generated/PROMPT.md",
      );

      expect(toRepoRelativePath(repoRoot, absolutePromptPath)).toBe(
        ".super-ralph/generated/PROMPT.md",
      );
      expect(toRepoRelativePath(repoRoot, "./docs/specs/engineering.md")).toBe(
        "docs/specs/engineering.md",
      );
      expect(
        toRepoRelativePath(repoRoot, ".\\docs\\specs\\engineering.md"),
      ).toBe("docs/specs/engineering.md");
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test("buildFallbackConfig emits repo-relative specsPath/referenceFiles", () => {
    const repoRoot = makeTempRepoFixture();

    try {
      const fallbackConfig = buildFallbackConfig(
        repoRoot,
        join(repoRoot, ".super-ralph/generated/PROMPT.md"),
        {
          test: "bun test",
          typecheck: "bunx tsc --noEmit",
        },
      );

      assertRepoRelative(fallbackConfig.specsPath);
      for (const referenceFile of fallbackConfig.referenceFiles) {
        assertRepoRelative(referenceFile);
      }
      expect(fallbackConfig.specsPath).toBe("docs/specs/engineering.md");
      expect(fallbackConfig.referenceFiles).toContain(
        ".super-ralph/generated/PROMPT.md",
      );
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});

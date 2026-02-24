import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

describe("api contract docs cwd portability", () => {
  test("api-contract-docs integration checks pass when invoked outside the repository root", () => {
    const temporaryDirectory = mkdtempSync(
      join(tmpdir(), "origin-v2-api-contract-docs-cwd-"),
    );
    const integrationTestPath = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "api-contract-docs.integration.test.ts",
    );

    try {
      const result = Bun.spawnSync({
        cmd: ["bun", "test", integrationTestPath],
        cwd: temporaryDirectory,
        stdout: "pipe",
        stderr: "pipe",
      });

      const output =
        `${result.stdout.toString("utf8")}\n${result.stderr.toString("utf8")}`.trim();

      expect(result.exitCode, output).toBe(0);
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});

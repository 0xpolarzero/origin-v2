import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const declarationPath = resolve(
  process.cwd(),
  "src/types/super-ralph/cli-fallback-config.d.ts",
);

describe("cli fallback-config type declarations", () => {
  test("FallbackConfig exposes the full patched fallback contract shape", () => {
    const declaration = readFileSync(declarationPath, "utf8");

    expect(declaration).toContain("projectName: string;");
    expect(declaration).toContain("projectId: string;");
    expect(declaration).toContain("focuses: FallbackFocus[];");
    expect(declaration).toContain("codeStyle: string;");
    expect(declaration).toContain("reviewChecklist: string[];");
    expect(declaration).toContain("maxConcurrency: number;");
    expect(declaration).toContain("commitPolicy: {");
    expect(declaration).toContain("allowedTypes: string[];");
    expect(declaration).toContain("requireAtomicChecks: boolean;");
  });
});

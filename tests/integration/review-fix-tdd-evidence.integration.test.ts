import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dir, "../..");
const coreRevTest002EvidencePath = resolve(
  repositoryRoot,
  "docs/context/CORE-REV-TEST-002-review-fix-tdd.md",
);

describe("review-fix TDD evidence", () => {
  test("CORE-REV-TEST-002 records historical tests-first gap and remediation", () => {
    const markdown = readFileSync(coreRevTest002EvidencePath, "utf8");

    expect(markdown).toContain("# CORE-REV-TEST-002 Review-Fix TDD Evidence");
    expect(markdown).toContain("f679be3");
    expect(markdown).toContain("df3e4d2");
    expect(markdown).toMatch(/cannot be retroactively/i);
    expect(markdown).toMatch(/review-fix phase/i);
  });
});

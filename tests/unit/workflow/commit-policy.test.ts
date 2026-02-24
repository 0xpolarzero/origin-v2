import { describe, expect, test } from "bun:test";

import {
  DEFAULT_ALLOWED_COMMIT_TYPES,
  assertCommitMessageAllowed,
  normalizeCommitPolicy,
  parseCommitType,
} from "super-ralph/components";

function assertThrowsPolicyError(fn: () => unknown, pattern: RegExp): void {
  expect(fn).toThrow(pattern);
}

describe("commit-policy", () => {
  test("parseCommitType accepts feat/fix/docs/chore and rejects non-conventional messages", () => {
    expect(parseCommitType("feat: add commit policy")).toBe("feat");
    expect(parseCommitType("fix(workflow): enforce ticket gates")).toBe("fix");
    expect(parseCommitType("docs(api): update contract")).toBe("docs");
    expect(parseCommitType("chore: tune lint config")).toBe("chore");

    expect(parseCommitType("refactor(core): split helpers")).toBe("refactor");
    expect(parseCommitType("just some message")).toBeNull();
    expect(parseCommitType("")).toBeNull();
  });

  test("normalizeCommitPolicy fails closed and dedupes allowlist", () => {
    const deduped = normalizeCommitPolicy({
      allowedTypes: [" fix ", "docs", "fix", "", 1, "DOCS"],
      requireAtomicChecks: false,
    });

    expect(deduped).toEqual({
      allowedTypes: ["fix", "docs"],
      requireAtomicChecks: false,
    });

    expect(
      normalizeCommitPolicy({
        allowedTypes: [],
        requireAtomicChecks: "yes",
      }),
    ).toEqual({
      allowedTypes: [...DEFAULT_ALLOWED_COMMIT_TYPES],
      requireAtomicChecks: true,
    });

    expect(normalizeCommitPolicy(null)).toEqual({
      allowedTypes: [...DEFAULT_ALLOWED_COMMIT_TYPES],
      requireAtomicChecks: true,
    });
  });

  test("assertCommitMessageAllowed enforces AGENTS commit types", () => {
    const policy = normalizeCommitPolicy({
      allowedTypes: ["feat", "fix", "docs", "chore"],
      requireAtomicChecks: true,
    });

    expect(() =>
      assertCommitMessageAllowed("feat(core): add commit policy checks", policy),
    ).not.toThrow();
    expect(() =>
      assertCommitMessageAllowed("FIX: patch ticket gate fallback", policy),
    ).not.toThrow();

    assertThrowsPolicyError(
      () =>
        assertCommitMessageAllowed(
          "refactor(core): split prompt wiring helper",
          policy,
        ),
      /allowed commit types/i,
    );
    assertThrowsPolicyError(
      () => assertCommitMessageAllowed("update workflow docs", policy),
      /conventional commit/i,
    );
  });
});

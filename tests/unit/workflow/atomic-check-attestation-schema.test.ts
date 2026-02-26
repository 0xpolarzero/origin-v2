import { describe, expect, test } from "bun:test";

import { ralphOutputSchemas } from "super-ralph/schemas";

const validAtomicCommitEvidence = [
  {
    commitMessage: "fix(core): enforce atomic check discipline",
    checks: [
      { command: "bun run typecheck", passed: true },
      { command: "bun run test:core", passed: true },
    ],
  },
];

describe("atomic-check attestation schema", () => {
  test("implement output requires per-commit check evidence", () => {
    expect(() =>
      ralphOutputSchemas.implement.parse({
        whatWasDone: "Implemented feature with tests.",
        filesCreated: null,
        filesModified: ["src/core/foo.ts"],
        nextSteps: null,
      }),
    ).toThrow();
  });

  test("review-fix output requires per-commit check evidence", () => {
    expect(() =>
      ralphOutputSchemas.review_fix.parse({
        allIssuesResolved: true,
        summary: "Addressed all review findings.",
      }),
    ).toThrow();
  });

  test("evidence requires conventional allowlisted commit messages and passing checks", () => {
    expect(() =>
      ralphOutputSchemas.implement.parse({
        whatWasDone: "Implemented feature with tests.",
        filesCreated: null,
        filesModified: ["src/core/foo.ts"],
        nextSteps: null,
        atomicCommitEvidence: [
          {
            commitMessage: "refactor(core): split helpers",
            checks: [
              { command: "bun run typecheck", passed: true },
              { command: "bun run test:core", passed: true },
            ],
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      ralphOutputSchemas.implement.parse({
        whatWasDone: "Implemented feature with tests.",
        filesCreated: null,
        filesModified: ["src/core/foo.ts"],
        nextSteps: null,
        atomicCommitEvidence: [
          {
            commitMessage: "fix(core): enforce checks",
            checks: [{ command: "bun run typecheck", passed: false }],
          },
        ],
      }),
    ).toThrow();
  });

  test("valid evidence passes for implement and review-fix outputs", () => {
    expect(() =>
      ralphOutputSchemas.implement.parse({
        whatWasDone: "Implemented feature with tests.",
        filesCreated: null,
        filesModified: ["src/core/foo.ts"],
        nextSteps: null,
        atomicCommitEvidence: validAtomicCommitEvidence,
      }),
    ).not.toThrow();

    expect(() =>
      ralphOutputSchemas.review_fix.parse({
        allIssuesResolved: true,
        summary: "Addressed all review findings.",
        atomicCommitEvidence: validAtomicCommitEvidence,
      }),
    ).not.toThrow();
  });
});

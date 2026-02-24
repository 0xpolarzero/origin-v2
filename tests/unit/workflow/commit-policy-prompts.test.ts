import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readPromptSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function assertCommitAllowlistContract(source: string, context: string): void {
  expect(context.trim().length).toBeGreaterThan(0);
  expect(source).toContain("allowed commit types: feat|fix|docs|chore");
  expect(source).not.toContain("EMOJI");
  expect(source).not.toContain("type(scope): description");
  expect(source).not.toMatch(/[✨🐛♻️📝🧪]/);
}

describe("commit-policy prompt contract", () => {
  test("Implement prompt enforces allowlist and check-before-atomic-commit flow", () => {
    const source = readPromptSource(
      "node_modules/super-ralph/src/prompts/Implement.mdx",
    );

    assertCommitAllowlistContract(source, "Implement");
    expect(source).toContain("Before each atomic `jj describe`");
    expect(source).toContain("props.atomicCheckCommands");
  });

  test("ReviewFix prompt enforces allowlist and check-before-atomic-commit flow", () => {
    const source = readPromptSource(
      "node_modules/super-ralph/src/prompts/ReviewFix.mdx",
    );

    assertCommitAllowlistContract(source, "ReviewFix");
    expect(source).toContain("Before each atomic `jj describe`");
    expect(source).toContain("props.atomicCheckCommands");
  });

  test("Test prompt enforces allowlist and check-before-atomic-commit flow for fixes", () => {
    const source = readPromptSource("node_modules/super-ralph/src/prompts/Test.mdx");

    assertCommitAllowlistContract(source, "Test");
    expect(source).toContain("Before each atomic `jj describe`");
    expect(source).toContain("run typecheck + relevant tests");
  });

  test("BuildVerify prompt enforces allowlist and check-before-atomic-commit flow for build fixes", () => {
    const source = readPromptSource(
      "node_modules/super-ralph/src/prompts/BuildVerify.mdx",
    );

    assertCommitAllowlistContract(source, "BuildVerify");
    expect(source).toContain("Before each atomic `jj describe`");
    expect(source).toContain("run typecheck + relevant tests");
  });

  test("Plan prompt enforces allowlist and removes emoji/default templates", () => {
    const source = readPromptSource("node_modules/super-ralph/src/prompts/Plan.mdx");

    assertCommitAllowlistContract(source, "Plan");
    expect(source).toContain('jj describe -m "docs(');
  });

  test("Research prompt enforces allowlist and removes emoji/default templates", () => {
    const source = readPromptSource(
      "node_modules/super-ralph/src/prompts/Research.mdx",
    );

    assertCommitAllowlistContract(source, "Research");
    expect(source).toContain('jj describe -m "docs(');
  });

  test("UpdateProgress prompt enforces allowlist and removes emoji/default templates", () => {
    const source = readPromptSource(
      "node_modules/super-ralph/src/prompts/UpdateProgress.mdx",
    );

    assertCommitAllowlistContract(source, "UpdateProgress");
    expect(source).toContain("jj describe -m");
    expect(source).toContain("docs: update progress report");
  });
});

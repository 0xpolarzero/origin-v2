import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readModuleSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function expectUsesBookmarksRevset(source: string): void {
  expect(source).toContain('bookmarks("ticket/{props.ticketId}")');
  expect(source).not.toContain('bookmark("ticket/{props.ticketId}")');
}

describe("jj traceability prompts", () => {
  test("Land prompt uses plural bookmarks revset syntax for ticket branches", () => {
    const landPrompt = readModuleSource(
      "node_modules/super-ralph/src/prompts/Land.mdx",
    );

    expectUsesBookmarksRevset(landPrompt);
  });

  test("UpdateProgress prompt requires bookmark-visible checkpoint flow", () => {
    const updateProgressPrompt = readModuleSource(
      "node_modules/super-ralph/src/prompts/UpdateProgress.mdx",
    );

    expect(updateProgressPrompt).toContain("jj describe -m");
    expect(updateProgressPrompt).toContain("jj new");
    expect(updateProgressPrompt).toContain("jj bookmark set");
    expect(updateProgressPrompt).toContain("jj git push --bookmark");
    expect(updateProgressPrompt).toContain("bookmarks(");
  });
});

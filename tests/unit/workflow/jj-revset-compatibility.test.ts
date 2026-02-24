import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readCoordinatorSource(): string {
  return readFileSync(
    resolve(
      process.cwd(),
      "node_modules/super-ralph/src/mergeQueue/coordinator.ts",
    ),
    "utf8",
  );
}

function extractFunctionBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start < 0) {
    throw new Error(`Missing function signature: ${signature}`);
  }

  const openBrace = source.indexOf("{", start);
  if (openBrace < 0) {
    throw new Error(`Missing opening brace for: ${signature}`);
  }

  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return source.slice(openBrace + 1, index);
    }
  }

  throw new Error(`Unterminated function body for: ${signature}`);
}

describe("jj revset compatibility helpers", () => {
  test("merge queue builds ticket revsets with plural bookmarks helper", () => {
    const source = readCoordinatorSource();

    expect(source).toContain("function ticketBookmarkRevset(ticketId: string)");
    expect(source).toContain('bookmarks("ticket/');
    expect(source).not.toContain('bookmark("ticket/');
  });

  test("ticket bookmark revset helper escapes ticket ids for revset strings", () => {
    const source = readCoordinatorSource();
    const escapeFnBody = extractFunctionBody(
      source,
      "function escapeRevsetString(value: string)",
    );
    const ticketFnBody = extractFunctionBody(
      source,
      "function ticketBookmarkRevset(ticketId: string)",
    );

    expect(escapeFnBody).toContain('replace(/\\\\/g, "\\\\\\\\")');
    expect(escapeFnBody).toMatch(/replace\(\s*\/.+\"\/g,\s*/);
    expect(ticketFnBody).toContain("escapeRevsetString(ticketId)");
  });
});

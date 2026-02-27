import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolveRendererEntry, resolveRendererUrl } from "../../../src/app/shell-bootstrap";

describe("app shell bootstrap", () => {
  it("resolves renderer URL from env when present", () => {
    expect(resolveRendererUrl({ ORIGIN_RENDERER_URL: "http://localhost:5173" })).toBe(
      "http://localhost:5173",
    );
  });

  it("returns null when renderer URL is blank", () => {
    expect(resolveRendererUrl({ ORIGIN_RENDERER_URL: "   " })).toBeNull();
  });

  it("resolves renderer index path from cwd", () => {
    expect(resolveRendererEntry("/tmp/origin-shell")).toBe("/tmp/origin-shell/dist/renderer/index.html");
  });

  it("keeps index.html root mount contract", () => {
    const html = readFileSync("index.html", "utf8");
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('src="/src/app/main.tsx"');
  });
});

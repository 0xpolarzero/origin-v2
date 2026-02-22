import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

export const AUTOMATION_DIR = HERE;
export const REPO_ROOT = resolve(HERE, "..", "..");
export const DOCS_DIR = resolve(REPO_ROOT, "docs");
export const REFERENCES_DIR = resolve(REPO_ROOT, "references");

export const MAX_REVIEW_ROUNDS = 4;

export const DEFAULT_INPUT = {
  goal: "Implement the next highest-impact core feature slice from docs/design.spec.md.",
  scopeHint: "Prioritize deterministic core behavior and comprehensive tests.",
  allowUi: false,
};

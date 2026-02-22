import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

export const AUTOMATION_DIR = HERE;
export const REPO_ROOT = resolve(HERE, "..", "..");
export const DB_PATH = resolve(HERE, ".state", "origin-v2-super-ralph.db");

mkdirSync(dirname(DB_PATH), { recursive: true });

export const DEFAULT_CAMPAIGN_PROMPT = "automation/super-ralph/input/campaign-01-core-foundation.md";

export const BASE_REFERENCE_FILES = [
  "docs/design.spec.md",
  "docs/engineering.choices.md",
  "docs/super-ralph.autonomy.md",
  "docs/reference-repos.md",
  "AGENTS.md",
];

export const FOCUSES = [
  { id: "capture-triage", name: "Capture and Inbox Triage" },
  { id: "planning", name: "Plan and Timeline Reliability" },
  { id: "work-management", name: "Tasks, Events, Projects, Notes" },
  { id: "signals-automation", name: "Signals, Jobs, Notifications" },
  { id: "search-settings-activity", name: "Search, Settings, Activity, Audit" },
] as const;

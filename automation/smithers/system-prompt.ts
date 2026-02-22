import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderMdx } from "smithers-orchestrator";
import { DOCS_DIR, REFERENCES_DIR } from "./config";
import SystemPromptMdx from "./prompts/system-prompt.mdx";

function readText(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return `[Could not read ${path}]`;
  }
}

const designSpec = readText(resolve(DOCS_DIR, "design.spec.md"));
const engineeringChoices = readText(resolve(DOCS_DIR, "engineering.choices.md"));
const referenceRepos = readText(resolve(DOCS_DIR, "reference-repos.md"));
const autonomyPlan = readText(resolve(DOCS_DIR, "smithers.autonomy.md"));

const referenceIndex = [
  "effect",
  "cheffect",
  "accountability",
  "jj",
  "pi-mono",
  "smithers",
]
  .map((name) => `- ${name}: ${resolve(REFERENCES_DIR, name)}`)
  .join("\n");

const DesignSpec = () => designSpec;
const EngineeringChoices = () => engineeringChoices;
const ReferenceRepos = () => referenceRepos;
const AutonomyPlan = () => autonomyPlan;
const ReferenceIndex = () => referenceIndex;

export const SYSTEM_PROMPT = renderMdx(SystemPromptMdx, {
  components: {
    DesignSpec,
    EngineeringChoices,
    ReferenceRepos,
    AutonomyPlan,
    ReferenceIndex,
  },
});

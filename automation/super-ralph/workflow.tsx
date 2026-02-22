import { relative, resolve } from "node:path";
import { createSmithers } from "smithers-orchestrator";
import { SuperRalph } from "super-ralph";
import { createWorkflowAgents } from "./agents";
import {
  BASE_REFERENCE_FILES,
  DB_PATH,
  DEFAULT_CAMPAIGN_PROMPT,
  FOCUSES,
  REPO_ROOT,
} from "./config";
import { strictRalphOutputSchemas } from "./schemas";

type WorkflowInput = {
  campaignPromptPath?: string;
  allowUi?: boolean;
  maxConcurrency?: number;
};

const { Workflow, smithers, outputs } = createSmithers(strictRalphOutputSchemas, {
  dbPath: DB_PATH,
  journalMode: "WAL",
});

function toRepoRelative(pathLike: string): string {
  const absolute = pathLike.startsWith("/")
    ? pathLike
    : resolve(REPO_ROOT, pathLike);
  const rel = relative(REPO_ROOT, absolute).replaceAll("\\", "/");
  return rel.startsWith("..") ? pathLike : rel;
}

export default smithers((ctx) => {
  const input = (ctx.input ?? {}) as WorkflowInput;
  const campaignPromptPath = toRepoRelative(
    input.campaignPromptPath ?? DEFAULT_CAMPAIGN_PROMPT,
  );
  const allowUi = Boolean(input.allowUi ?? false);
  const maxConcurrency = Number(
    input.maxConcurrency ?? process.env.SUPER_RALPH_MAX_CONCURRENCY ?? 8,
  );

  const systemPrompt = [
    "You are an autonomous implementation agent for Origin.",
    "Follow docs/design.spec.md, docs/engineering.choices.md, docs/super-ralph.autonomy.md, and AGENTS.md.",
    `Campaign prompt: ${campaignPromptPath}`,
    `UI allowed: ${allowUi ? "true" : "false"}`,
    "Core-first policy is mandatory: implement and test core logic before UI integration.",
    "Commit every atomic piece of work with conventional commit format.",
    "Use JJ checkpoints while iterating, and keep changes deterministic and resumable.",
    allowUi
      ? "UI work is allowed only where backed by fully tested core modules."
      : "Do not create or modify UI code in this run.",
  ].join("\n");

  const sharedReferenceFiles = [...BASE_REFERENCE_FILES, campaignPromptPath];
  const focusDirs = allowUi
    ? {
        "capture-triage": ["apps/core", "packages", "docs"],
        planning: ["apps/core", "packages", "docs"],
        "work-management": ["apps/core", "apps/desktop", "packages", "docs"],
        "signals-automation": ["apps/core", "packages", "docs"],
        "search-settings-activity": ["apps/core", "apps/desktop", "packages", "docs"],
      }
    : {
        "capture-triage": ["apps/core", "packages", "docs"],
        planning: ["apps/core", "packages", "docs"],
        "work-management": ["apps/core", "packages", "docs"],
        "signals-automation": ["apps/core", "packages", "docs"],
        "search-settings-activity": ["apps/core", "packages", "docs"],
      };

  return (
    <Workflow name="origin-v2-super-ralph">
      <SuperRalph
        ctx={ctx as any}
        outputs={outputs as any}
        focuses={FOCUSES}
        projectId="origin"
        projectName="Origin"
        specsPath="docs"
        referenceFiles={sharedReferenceFiles}
        buildCmds={{
          typecheck: "bun run typecheck:project",
        }}
        testCmds={{
          tests: "bun run test:project",
        }}
        preLandChecks={["bun run validate:project"]}
        postLandChecks={["bun run validate:project"]}
        codeStyle="TypeScript + Effect-first core design, explicit error handling, deterministic tests."
        reviewChecklist={[
          "Spec compliance against docs/design.spec.md",
          "Core-first gating respected",
          "Tests added/updated for behavior changes",
          "No outbound actions without explicit approval controls",
          "Conventional commit format and atomic chunks",
        ]}
        maxConcurrency={maxConcurrency}
        taskRetries={3}
        focusDirs={focusDirs}
        commitConfig={{
          prefix: "",
          mainBranch: "main",
          emojiPrefixes: "feat, fix, refactor, docs, test, chore",
        }}
        agents={createWorkflowAgents(systemPrompt)}
      />
    </Workflow>
  );
});

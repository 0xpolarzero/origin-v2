import { spawnSync } from "node:child_process";
import { CodexAgent, PiAgent } from "smithers-orchestrator";
import { REPO_ROOT } from "./config";
import { SYSTEM_PROMPT } from "./system-prompt";

function hasCommand(command: string): boolean {
  const result = spawnSync("bash", ["-lc", `command -v ${command}`], {
    stdio: "ignore",
  });
  return result.status === 0;
}

const usePi = process.env.SMITHERS_USE_PI === "1" && hasCommand("pi");
const codexModel = process.env.SMITHERS_CODEX_MODEL ?? "gpt-5.3-codex";
const codexReasoningEffort = process.env.SMITHERS_CODEX_REASONING_EFFORT ?? "medium";
const piProvider = process.env.SMITHERS_PI_PROVIDER ?? "openai";
const piModel = process.env.SMITHERS_PI_MODEL ?? "gpt-5.2-codex";

function timeoutFromEnv(key: string, fallbackMs: number): number {
  const raw = process.env[key];
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
}

function buildCodexAgent(id: string, timeoutMs: number): CodexAgent {
  return new CodexAgent({
    id,
    cwd: REPO_ROOT,
    model: codexModel,
    config: {
      model_reasoning_effort: codexReasoningEffort,
    },
    sandbox: "workspace-write",
    fullAuto: true,
    skipGitRepoCheck: true,
    systemPrompt: SYSTEM_PROMPT,
    timeoutMs,
  });
}

function buildPiAgent(id: string, timeoutMs: number): PiAgent {
  return new PiAgent({
    id,
    cwd: REPO_ROOT,
    provider: piProvider,
    model: piModel,
    systemPrompt: SYSTEM_PROMPT,
    timeoutMs,
  });
}

function selectAgents(id: string, timeoutMs: number): Array<CodexAgent | PiAgent> {
  const codex = buildCodexAgent(`${id}-codex`, timeoutMs);
  const pi = hasCommand("pi") ? buildPiAgent(`${id}-pi`, timeoutMs) : null;

  if (usePi && pi) {
    return [pi, codex];
  }

  return pi ? [codex, pi] : [codex];
}

export const discoverAgents = selectAgents(
  "discover-agent",
  timeoutFromEnv("SMITHERS_DISCOVER_TIMEOUT_MS", 10 * 60 * 1000),
);

export const implementAgents = selectAgents(
  "implement-agent",
  timeoutFromEnv("SMITHERS_IMPLEMENT_TIMEOUT_MS", 30 * 60 * 1000),
);

export const validateAgents = selectAgents(
  "validate-agent",
  timeoutFromEnv("SMITHERS_VALIDATE_TIMEOUT_MS", 10 * 60 * 1000),
);

export const reviewAgents = selectAgents(
  "review-agent",
  timeoutFromEnv("SMITHERS_REVIEW_TIMEOUT_MS", 10 * 60 * 1000),
);

export const reportAgents = selectAgents(
  "report-agent",
  timeoutFromEnv("SMITHERS_REPORT_TIMEOUT_MS", 10 * 60 * 1000),
);

export const usingPiAgent = usePi;

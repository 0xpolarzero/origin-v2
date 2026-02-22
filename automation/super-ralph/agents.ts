import { spawnSync } from "node:child_process";
import { ClaudeCodeAgent, CodexAgent } from "smithers-orchestrator";
import { REPO_ROOT } from "./config";

type AgentChoice = ReturnType<typeof createCodexAgent> | ReturnType<typeof createClaudeAgent>;

const codexModel = process.env.SUPER_RALPH_CODEX_MODEL ?? "gpt-5.3-codex";
const codexReasoningEffort = process.env.SUPER_RALPH_CODEX_REASONING_EFFORT ?? "medium";
const claudeModel = process.env.SUPER_RALPH_CLAUDE_MODEL ?? "claude-sonnet-4-6";
const enableClaudeFallback = process.env.SUPER_RALPH_ENABLE_CLAUDE_FALLBACK === "1";

function hasCommand(command: string): boolean {
  const result = spawnSync("bash", ["-lc", `command -v ${command}`], { stdio: "ignore" });
  return result.status === 0;
}

function timeoutFromEnv(key: string, fallbackMs: number): number {
  const raw = process.env[key];
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
}

function createCodexAgent(id: string, systemPrompt: string, timeoutMs: number): CodexAgent {
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
    systemPrompt,
    timeoutMs,
  });
}

function createClaudeAgent(id: string, systemPrompt: string, timeoutMs: number): ClaudeCodeAgent {
  return new ClaudeCodeAgent({
    id,
    cwd: REPO_ROOT,
    model: claudeModel,
    systemPrompt,
    timeoutMs,
  });
}

function select(primary: "codex" | "claude", id: string, systemPrompt: string, timeoutMs: number): AgentChoice | [AgentChoice, AgentChoice] {
  const codex = hasCommand("codex") ? createCodexAgent(`${id}-codex`, systemPrompt, timeoutMs) : null;
  const claude = enableClaudeFallback && hasCommand("claude")
    ? createClaudeAgent(`${id}-claude`, systemPrompt, timeoutMs)
    : null;

  if (primary === "claude") {
    if (claude && codex) return [claude, codex];
    if (claude) return claude;
    if (codex) return codex;
  } else {
    if (codex && claude) return [codex, claude];
    if (codex) return codex;
    if (claude) return claude;
  }

  throw new Error("No supported agent CLI found. Install codex.");
}

export function createWorkflowAgents(systemPrompt: string) {
  const timeoutMs = timeoutFromEnv("SUPER_RALPH_AGENT_TIMEOUT_MS", 60 * 60 * 1000);
  return {
    planning: select("codex", "planning", systemPrompt, timeoutMs),
    implementation: select("codex", "implementation", systemPrompt, timeoutMs),
    testing: select("codex", "testing", systemPrompt, timeoutMs),
    reviewing: select("codex", "reviewing", systemPrompt, timeoutMs),
    reporting: select("codex", "reporting", systemPrompt, timeoutMs),
  } as const;
}

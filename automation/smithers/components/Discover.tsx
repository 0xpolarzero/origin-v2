import { discoverAgents } from "../agents";
import { readWorkflowInput } from "../input";
import DiscoverPrompt from "../prompts/discover.mdx";
import { Task, outputs, useCtx } from "../smithers";

export function Discover() {
  const ctx = useCtx();
  const input = readWorkflowInput(ctx.input as Record<string, unknown>);

  return (
    <Task id="discover" output={outputs.discover} agent={discoverAgents} retries={1}>
      <DiscoverPrompt goal={input.goal} scopeHint={input.scopeHint ?? ""} allowUi={input.allowUi} />
    </Task>
  );
}

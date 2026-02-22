import { discoverAgents } from "../agents";
import { readWorkflowInput } from "../input";
import PlanPrompt from "../prompts/plan.mdx";
import { Task, outputs, tables, useCtx } from "../smithers";

export function Plan() {
  const ctx = useCtx();
  const input = readWorkflowInput(ctx.input as Record<string, unknown>);
  const discovery = ctx.latest(tables.discover, "discover");

  return (
    <Task id="plan" output={outputs.plan} agent={discoverAgents} retries={1}>
      <PlanPrompt
        goal={input.goal}
        allowUi={input.allowUi}
        discovery={JSON.stringify(discovery ?? {}, null, 2)}
      />
    </Task>
  );
}

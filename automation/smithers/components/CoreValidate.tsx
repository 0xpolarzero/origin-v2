import { validateAgents } from "../agents";
import CoreValidatePrompt from "../prompts/core-validate.mdx";
import { Task, outputs, tables, useCtx } from "../smithers";

export function CoreValidate() {
  const ctx = useCtx();
  const implementation = ctx.latest(tables.coreImplement, "core-implement");
  const plan = ctx.latest(tables.plan, "plan");

  return (
    <Task id="core-validate" output={outputs.coreValidate} agent={validateAgents} retries={1}>
      <CoreValidatePrompt
        implementation={JSON.stringify(implementation ?? {}, null, 2)}
        testMatrix={JSON.stringify(plan?.testMatrix ?? [], null, 2)}
      />
    </Task>
  );
}

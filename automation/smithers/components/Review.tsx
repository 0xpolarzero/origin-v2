import { reviewAgents } from "../agents";
import ReviewPrompt from "../prompts/review.mdx";
import { Task, outputs, tables, useCtx } from "../smithers";

export function Review() {
  const ctx = useCtx();
  const plan = ctx.latest(tables.plan, "plan");
  const implementation = ctx.latest(tables.coreImplement, "core-implement");
  const validation = ctx.latest(tables.coreValidate, "core-validate");

  return (
    <Task id="review" output={outputs.review} agent={reviewAgents} retries={1}>
      <ReviewPrompt
        plan={JSON.stringify(plan ?? {}, null, 2)}
        implementation={JSON.stringify(implementation ?? {}, null, 2)}
        validation={JSON.stringify(validation ?? {}, null, 2)}
      />
    </Task>
  );
}

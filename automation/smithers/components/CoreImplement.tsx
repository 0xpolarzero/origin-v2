import { implementAgents } from "../agents";
import CoreImplementPrompt from "../prompts/core-implement.mdx";
import { Task, outputs, tables, useCtx } from "../smithers";

export function CoreImplement() {
  const ctx = useCtx();
  const plan = ctx.latest(tables.plan, "plan");
  const previousReview = ctx.latest(tables.review, "review");
  const previousFix = ctx.latest(tables.reviewFix, "review-fix");

  return (
    <Task id="core-implement" output={outputs.coreImplement} agent={implementAgents} retries={1}>
      <CoreImplementPrompt
        plan={JSON.stringify(plan ?? {}, null, 2)}
        workChunkPlan={JSON.stringify(plan?.workChunkPlan ?? [], null, 2)}
        requiredValidationCommands={JSON.stringify(plan?.requiredValidationCommands ?? [], null, 2)}
        reviewFeedback={previousReview?.feedback ?? "none"}
        fixPlan={JSON.stringify(previousFix?.fixPlan ?? [], null, 2)}
      />
    </Task>
  );
}

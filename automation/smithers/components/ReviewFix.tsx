import { reviewAgents } from "../agents";
import ReviewFixPrompt from "../prompts/review-fix.mdx";
import { Task, outputs, tables, useCtx } from "../smithers";

export function ReviewFix() {
  const ctx = useCtx();
  const review = ctx.latest(tables.review, "review");

  return (
    <Task id="review-fix" output={outputs.reviewFix} agent={reviewAgents} retries={1}>
      <ReviewFixPrompt review={JSON.stringify(review ?? {}, null, 2)} />
    </Task>
  );
}

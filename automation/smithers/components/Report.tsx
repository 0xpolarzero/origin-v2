import { reportAgents } from "../agents";
import { readWorkflowInput } from "../input";
import ReportPrompt from "../prompts/report.mdx";
import { Task, outputs, tables, useCtx } from "../smithers";

export function Report() {
  const ctx = useCtx();
  const input = readWorkflowInput(ctx.input as Record<string, unknown>);
  const plan = ctx.latest(tables.plan, "plan");
  const implementation = ctx.latest(tables.coreImplement, "core-implement");
  const validation = ctx.latest(tables.coreValidate, "core-validate");
  const review = ctx.latest(tables.review, "review");
  const reviewFix = ctx.latest(tables.reviewFix, "review-fix");

  return (
    <Task id="report" output={outputs.report} agent={reportAgents} retries={1}>
      <ReportPrompt
        goal={input.goal}
        allowUi={input.allowUi}
        plan={JSON.stringify(plan ?? {}, null, 2)}
        implementation={JSON.stringify(implementation ?? {}, null, 2)}
        validation={JSON.stringify(validation ?? {}, null, 2)}
        review={JSON.stringify(review ?? {}, null, 2)}
        reviewFix={JSON.stringify(reviewFix ?? {}, null, 2)}
      />
    </Task>
  );
}

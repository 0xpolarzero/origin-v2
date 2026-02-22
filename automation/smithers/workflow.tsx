import { Ralph, Sequence } from "smithers-orchestrator";
import { MAX_REVIEW_ROUNDS } from "./config";
import {
  CoreImplement,
  CoreValidate,
  Discover,
  Plan,
  Report,
  Review,
  ReviewFix,
} from "./components";
import { Workflow, smithers, tables } from "./smithers";

export default smithers((ctx) => {
  const latestReview = ctx.latest(tables.review, "review");
  const approved = latestReview?.approved === true;

  return (
    <Workflow name="origin-v2-core-autonomy" cache>
      <Sequence>
        <Discover />
        <Plan />
        <Ralph
          id="core-delivery-loop"
          until={approved}
          maxIterations={MAX_REVIEW_ROUNDS}
          onMaxReached="return-last"
        >
          <Sequence>
            <CoreImplement />
            <CoreValidate />
            <Review />
            <ReviewFix />
          </Sequence>
        </Ralph>
        <Report />
      </Sequence>
    </Workflow>
  );
});

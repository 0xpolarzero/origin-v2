import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createJob } from "../../../../src/core/domain/job";

describe("createJob", () => {
  test("seeds runState=idle and retry metadata", async () => {
    const job = await Effect.runPromise(
      createJob({
        id: "job-1",
        name: "Daily planning pass",
      }),
    );

    expect(job.id).toBe("job-1");
    expect(job.runState).toBe("idle");
    expect(job.retryCount).toBe(0);
    expect(job.lastFailureReason).toBeUndefined();
  });
});

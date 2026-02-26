import { describe, expect, test } from "bun:test";

import {
  toWorkflowApiError,
  WorkflowApiError,
} from "../../../../src/api/workflows/errors";

describe("api/workflows/errors", () => {
  test("toWorkflowApiError preserves route and safe message text", () => {
    const mapped = toWorkflowApiError(
      "capture.entry",
      new Error("entry capture failed"),
    );

    expect(mapped).toBeInstanceOf(WorkflowApiError);
    expect(mapped._tag).toBe("WorkflowApiError");
    expect(mapped.route).toBe("capture.entry");
    expect(mapped.message).toBe("entry capture failed");
  });

  test("toWorkflowApiError maps non-Error throwables to deterministic fallback message", () => {
    const mapped = toWorkflowApiError("job.retry", {
      reason: "unknown",
    });

    expect(mapped.route).toBe("job.retry");
    expect(mapped.message).toBe("unknown workflow api failure");
  });

  test("toWorkflowApiError preserves pre-mapped WorkflowApiError instances", () => {
    const existing = new WorkflowApiError({
      route: "signal.convert",
      message: "already mapped",
    });

    const mapped = toWorkflowApiError("job.retry", existing);

    expect(mapped).toBe(existing);
  });
});

import { describe, expect, test } from "bun:test";

import { ApprovalServiceError } from "../../../../src/core/services/approval-service";
import { EventServiceError } from "../../../../src/core/services/event-service";
import {
  toWorkflowApiError,
  WorkflowApiError,
} from "../../../../src/api/workflows/errors";

describe("api/workflows/errors", () => {
  test("toWorkflowApiError maps forbidden and conflict service errors to status metadata", () => {
    const forbidden = toWorkflowApiError(
      "approval.approveOutboundAction",
      new ApprovalServiceError({
        message: "only user actors may approve outbound actions",
        code: "forbidden",
      }),
    );
    const conflict = toWorkflowApiError(
      "approval.requestEventSync",
      new EventServiceError({
        message: "event event-1 must be local_only before requesting sync",
        code: "conflict",
      }),
    );

    expect(forbidden).toMatchObject({
      route: "approval.approveOutboundAction",
      message: "only user actors may approve outbound actions",
      code: "forbidden",
      statusCode: 403,
    });
    expect(conflict).toMatchObject({
      route: "approval.requestEventSync",
      message: "event event-1 must be local_only before requesting sync",
      code: "conflict",
      statusCode: 409,
    });
  });

  test("toWorkflowApiError preserves route and safe message text", () => {
    const mapped = toWorkflowApiError(
      "capture.entry",
      new Error("entry capture failed"),
    );

    expect(mapped).toBeInstanceOf(WorkflowApiError);
    expect(mapped._tag).toBe("WorkflowApiError");
    expect(mapped.route).toBe("capture.entry");
    expect(mapped.message).toBe("entry capture failed");
    expect(mapped.code).toBe("unknown");
    expect(mapped.statusCode).toBe(400);
  });

  test("toWorkflowApiError maps non-Error throwables to deterministic fallback message", () => {
    const mapped = toWorkflowApiError("job.retry", {
      reason: "unknown",
    });

    expect(mapped.route).toBe("job.retry");
    expect(mapped.message).toBe("unknown workflow api failure");
    expect(mapped.code).toBe("unknown");
    expect(mapped.statusCode).toBe(400);
  });

  test("toWorkflowApiError preserves pre-mapped WorkflowApiError instances", () => {
    const existing = new WorkflowApiError({
      route: "signal.convert",
      message: "already mapped",
      code: "validation",
      statusCode: 400,
    });

    const mapped = toWorkflowApiError("job.retry", existing);

    expect(mapped).toBe(existing);
  });
});

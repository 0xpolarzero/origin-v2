import { describe, expect, test } from "bun:test";

import { ApprovalServiceError } from "../../../../src/core/services/approval-service";
import { CheckpointServiceError } from "../../../../src/core/services/checkpoint-service";
import { EntryServiceError } from "../../../../src/core/services/entry-service";
import { EventServiceError } from "../../../../src/core/services/event-service";
import { JobServiceError } from "../../../../src/core/services/job-service";
import { SignalServiceError } from "../../../../src/core/services/signal-service";
import { TaskTransitionError } from "../../../../src/core/services/task-service";
import {
  toWorkflowApiError,
  WorkflowApiError,
} from "../../../../src/api/workflows/errors";

describe("api/workflows/errors", () => {
  test("toWorkflowApiError maps service error codes to stable API status metadata", () => {
    const validation = toWorkflowApiError(
      "approval.approveOutboundAction",
      new ApprovalServiceError({
        message: "outbound actions require explicit approval",
        code: "invalid_request",
      }),
    );
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
    const notFound = toWorkflowApiError(
      "approval.requestEventSync",
      new EventServiceError({
        message: "event event-404 was not found",
        code: "not_found",
      }),
    );

    expect(validation).toMatchObject({
      route: "approval.approveOutboundAction",
      message: "outbound actions require explicit approval",
      code: "validation",
      statusCode: 400,
    });
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
    expect(notFound).toMatchObject({
      route: "approval.requestEventSync",
      message: "event event-404 was not found",
      code: "not_found",
      statusCode: 404,
    });
  });

  test("toWorkflowApiError maps JobServiceError not_found + invalid_request codes", () => {
    const notFound = toWorkflowApiError(
      "job.retry",
      new JobServiceError({
        message: "job job-404 was not found",
        code: "not_found",
      }),
    );
    const invalidRequest = toWorkflowApiError(
      "job.listHistory",
      new JobServiceError({
        message: "limit must be a positive integer",
        code: "invalid_request",
      }),
    );

    expect(notFound).toMatchObject({
      route: "job.retry",
      message: "job job-404 was not found",
      code: "not_found",
      statusCode: 404,
    });
    expect(invalidRequest).toMatchObject({
      route: "job.listHistory",
      message: "limit must be a positive integer",
      code: "validation",
      statusCode: 400,
    });
  });

  test("toWorkflowApiError maps CheckpointServiceError not_found/conflict/invalid_request codes", () => {
    const notFound = toWorkflowApiError(
      "checkpoint.keep",
      new CheckpointServiceError({
        message: "checkpoint checkpoint-404 was not found",
        code: "not_found",
      }),
    );
    const conflict = toWorkflowApiError(
      "checkpoint.keep",
      new CheckpointServiceError({
        message: "checkpoint checkpoint-1 cannot transition recovered -> kept",
        code: "conflict",
      }),
    );
    const invalidRequest = toWorkflowApiError(
      "checkpoint.create",
      new CheckpointServiceError({
        message: "failed to create checkpoint: name is required",
        code: "invalid_request",
      }),
    );

    expect(notFound).toMatchObject({
      route: "checkpoint.keep",
      message: "checkpoint checkpoint-404 was not found",
      code: "not_found",
      statusCode: 404,
    });
    expect(conflict).toMatchObject({
      route: "checkpoint.keep",
      message: "checkpoint checkpoint-1 cannot transition recovered -> kept",
      code: "conflict",
      statusCode: 409,
    });
    expect(invalidRequest).toMatchObject({
      route: "checkpoint.create",
      message: "failed to create checkpoint: name is required",
      code: "validation",
      statusCode: 400,
    });
  });

  test("toWorkflowApiError maps EntryServiceError not_found code", () => {
    const notFound = toWorkflowApiError(
      "capture.acceptAsTask",
      new EntryServiceError({
        message: "entry entry-404 was not found",
        code: "not_found",
      }),
    );

    expect(notFound).toMatchObject({
      route: "capture.acceptAsTask",
      message: "entry entry-404 was not found",
      code: "not_found",
      statusCode: 404,
    });
  });

  test("toWorkflowApiError maps TaskTransitionError not_found code", () => {
    const notFound = toWorkflowApiError(
      "planning.completeTask",
      new TaskTransitionError({
        message: "task task-404 was not found",
        code: "not_found",
      }),
    );

    expect(notFound).toMatchObject({
      route: "planning.completeTask",
      message: "task task-404 was not found",
      code: "not_found",
      statusCode: 404,
    });
  });

  test("toWorkflowApiError maps SignalServiceError not_found and conflict codes", () => {
    const notFound = toWorkflowApiError(
      "signal.triage",
      new SignalServiceError({
        message: "signal signal-404 was not found",
        code: "not_found",
      }),
    );
    const conflict = toWorkflowApiError(
      "signal.convert",
      new SignalServiceError({
        message: "signal signal-1 must be triaged before conversion",
        code: "conflict",
      }),
    );

    expect(notFound).toMatchObject({
      route: "signal.triage",
      message: "signal signal-404 was not found",
      code: "not_found",
      statusCode: 404,
    });
    expect(conflict).toMatchObject({
      route: "signal.convert",
      message: "signal signal-1 must be triaged before conversion",
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

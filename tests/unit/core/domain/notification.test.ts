import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createNotification } from "../../../../src/core/domain/notification";

describe("createNotification", () => {
  test("seeds status=pending", async () => {
    const notification = await Effect.runPromise(
      createNotification({
        id: "notification-1",
        type: "approval_required",
        message: "Approve calendar sync",
      }),
    );

    expect(notification.id).toBe("notification-1");
    expect(notification.status).toBe("pending");
  });
});

import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createTask } from "../../../../src/core/domain/task";

describe("createTask", () => {
  test("sets status=planned and schedule fields", async () => {
    const task = await Effect.runPromise(
      createTask({
        id: "task-1",
        title: "Review roadmap",
        scheduledFor: new Date("2026-02-24T10:00:00.000Z"),
        dueAt: new Date("2026-02-25T12:00:00.000Z"),
      }),
    );

    expect(task.id).toBe("task-1");
    expect(task.status).toBe("planned");
    expect(task.scheduledFor).toBe("2026-02-24T10:00:00.000Z");
    expect(task.dueAt).toBe("2026-02-25T12:00:00.000Z");
  });
});

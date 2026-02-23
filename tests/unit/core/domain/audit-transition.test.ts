import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createAuditTransition } from "../../../../src/core/domain/audit-transition";

describe("createAuditTransition", () => {
  test("records from/to state, actor, and reason", async () => {
    const at = new Date("2026-02-23T00:00:00.000Z");

    const transition = await Effect.runPromise(
      createAuditTransition({
        entityType: "task",
        entityId: "task-1",
        fromState: "planned",
        toState: "completed",
        actor: {
          id: "user-1",
          kind: "user",
        },
        reason: "Completed in planning session",
        at,
      }),
    );

    expect(transition.entityType).toBe("task");
    expect(transition.entityId).toBe("task-1");
    expect(transition.fromState).toBe("planned");
    expect(transition.toState).toBe("completed");
    expect(transition.reason).toBe("Completed in planning session");
    expect(transition.actor).toEqual({ id: "user-1", kind: "user" });
    expect(transition.at).toBe("2026-02-23T00:00:00.000Z");
  });
});

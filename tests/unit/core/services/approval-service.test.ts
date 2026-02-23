import { describe, expect, mock, test } from "bun:test";
import { Effect } from "effect";

import { createEvent } from "../../../../src/core/domain/event";
import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";
import { requestEventSync } from "../../../../src/core/services/event-service";
import {
  approveOutboundAction,
  OutboundActionPort,
} from "../../../../src/core/services/approval-service";

describe("approval-service", () => {
  test("approveOutboundAction enforces explicit approval before execute", async () => {
    const repository = makeInMemoryCoreRepository();
    const event = await Effect.runPromise(
      createEvent({
        id: "event-2",
        title: "Sync candidate",
        startAt: new Date("2026-02-25T12:00:00.000Z"),
      }),
    );
    await Effect.runPromise(repository.saveEntity("event", event.id, event));

    await Effect.runPromise(
      requestEventSync(
        repository,
        event.id,
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T13:30:00.000Z"),
      ),
    );

    const execute = mock(async () => ({ executionId: "exec-1" }));

    const outboundPort: OutboundActionPort = {
      execute: (action) => Effect.promise(() => execute(action)),
    };

    await expect(
      Effect.runPromise(
        approveOutboundAction(repository, outboundPort, {
          actionType: "event_sync",
          entityType: "event",
          entityId: "event-2",
          approved: false,
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T13:35:00.000Z"),
        }),
      ),
    ).rejects.toThrow();

    expect(execute).toHaveBeenCalledTimes(0);

    const approved = await Effect.runPromise(
      approveOutboundAction(repository, outboundPort, {
        actionType: "event_sync",
        entityType: "event",
        entityId: "event-2",
        approved: true,
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T13:40:00.000Z"),
      }),
    );

    const persistedEvent = await Effect.runPromise(
      repository.getEntity<{ syncState: string }>("event", "event-2"),
    );

    expect(approved.executed).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(persistedEvent?.syncState).toBe("synced");
  });
});

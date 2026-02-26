import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import {
  acceptEntryAsTask,
  captureEntry,
  editEntrySuggestion,
  rejectEntrySuggestion,
  suggestEntryAsTask,
} from "../../../../src/core/services/entry-service";
import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";

describe("entry-service", () => {
  test("captureEntry persists Entry and writes audit transition", async () => {
    const repository = makeInMemoryCoreRepository();

    const entry = await Effect.runPromise(
      captureEntry(repository, {
        entryId: "entry-1",
        content: "Plan Q2 launch",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T09:00:00.000Z"),
      }),
    );

    const persistedEntry = await Effect.runPromise(
      repository.getEntity("entry", "entry-1"),
    );
    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({ entityType: "entry", entityId: "entry-1" }),
    );

    expect(entry.id).toBe("entry-1");
    expect(persistedEntry).toEqual(entry);
    expect(auditTrail).toHaveLength(1);
    expect(auditTrail[0]?.fromState).toBe("none");
    expect(auditTrail[0]?.toState).toBe("captured");
    expect(auditTrail[0]?.actor.id).toBe("user-1");
  });

  test("acceptEntryAsTask converts Entry -> Task and writes linked transitions", async () => {
    const repository = makeInMemoryCoreRepository();

    await Effect.runPromise(
      captureEntry(repository, {
        entryId: "entry-2",
        content: "Schedule team offsite",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T09:30:00.000Z"),
      }),
    );

    const task = await Effect.runPromise(
      acceptEntryAsTask(repository, {
        entryId: "entry-2",
        taskId: "task-2",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T09:35:00.000Z"),
      }),
    );

    const persistedEntry = await Effect.runPromise(
      repository.getEntity<{
        status: string;
        acceptedTaskId?: string;
      }>("entry", "entry-2"),
    );
    const persistedTask = await Effect.runPromise(
      repository.getEntity("task", "task-2"),
    );
    const entryAuditTrail = await Effect.runPromise(
      repository.listAuditTrail({ entityType: "entry", entityId: "entry-2" }),
    );
    const taskAuditTrail = await Effect.runPromise(
      repository.listAuditTrail({ entityType: "task", entityId: "task-2" }),
    );

    expect(task.id).toBe("task-2");
    expect(task.sourceEntryId).toBe("entry-2");
    expect(persistedTask).toEqual(task);
    expect(persistedEntry?.status).toBe("accepted_as_task");
    expect(persistedEntry?.acceptedTaskId).toBe("task-2");
    expect(entryAuditTrail).toHaveLength(2);
    expect(entryAuditTrail[1]?.toState).toBe("accepted_as_task");
    expect(taskAuditTrail).toHaveLength(1);
    expect(taskAuditTrail[0]?.metadata?.sourceEntryId).toBe("entry-2");
  });

  test("supports AI suggestion creation, edit, and rejection for captured entries", async () => {
    const repository = makeInMemoryCoreRepository();

    await Effect.runPromise(
      captureEntry(repository, {
        entryId: "entry-3",
        content: "Need travel booking",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T10:00:00.000Z"),
      }),
    );

    const suggested = await Effect.runPromise(
      suggestEntryAsTask(repository, {
        entryId: "entry-3",
        suggestedTitle: "Book travel itinerary",
        actor: { id: "ai-1", kind: "ai" },
        at: new Date("2026-02-23T10:01:00.000Z"),
      }),
    );
    const edited = await Effect.runPromise(
      editEntrySuggestion(repository, {
        entryId: "entry-3",
        suggestedTitle: "Book conference travel itinerary",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T10:02:00.000Z"),
      }),
    );
    const rejected = await Effect.runPromise(
      rejectEntrySuggestion(repository, {
        entryId: "entry-3",
        reason: "Not needed anymore",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T10:03:00.000Z"),
      }),
    );

    const persistedEntry = await Effect.runPromise(
      repository.getEntity<{
        status: string;
        suggestedTaskTitle?: string;
        rejectionReason?: string;
      }>("entry", "entry-3"),
    );
    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({ entityType: "entry", entityId: "entry-3" }),
    );

    expect(suggested.status).toBe("suggested");
    expect(edited.suggestedTaskTitle).toBe("Book conference travel itinerary");
    expect(rejected.status).toBe("rejected");
    expect(persistedEntry?.rejectionReason).toBe("Not needed anymore");
    expect(auditTrail[auditTrail.length - 1]?.toState).toBe("rejected");
  });

  test("acceptEntryAsTask uses edited suggestion title when explicit title is omitted", async () => {
    const repository = makeInMemoryCoreRepository();

    await Effect.runPromise(
      captureEntry(repository, {
        entryId: "entry-4",
        content: "Plan customer interview",
        actor: { id: "user-1", kind: "user" },
      }),
    );
    await Effect.runPromise(
      suggestEntryAsTask(repository, {
        entryId: "entry-4",
        suggestedTitle: "Plan interview with top customer",
        actor: { id: "ai-1", kind: "ai" },
      }),
    );
    await Effect.runPromise(
      editEntrySuggestion(repository, {
        entryId: "entry-4",
        suggestedTitle: "Plan interview with enterprise customer",
        actor: { id: "user-1", kind: "user" },
      }),
    );

    const task = await Effect.runPromise(
      acceptEntryAsTask(repository, {
        entryId: "entry-4",
        taskId: "task-4",
        actor: { id: "user-1", kind: "user" },
      }),
    );

    expect(task.title).toBe("Plan interview with enterprise customer");
  });
});

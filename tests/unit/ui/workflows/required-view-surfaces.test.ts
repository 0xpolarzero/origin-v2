import { describe, expect, test } from "bun:test";
import { Either, Effect } from "effect";

import {
  loadEventsSurface,
} from "../../../../src/ui/workflows/events-surface";
import {
  loadInboxSurface,
} from "../../../../src/ui/workflows/inbox-surface";
import {
  loadNotesSurface,
} from "../../../../src/ui/workflows/notes-surface";
import {
  loadNotificationsSurface,
} from "../../../../src/ui/workflows/notifications-surface";
import {
  loadPlanSurface,
} from "../../../../src/ui/workflows/plan-surface";
import {
  loadProjectsSurface,
} from "../../../../src/ui/workflows/projects-surface";
import {
  loadSearchSurface,
} from "../../../../src/ui/workflows/search-surface";
import {
  loadSettingsSurface,
  saveSettingsSurface,
} from "../../../../src/ui/workflows/settings-surface";
import {
  loadSignalsSurface,
} from "../../../../src/ui/workflows/signals-surface";
import { loadTasksSurface } from "../../../../src/ui/workflows/tasks-surface";
import { WorkflowSurfaceCorePort } from "../../../../src/ui/workflows/workflow-surface-core-port";

const makePortStub = (
  seed: Record<string, Array<Record<string, unknown>>> = {},
): WorkflowSurfaceCorePort => {
  const store = new Map<string, Array<Record<string, unknown>>>(
    Object.entries(seed).map(([entityType, entities]) => [
      entityType,
      entities.map((entity) => ({ ...entity })),
    ]),
  );

  return {
    listEntities: (entityType) =>
      Effect.sync(
        () =>
          (store.get(entityType) ?? []).map((entity) => ({ ...entity })) as Array<
            never
          >,
      ),
    getEntity: (entityType, entityId) =>
      Effect.sync(() => {
        const entity = (store.get(entityType) ?? []).find(
          (item) => item.id === entityId,
        );
        return entity ? ({ ...entity } as never) : undefined;
      }),
    upsertMemory: (input) =>
      Effect.sync(() => {
        const memoryList = store.get("memory") ?? [];
        const existing = memoryList.find((memory) => memory.key === input.key);
        const now = (input.at ?? new Date()).toISOString();

        const memory = existing
          ? {
              ...existing,
              value: input.value,
              source: input.source,
              confidence: input.confidence,
              updatedAt: now,
            }
          : {
              id: input.memoryId ?? `memory-${memoryList.length + 1}`,
              key: input.key,
              value: input.value,
              source: input.source,
              confidence: input.confidence,
              createdAt: now,
              updatedAt: now,
            };

        const next = existing
          ? memoryList.map((item) => (item.key === input.key ? memory : item))
          : [...memoryList, memory];
        store.set("memory", next);
        return memory as never;
      }),
  };
};

describe("required workflow view surfaces", () => {
  test("plan/inbox/tasks/events/projects/notes/signals/notifications/search/settings surfaces load expected data", async () => {
    const port = makePortStub({
      entry: [
        {
          id: "entry-1",
          content: "captured entry",
          source: "manual",
          status: "captured",
          capturedAt: "2026-02-23T10:00:00.000Z",
          createdAt: "2026-02-23T10:00:00.000Z",
          updatedAt: "2026-02-23T10:00:00.000Z",
        },
        {
          id: "entry-2",
          content: "suggested entry",
          source: "manual",
          status: "suggested",
          suggestedTaskTitle: "Follow up",
          capturedAt: "2026-02-23T11:00:00.000Z",
          createdAt: "2026-02-23T11:00:00.000Z",
          updatedAt: "2026-02-23T11:00:00.000Z",
        },
      ],
      task: [
        {
          id: "task-1",
          title: "Write tests",
          status: "planned",
          scheduledFor: "2026-02-24T09:00:00.000Z",
          projectId: "project-1",
          createdAt: "2026-02-23T12:00:00.000Z",
          updatedAt: "2026-02-23T12:00:00.000Z",
        },
      ],
      event: [
        {
          id: "event-1",
          title: "Sync review",
          startAt: "2026-02-24T08:30:00.000Z",
          syncState: "pending_approval",
          createdAt: "2026-02-23T12:00:00.000Z",
          updatedAt: "2026-02-23T12:30:00.000Z",
        },
      ],
      project: [
        {
          id: "project-1",
          name: "Origin",
          lifecycle: "active",
          createdAt: "2026-02-23T12:00:00.000Z",
          updatedAt: "2026-02-23T12:00:00.000Z",
        },
      ],
      note: [
        {
          id: "note-1",
          body: "Linked note about signal",
          linkedEntityRefs: ["signal:signal-1"],
          createdAt: "2026-02-23T12:00:00.000Z",
          updatedAt: "2026-02-23T12:01:00.000Z",
        },
      ],
      signal: [
        {
          id: "signal-1",
          source: "email",
          payload: "Important inbound",
          triageState: "untriaged",
          createdAt: "2026-02-23T12:00:00.000Z",
          updatedAt: "2026-02-23T12:02:00.000Z",
        },
      ],
      notification: [
        {
          id: "notification-1",
          type: "approval_required",
          message: "Approval needed",
          status: "pending",
          relatedEntityType: "event",
          relatedEntityId: "event-1",
          createdAt: "2026-02-23T12:00:00.000Z",
          updatedAt: "2026-02-23T12:03:00.000Z",
        },
      ],
      memory: [
        {
          id: "memory-1",
          key: "settings.ai.provider",
          value: "\"pi-mono\"",
          source: "test",
          confidence: 1,
          createdAt: "2026-02-23T12:00:00.000Z",
          updatedAt: "2026-02-23T12:00:00.000Z",
        },
      ],
    });

    const plan = await Effect.runPromise(
      loadPlanSurface(port, {
        from: new Date("2026-02-24T00:00:00.000Z"),
        to: new Date("2026-02-25T00:00:00.000Z"),
      }),
    );
    const inbox = await Effect.runPromise(loadInboxSurface(port, {}));
    const tasks = await Effect.runPromise(loadTasksSurface(port, { status: "planned" }));
    const events = await Effect.runPromise(
      loadEventsSurface(port, { syncState: "pending_approval" }),
    );
    const projects = await Effect.runPromise(loadProjectsSurface(port, {}));
    const notes = await Effect.runPromise(
      loadNotesSurface(port, { linkedEntityRef: "signal:signal-1" }),
    );
    const signals = await Effect.runPromise(
      loadSignalsSurface(port, { triageState: "untriaged" }),
    );
    const notifications = await Effect.runPromise(
      loadNotificationsSurface(port, { status: "pending" }),
    );
    const search = await Effect.runPromise(
      loadSearchSurface(port, { query: "approval", limit: 5 }),
    );
    const settingsBefore = await Effect.runPromise(loadSettingsSurface(port));
    const settingsAfter = await Effect.runPromise(
      saveSettingsSurface(port, {
        values: {
          "ai.provider": "pi-mono",
          "defaults.timezone": "UTC",
        },
      }),
    );

    expect(plan.timeline.map((item) => item.id)).toEqual(["event-1", "task-1"]);
    expect(inbox.entries).toHaveLength(2);
    expect(inbox.suggestions).toHaveLength(1);
    expect(inbox.signals).toHaveLength(1);
    expect(tasks.tasks).toHaveLength(1);
    expect(events.events).toHaveLength(1);
    expect(events.pendingApprovalCount).toBe(1);
    expect(projects.projects[0]?.taskCount).toBe(1);
    expect(notes.notes).toHaveLength(1);
    expect(signals.signals).toHaveLength(1);
    expect(notifications.notifications).toHaveLength(1);
    expect(search.results.some((result) => result.entityId === "notification-1")).toBe(
      true,
    );
    expect(settingsBefore.values["ai.provider"]).toBe("pi-mono");
    expect(settingsAfter.values["defaults.timezone"]).toBe("UTC");
  });

  test("all new surfaces map list/upsert failures into typed errors", async () => {
    const failingPort: WorkflowSurfaceCorePort = {
      listEntities: () => Effect.fail(new Error("read failed")),
      getEntity: () => Effect.fail(new Error("read failed")),
      upsertMemory: () => Effect.fail(new Error("write failed")),
    };

    const [
      plan,
      inbox,
      tasks,
      events,
      projects,
      notes,
      signals,
      notifications,
      search,
      settingsLoad,
      settingsSave,
    ] = await Promise.all([
      Effect.runPromise(Effect.either(loadPlanSurface(failingPort, {}))),
      Effect.runPromise(Effect.either(loadInboxSurface(failingPort, {}))),
      Effect.runPromise(Effect.either(loadTasksSurface(failingPort, {}))),
      Effect.runPromise(Effect.either(loadEventsSurface(failingPort, {}))),
      Effect.runPromise(Effect.either(loadProjectsSurface(failingPort, {}))),
      Effect.runPromise(Effect.either(loadNotesSurface(failingPort, {}))),
      Effect.runPromise(Effect.either(loadSignalsSurface(failingPort, {}))),
      Effect.runPromise(Effect.either(loadNotificationsSurface(failingPort, {}))),
      Effect.runPromise(
        Effect.either(
          loadSearchSurface(failingPort, {
            query: "x",
          }),
        ),
      ),
      Effect.runPromise(Effect.either(loadSettingsSurface(failingPort))),
      Effect.runPromise(
        Effect.either(saveSettingsSurface(failingPort, { values: { a: "b" } })),
      ),
    ]);

    expect(Either.isLeft(plan) && plan.left._tag).toBe("PlanSurfaceError");
    expect(Either.isLeft(inbox) && inbox.left._tag).toBe("InboxSurfaceError");
    expect(Either.isLeft(tasks) && tasks.left._tag).toBe("TasksSurfaceError");
    expect(Either.isLeft(events) && events.left._tag).toBe("EventsSurfaceError");
    expect(Either.isLeft(projects) && projects.left._tag).toBe("ProjectsSurfaceError");
    expect(Either.isLeft(notes) && notes.left._tag).toBe("NotesSurfaceError");
    expect(Either.isLeft(signals) && signals.left._tag).toBe("SignalsSurfaceError");
    expect(Either.isLeft(notifications) && notifications.left._tag).toBe(
      "NotificationsSurfaceError",
    );
    expect(Either.isLeft(search) && search.left._tag).toBe("SearchSurfaceError");
    expect(Either.isLeft(settingsLoad) && settingsLoad.left._tag).toBe(
      "SettingsSurfaceError",
    );
    expect(Either.isLeft(settingsSave) && settingsSave.left._tag).toBe(
      "SettingsSurfaceError",
    );
  });
});

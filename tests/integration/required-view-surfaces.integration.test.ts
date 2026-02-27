import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { buildCorePlatform } from "../../src/core/app/core-platform";
import { loadEventsSurface } from "../../src/ui/workflows/events-surface";
import { loadInboxSurface } from "../../src/ui/workflows/inbox-surface";
import { loadNotesSurface } from "../../src/ui/workflows/notes-surface";
import { loadNotificationsSurface } from "../../src/ui/workflows/notifications-surface";
import { loadPlanSurface } from "../../src/ui/workflows/plan-surface";
import { loadProjectsSurface } from "../../src/ui/workflows/projects-surface";
import { loadSearchSurface } from "../../src/ui/workflows/search-surface";
import {
  loadSettingsSurface,
  saveSettingsSurface,
} from "../../src/ui/workflows/settings-surface";
import { loadSignalsSurface } from "../../src/ui/workflows/signals-surface";
import { loadTasksSurface } from "../../src/ui/workflows/tasks-surface";
import { WorkflowSurfaceCorePort } from "../../src/ui/workflows/workflow-surface-core-port";

const USER = { id: "user-1", kind: "user" } as const;
const AI = { id: "ai-1", kind: "ai" } as const;

describe("required view surfaces integration", () => {
  test("new required surfaces orchestrate over buildCorePlatform", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const port: WorkflowSurfaceCorePort = {
      listEntities: platform.listEntities,
      getEntity: platform.getEntity,
      upsertMemory: platform.upsertMemory,
    };

    await Effect.runPromise(
      platform.captureEntry({
        entryId: "entry-surface-inbox-1",
        content: "Captured inbox item",
        actor: USER,
        at: new Date("2026-02-24T09:00:00.000Z"),
      }),
    );
    await Effect.runPromise(
      platform.captureEntry({
        entryId: "entry-surface-suggested-1",
        content: "Suggested inbox item",
        actor: USER,
        at: new Date("2026-02-24T09:01:00.000Z"),
      }),
    );
    await Effect.runPromise(
      platform.suggestEntryAsTask({
        entryId: "entry-surface-suggested-1",
        suggestedTitle: "Draft project kickoff checklist",
        actor: AI,
        at: new Date("2026-02-24T09:02:00.000Z"),
      }),
    );
    await Effect.runPromise(
      platform.acceptEntryAsTask({
        entryId: "entry-surface-suggested-1",
        taskId: "task-surface-1",
        actor: USER,
        at: new Date("2026-02-24T09:03:00.000Z"),
      }),
    );

    await Effect.runPromise(
      platform.ingestSignal({
        signalId: "signal-surface-inbox-1",
        source: "email",
        payload: "Untriaged inbox signal",
        actor: AI,
        at: new Date("2026-02-24T10:00:00.000Z"),
      }),
    );

    await Effect.runPromise(
      platform.ingestSignal({
        signalId: "signal-surface-event-1",
        source: "calendar-import",
        payload: "Surface event sync",
        actor: AI,
        at: new Date("2026-02-24T10:05:00.000Z"),
      }),
    );
    await Effect.runPromise(
      platform.triageSignal(
        "signal-surface-event-1",
        "needs event",
        USER,
        new Date("2026-02-24T10:06:00.000Z"),
      ),
    );
    await Effect.runPromise(
      platform.convertSignal({
        signalId: "signal-surface-event-1",
        targetType: "event",
        targetId: "event-surface-1",
        actor: USER,
        at: new Date("2026-02-24T10:07:00.000Z"),
      }),
    );

    await Effect.runPromise(
      platform.ingestSignal({
        signalId: "signal-surface-project-1",
        source: "chat",
        payload: "Surface project initiative",
        actor: AI,
        at: new Date("2026-02-24T10:08:00.000Z"),
      }),
    );
    await Effect.runPromise(
      platform.triageSignal(
        "signal-surface-project-1",
        "needs project",
        USER,
        new Date("2026-02-24T10:09:00.000Z"),
      ),
    );
    await Effect.runPromise(
      platform.convertSignal({
        signalId: "signal-surface-project-1",
        targetType: "project",
        targetId: "project-surface-1",
        actor: USER,
        at: new Date("2026-02-24T10:10:00.000Z"),
      }),
    );

    await Effect.runPromise(
      platform.ingestSignal({
        signalId: "signal-surface-note-1",
        source: "chat",
        payload: "Surface note context",
        actor: AI,
        at: new Date("2026-02-24T10:11:00.000Z"),
      }),
    );
    await Effect.runPromise(
      platform.triageSignal(
        "signal-surface-note-1",
        "needs note",
        USER,
        new Date("2026-02-24T10:12:00.000Z"),
      ),
    );
    await Effect.runPromise(
      platform.convertSignal({
        signalId: "signal-surface-note-1",
        targetType: "note",
        targetId: "note-surface-1",
        actor: USER,
        at: new Date("2026-02-24T10:13:00.000Z"),
      }),
    );

    await Effect.runPromise(
      platform.requestEventSync(
        "event-surface-1",
        USER,
        new Date("2026-02-24T10:14:00.000Z"),
      ),
    );

    await Effect.runPromise(
      platform.upsertMemory({
        key: "settings.ai.provider",
        value: "\"pi-mono\"",
        source: "integration-test",
        confidence: 1,
        at: new Date("2026-02-24T10:15:00.000Z"),
      }),
    );

    const plan = await Effect.runPromise(loadPlanSurface(port, {}));
    const inbox = await Effect.runPromise(loadInboxSurface(port, {}));
    const tasks = await Effect.runPromise(loadTasksSurface(port, {}));
    const events = await Effect.runPromise(loadEventsSurface(port, {}));
    const projects = await Effect.runPromise(loadProjectsSurface(port, {}));
    const notes = await Effect.runPromise(loadNotesSurface(port, {}));
    const signals = await Effect.runPromise(loadSignalsSurface(port, {}));
    const notifications = await Effect.runPromise(loadNotificationsSurface(port, {}));
    const search = await Effect.runPromise(
      loadSearchSurface(port, {
        query: "approval required",
      }),
    );
    const settingsBefore = await Effect.runPromise(loadSettingsSurface(port));
    const settingsAfter = await Effect.runPromise(
      saveSettingsSurface(port, {
        values: {
          "defaults.timezone": "UTC",
        },
      }),
    );

    expect(plan.timeline.some((item) => item.id === "task-surface-1")).toBe(true);
    expect(plan.timeline.some((item) => item.id === "event-surface-1")).toBe(true);
    expect(inbox.entries.some((entry) => entry.id === "entry-surface-inbox-1")).toBe(true);
    expect(inbox.signals.some((signal) => signal.id === "signal-surface-inbox-1")).toBe(
      true,
    );
    expect(tasks.tasks.some((task) => task.id === "task-surface-1")).toBe(true);
    expect(events.events.some((event) => event.id === "event-surface-1")).toBe(true);
    expect(projects.projects.some((item) => item.project.id === "project-surface-1")).toBe(
      true,
    );
    expect(notes.notes.some((note) => note.id === "note-surface-1")).toBe(true);
    expect(signals.signals.some((signal) => signal.id === "signal-surface-inbox-1")).toBe(
      true,
    );
    expect(
      notifications.notifications.some(
        (notification) =>
          notification.type === "approval_required" &&
          notification.relatedEntityId === "event-surface-1",
      ),
    ).toBe(true);
    expect(search.results.some((result) => result.entityType === "notification")).toBe(
      true,
    );
    expect(settingsBefore.values["ai.provider"]).toBe("pi-mono");
    expect(settingsAfter.values["defaults.timezone"]).toBe("UTC");
  });
});

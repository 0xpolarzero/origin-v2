import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import ReactDOMServer from "react-dom/server";

import { buildCorePlatform } from "../../src/core/app/core-platform";
import { type Entry } from "../../src/core/domain/entry";
import { type Event } from "../../src/core/domain/event";
import { type OutboundDraft } from "../../src/core/domain/outbound-draft";
import { type Signal } from "../../src/core/domain/signal";
import { type Task } from "../../src/core/domain/task";
import {
  createInteractiveWorkflowAppShell,
  makeInteractiveWorkflowApp,
  selectActivityCheckpoint,
  selectActivityFeed,
  selectJobHistory,
  selectJobInspection,
  selectPendingApprovals,
  selectPlanStatusSummary,
  selectSuggestions,
} from "../../src/app/interactive-workflow-app";

const ACTOR = {
  id: "user-ui-1",
  kind: "user",
} as const;

describe("interactive workflow app shell integration", () => {
  test("covers required UI flows end-to-end against in-process workflow dispatcher", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const app = makeInteractiveWorkflowApp({
      platform,
      actor: ACTOR,
      jobsFilters: {},
      activityFilters: {},
    });

    let state = await Effect.runPromise(app.load());
    expect(state.inbox.entries).toHaveLength(0);

    state = await Effect.runPromise(
      app.captureEntry({
        entryId: "entry-ui-1",
        content: "Draft this project kickoff plan",
        at: new Date("2026-02-23T10:00:00.000Z"),
      }),
    );
    expect(state.inbox.entries.some((entry) => entry.id === "entry-ui-1")).toBe(true);

    state = await Effect.runPromise(
      app.suggestEntryAsTask({
        entryId: "entry-ui-1",
        suggestedTitle: "Prepare kickoff plan",
        at: new Date("2026-02-23T10:01:00.000Z"),
      }),
    );
    expect(selectSuggestions(state).map((entry) => entry.id)).toContain("entry-ui-1");

    state = await Effect.runPromise(
      app.editEntrySuggestion({
        entryId: "entry-ui-1",
        suggestedTitle: "Prepare detailed kickoff plan",
        at: new Date("2026-02-23T10:02:00.000Z"),
      }),
    );
    const editedEntry = state.inbox.entries.find((entry) => entry.id === "entry-ui-1");
    expect(editedEntry?.suggestedTaskTitle).toBe("Prepare detailed kickoff plan");

    state = await Effect.runPromise(
      app.acceptEntryAsTask({
        entryId: "entry-ui-1",
        taskId: "task-ui-plan-1",
        title: "Prepare detailed kickoff plan",
        at: new Date("2026-02-23T10:03:00.000Z"),
      }),
    );

    await Effect.runPromise(
      app.captureEntry({
        entryId: "entry-ui-2",
        content: "Maybe schedule onboarding",
        at: new Date("2026-02-23T10:04:00.000Z"),
      }),
    );
    await Effect.runPromise(
      app.suggestEntryAsTask({
        entryId: "entry-ui-2",
        suggestedTitle: "Schedule onboarding",
        at: new Date("2026-02-23T10:05:00.000Z"),
      }),
    );
    state = await Effect.runPromise(
      app.rejectEntrySuggestion({
        entryId: "entry-ui-2",
        reason: "Not needed this week",
        at: new Date("2026-02-23T10:06:00.000Z"),
      }),
    );

    const entries = await Effect.runPromise(platform.listEntities<Entry>("entry"));
    expect(entries.find((entry) => entry.id === "entry-ui-1")?.status).toBe(
      "accepted_as_task",
    );
    expect(entries.find((entry) => entry.id === "entry-ui-2")?.status).toBe(
      "rejected",
    );

    await Effect.runPromise(
      app.ingestSignal({
        signalId: "signal-ui-task-1",
        source: "email",
        payload: "Reply to procurement thread",
        at: new Date("2026-02-23T10:07:00.000Z"),
      }),
    );
    await Effect.runPromise(
      app.triageSignal({
        signalId: "signal-ui-task-1",
        decision: "actionable",
        at: new Date("2026-02-23T10:08:00.000Z"),
      }),
    );
    state = await Effect.runPromise(
      app.convertSignal({
        signalId: "signal-ui-task-1",
        targetType: "task",
        targetId: "task-ui-plan-2",
        at: new Date("2026-02-23T10:09:00.000Z"),
      }),
    );
    expect(state.signals.signals.some((signal) => signal.id === "signal-ui-task-1")).toBe(
      true,
    );

    await Effect.runPromise(
      app.captureEntry({
        entryId: "entry-ui-3",
        content: "Finalize launch checklist",
        at: new Date("2026-02-23T10:10:00.000Z"),
      }),
    );
    await Effect.runPromise(
      app.acceptEntryAsTask({
        entryId: "entry-ui-3",
        taskId: "task-ui-plan-3",
        title: "Finalize launch checklist",
        at: new Date("2026-02-23T10:11:00.000Z"),
      }),
    );

    await Effect.runPromise(
      app.completeTask({
        taskId: "task-ui-plan-1",
        at: new Date("2026-02-23T10:12:00.000Z"),
      }),
    );
    await Effect.runPromise(
      app.deferTask({
        taskId: "task-ui-plan-2",
        until: new Date("2026-02-26T09:00:00.000Z"),
        at: new Date("2026-02-23T10:13:00.000Z"),
      }),
    );
    state = await Effect.runPromise(
      app.rescheduleTask({
        taskId: "task-ui-plan-3",
        nextAt: new Date("2026-02-25T08:00:00.000Z"),
        at: new Date("2026-02-23T10:14:00.000Z"),
      }),
    );

    const planSummary = selectPlanStatusSummary(state);
    expect(planSummary).toEqual({
      planned: 1,
      deferred: 1,
      completed: 1,
    });

    await Effect.runPromise(
      app.ingestSignal({
        signalId: "signal-ui-event-1",
        source: "calendar-import",
        payload: "Customer sync call",
        at: new Date("2026-02-23T10:15:00.000Z"),
      }),
    );
    await Effect.runPromise(
      app.triageSignal({
        signalId: "signal-ui-event-1",
        decision: "convert_to_event",
        at: new Date("2026-02-23T10:16:00.000Z"),
      }),
    );
    await Effect.runPromise(
      app.convertSignal({
        signalId: "signal-ui-event-1",
        targetType: "event",
        targetId: "event-ui-approval-1",
        at: new Date("2026-02-23T10:17:00.000Z"),
      }),
    );

    await Effect.runPromise(
      app.requestEventSync({
        eventId: "event-ui-approval-1",
        at: new Date("2026-02-23T10:18:00.000Z"),
      }),
    );

    state = await Effect.runPromise(app.load());
    expect(selectPendingApprovals(state).events.map((event) => event.id)).toContain(
      "event-ui-approval-1",
    );

    state = await Effect.runPromise(
      app.approveOutboundAction({
        actionType: "event_sync",
        entityType: "event",
        entityId: "event-ui-approval-1",
        approved: true,
        at: new Date("2026-02-23T10:19:00.000Z"),
      }),
    );

    await Effect.runPromise(
      app.ingestSignal({
        signalId: "signal-ui-draft-1",
        source: "slack",
        payload: "Ship release status update",
        at: new Date("2026-02-23T10:20:00.000Z"),
      }),
    );
    await Effect.runPromise(
      app.triageSignal({
        signalId: "signal-ui-draft-1",
        decision: "convert_to_outbound",
        at: new Date("2026-02-23T10:21:00.000Z"),
      }),
    );
    await Effect.runPromise(
      app.convertSignal({
        signalId: "signal-ui-draft-1",
        targetType: "outbound_draft",
        targetId: "draft-ui-approval-1",
        at: new Date("2026-02-23T10:22:00.000Z"),
      }),
    );
    await Effect.runPromise(
      app.requestOutboundDraftExecution({
        draftId: "draft-ui-approval-1",
        at: new Date("2026-02-23T10:23:00.000Z"),
      }),
    );

    state = await Effect.runPromise(app.load());
    expect(
      selectPendingApprovals(state).outboundDrafts.map((draft) => draft.id),
    ).toContain("draft-ui-approval-1");

    state = await Effect.runPromise(
      app.approveOutboundAction({
        actionType: "outbound_draft",
        entityType: "outbound_draft",
        entityId: "draft-ui-approval-1",
        approved: true,
        at: new Date("2026-02-23T10:24:00.000Z"),
      }),
    );

    const events = await Effect.runPromise(platform.listEntities<Event>("event"));
    const drafts = await Effect.runPromise(
      platform.listEntities<OutboundDraft>("outbound_draft"),
    );
    expect(events.find((event) => event.id === "event-ui-approval-1")?.syncState).toBe(
      "synced",
    );
    expect(drafts.find((draft) => draft.id === "draft-ui-approval-1")?.status).toBe(
      "executed",
    );
    expect(
      drafts.find((draft) => draft.id === "draft-ui-approval-1")?.executionId,
    ).toBeDefined();
    expect(selectPendingApprovals(state).events).toHaveLength(0);
    expect(selectPendingApprovals(state).outboundDrafts).toHaveLength(0);

    await Effect.runPromise(
      app.createJob({
        jobId: "job-ui-1",
        name: "Nightly summary generation",
        at: new Date("2026-02-23T10:25:00.000Z"),
      }),
    );
    await Effect.runPromise(
      app.recordJobRun({
        jobId: "job-ui-1",
        outcome: "failed",
        diagnostics: "timeout",
        at: new Date("2026-02-23T10:26:00.000Z"),
      }),
    );
    state = await Effect.runPromise(app.inspectJob("job-ui-1"));
    expect(selectJobInspection(state)?.runState).toBe("failed");

    state = await Effect.runPromise(
      app.retryJob({
        jobId: "job-ui-1",
        fixSummary: "increase timeout",
        at: new Date("2026-02-23T10:27:00.000Z"),
      }),
    );
    expect(selectJobInspection(state)?.runState).toBe("retrying");
    expect(selectJobHistory(state)).toHaveLength(1);

    await Effect.runPromise(
      app.createCheckpoint({
        checkpointId: "checkpoint-ui-1",
        name: "Before AI refactor",
        rollbackTarget: "audit-100",
        auditCursor: 100,
        snapshotEntityRefs: [
          {
            entityType: "task",
            entityId: "task-ui-plan-1",
          },
        ],
        at: new Date("2026-02-23T10:28:00.000Z"),
      }),
    );

    state = await Effect.runPromise(app.inspectCheckpoint("checkpoint-ui-1"));
    expect(selectActivityCheckpoint(state)?.id).toBe("checkpoint-ui-1");

    await Effect.runPromise(
      app.keepCheckpoint({
        checkpointId: "checkpoint-ui-1",
        at: new Date("2026-02-23T10:29:00.000Z"),
      }),
    );
    state = await Effect.runPromise(
      app.recoverCheckpoint({
        checkpointId: "checkpoint-ui-1",
        at: new Date("2026-02-23T10:30:00.000Z"),
      }),
    );

    expect(selectActivityCheckpoint(state)?.status).toBe("recovered");
    expect(selectActivityFeed(state).some((item) => item.toState === "recovered")).toBe(
      true,
    );

    const signals = await Effect.runPromise(platform.listEntities<Signal>("signal"));
    expect(
      signals.find((signal) => signal.id === "signal-ui-task-1")?.triageState,
    ).toBe("converted");

    const tasks = await Effect.runPromise(platform.listEntities<Task>("task"));
    expect(tasks.map((task) => task.id).sort()).toEqual([
      "task-ui-plan-1",
      "task-ui-plan-2",
      "task-ui-plan-3",
    ]);

    state = await Effect.runPromise(
      app.createProject({
        projectId: "project-ui-direct-1",
        name: "Direct project create",
        description: "Created directly from app shell route binding",
        at: new Date("2026-02-23T10:31:00.000Z"),
      }),
    );
    expect(state.projects.projects.some((item) => item.project.id === "project-ui-direct-1")).toBe(
      true,
    );

    state = await Effect.runPromise(
      app.updateProject({
        projectId: "project-ui-direct-1",
        name: "Direct project create (updated)",
        at: new Date("2026-02-23T10:32:00.000Z"),
      }),
    );
    expect(
      state.projects.projects.find((item) => item.project.id === "project-ui-direct-1")?.project
        .name,
    ).toBe("Direct project create (updated)");

    state = await Effect.runPromise(
      app.setProjectLifecycle({
        projectId: "project-ui-direct-1",
        lifecycle: "paused",
        at: new Date("2026-02-23T10:33:00.000Z"),
      }),
    );
    expect(
      state.projects.projects.find((item) => item.project.id === "project-ui-direct-1")?.project
        .lifecycle,
    ).toBe("paused");

    state = await Effect.runPromise(
      app.loadProjects({
        lifecycle: "paused",
      }),
    );
    expect(state.projects.filters.lifecycle).toBe("paused");

    state = await Effect.runPromise(
      app.createProject({
        projectId: "project-ui-direct-2",
        name: "Direct project create (filter retention check)",
        at: new Date("2026-02-23T10:33:30.000Z"),
      }),
    );
    expect(state.projects.filters.lifecycle).toBe("paused");
    expect(state.projects.projects.some((item) => item.project.id === "project-ui-direct-2")).toBe(
      false,
    );

    state = await Effect.runPromise(
      app.createTask({
        taskId: "task-ui-direct-1",
        title: "Direct task create",
        projectId: "project-ui-direct-1",
        at: new Date("2026-02-23T10:34:00.000Z"),
      }),
    );
    expect(state.tasks.tasks.some((task) => task.id === "task-ui-direct-1")).toBe(true);

    state = await Effect.runPromise(
      app.updateTask({
        taskId: "task-ui-direct-1",
        title: "Direct task create (updated)",
        at: new Date("2026-02-23T10:35:00.000Z"),
      }),
    );
    expect(state.tasks.tasks.find((task) => task.id === "task-ui-direct-1")?.title).toBe(
      "Direct task create (updated)",
    );

    state = await Effect.runPromise(
      app.loadTasks({
        status: "completed",
      }),
    );
    expect(state.tasks.filters.status).toBe("completed");

    state = await Effect.runPromise(
      app.createTask({
        taskId: "task-ui-direct-2",
        title: "Direct task create (filtered-state check)",
        at: new Date("2026-02-23T10:35:30.000Z"),
      }),
    );
    expect(state.tasks.filters.status).toBe("completed");
    expect(state.tasks.tasks.some((task) => task.id === "task-ui-direct-2")).toBe(false);

    state = await Effect.runPromise(
      app.createEvent({
        eventId: "event-ui-direct-1",
        title: "Direct event create",
        startAt: new Date("2026-02-26T12:00:00.000Z"),
        at: new Date("2026-02-23T10:36:00.000Z"),
      }),
    );
    expect(state.events.events.some((event) => event.id === "event-ui-direct-1")).toBe(true);

    state = await Effect.runPromise(
      app.updateEvent({
        eventId: "event-ui-direct-1",
        title: "Direct event create (updated)",
        at: new Date("2026-02-23T10:37:00.000Z"),
      }),
    );
    expect(state.events.events.find((event) => event.id === "event-ui-direct-1")?.title).toBe(
      "Direct event create (updated)",
    );

    state = await Effect.runPromise(
      app.loadEvents({
        syncState: "pending_approval",
      }),
    );
    expect(state.events.filters.syncState).toBe("pending_approval");

    state = await Effect.runPromise(
      app.createEvent({
        eventId: "event-ui-direct-2",
        title: "Direct event create (filter retention check)",
        startAt: new Date("2026-02-27T12:00:00.000Z"),
        at: new Date("2026-02-23T10:37:30.000Z"),
      }),
    );
    expect(state.events.filters.syncState).toBe("pending_approval");
    expect(state.events.events.some((event) => event.id === "event-ui-direct-2")).toBe(false);

    state = await Effect.runPromise(
      app.createNote({
        noteId: "note-ui-direct-1",
        body: "Direct note create",
        linkedEntityRefs: ["project:project-ui-direct-1"],
        at: new Date("2026-02-23T10:38:00.000Z"),
      }),
    );
    expect(state.notes.notes.some((note) => note.id === "note-ui-direct-1")).toBe(true);

    state = await Effect.runPromise(
      app.updateNote({
        noteId: "note-ui-direct-1",
        body: "Direct note create (updated)",
        at: new Date("2026-02-23T10:39:00.000Z"),
      }),
    );
    expect(state.notes.notes.find((note) => note.id === "note-ui-direct-1")?.body).toBe(
      "Direct note create (updated)",
    );

    state = await Effect.runPromise(
      app.linkNoteEntity({
        noteId: "note-ui-direct-1",
        entityRef: "task:task-ui-direct-1",
        at: new Date("2026-02-23T10:40:00.000Z"),
      }),
    );
    expect(
      state.notes.notes.find((note) => note.id === "note-ui-direct-1")?.linkedEntityRefs,
    ).toContain("task:task-ui-direct-1");

    state = await Effect.runPromise(
      app.unlinkNoteEntity({
        noteId: "note-ui-direct-1",
        entityRef: "task:task-ui-direct-1",
        at: new Date("2026-02-23T10:41:00.000Z"),
      }),
    );
    expect(
      state.notes.notes.find((note) => note.id === "note-ui-direct-1")?.linkedEntityRefs,
    ).not.toContain("task:task-ui-direct-1");

    state = await Effect.runPromise(
      app.loadNotes({
        linkedEntityRef: "project:project-ui-direct-1",
      }),
    );
    expect(state.notes.filters.linkedEntityRef).toBe("project:project-ui-direct-1");

    state = await Effect.runPromise(
      app.createNote({
        noteId: "note-ui-direct-2",
        body: "Direct note create (filter retention check)",
        at: new Date("2026-02-23T10:41:30.000Z"),
      }),
    );
    expect(state.notes.filters.linkedEntityRef).toBe("project:project-ui-direct-1");
    expect(state.notes.notes.some((note) => note.id === "note-ui-direct-2")).toBe(false);

    state = await Effect.runPromise(app.loadNotifications({ status: "pending" }));
    expect(state.notifications.notifications.length).toBeGreaterThan(0);
    const notificationId = state.notifications.notifications[0]?.id;
    expect(notificationId).toBeDefined();

    state = await Effect.runPromise(
      app.acknowledgeNotification({
        notificationId: notificationId!,
        at: new Date("2026-02-23T10:42:00.000Z"),
      }),
    );
    expect(state.notifications.filters.status).toBe("pending");
    expect(
      state.notifications.notifications.some(
        (notification) => notification.id === notificationId,
      ),
    ).toBe(false);

    state = await Effect.runPromise(app.loadNotifications());
    expect(
      state.notifications.notifications.find(
        (notification) => notification.id === notificationId,
      )?.status,
    ).toBe("sent");

    state = await Effect.runPromise(
      app.dismissNotification({
        notificationId: notificationId!,
        at: new Date("2026-02-23T10:43:00.000Z"),
      }),
    );
    expect(
      state.notifications.notifications.find(
        (notification) => notification.id === notificationId,
      )?.status,
    ).toBe("dismissed");

    state = await Effect.runPromise(
      app.search({
        query: "direct",
        entityTypes: ["task"],
        limit: 1,
      }),
    );
    expect(state.search.results.length).toBeGreaterThan(0);
    expect(state.search.results.length).toBeLessThanOrEqual(1);
    expect(state.search.scannedEntityTypes).toEqual(["task"]);

    state = await Effect.runPromise(
      app.createTask({
        taskId: "task-ui-direct-3",
        title: "Direct task create (search retention check)",
        at: new Date("2026-02-23T10:43:30.000Z"),
      }),
    );
    expect(state.search.results.length).toBeLessThanOrEqual(1);
    expect(state.search.scannedEntityTypes).toEqual(["task"]);

    state = await Effect.runPromise(
      app.saveSettings({
        values: {
          "defaults.timezone": "UTC",
          "ai.provider": "pi-mono",
        },
        at: new Date("2026-02-23T10:44:00.000Z"),
      }),
    );
    expect(state.settings.values["defaults.timezone"]).toBe("UTC");
    expect(state.settings.values["ai.provider"]).toBe("pi-mono");

    state = await Effect.runPromise(
      app.saveSettings({
        values: {
          "defaults.timezone": "America/Los_Angeles",
        },
        at: new Date("2026-02-23T10:45:00.000Z"),
      }),
    );
    expect(state.settings.values["defaults.timezone"]).toBe("America/Los_Angeles");
    expect(state.settings.values["ai.provider"]).toBe("pi-mono");

    state = await Effect.runPromise(
      app.loadSettings(["defaults.timezone"]),
    );
    expect(state.settings.values["defaults.timezone"]).toBe("America/Los_Angeles");
    expect(state.settings.values["ai.provider"]).toBe("pi-mono");

    const shellMarkup = ReactDOMServer.renderToStaticMarkup(
      createInteractiveWorkflowAppShell({
        platform,
        actor: ACTOR,
      }),
    );
    expect(shellMarkup).toContain("Origin App Shell");
  });
});

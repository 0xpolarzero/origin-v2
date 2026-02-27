import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Effect } from "effect";

import { buildCorePlatform } from "../../src/core/app/core-platform";
import { CoreRepository } from "../../src/core/repositories/core-repository";
import { makeInMemoryCoreRepository } from "../../src/core/repositories/in-memory-core-repository";

describe("Core Platform integration", () => {
  test("captures an Entry and promotes it into a triaged Task", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());

    await Effect.runPromise(
      platform.captureEntry({
        entryId: "entry-1",
        content: "Prepare sprint plan",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T08:00:00.000Z"),
      }),
    );

    const task = await Effect.runPromise(
      platform.acceptEntryAsTask({
        entryId: "entry-1",
        taskId: "task-1",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T08:05:00.000Z"),
      }),
    );

    const audit = await Effect.runPromise(
      platform.listAuditTrail({ entityType: "task", entityId: "task-1" }),
    );

    expect(task.id).toBe("task-1");
    expect(task.status).toBe("planned");
    expect(task.sourceEntryId).toBe("entry-1");
    expect(audit).toHaveLength(1);
  });

  test("moves a Task through project planning and checkpoint creation", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());

    await Effect.runPromise(
      platform.captureEntry({
        entryId: "entry-2",
        content: "Draft launch checklist",
        actor: { id: "user-1", kind: "user" },
      }),
    );

    await Effect.runPromise(
      platform.acceptEntryAsTask({
        entryId: "entry-2",
        taskId: "task-2",
        actor: { id: "user-1", kind: "user" },
      }),
    );

    await Effect.runPromise(
      platform.rescheduleTask("task-2", new Date("2026-02-24T12:00:00.000Z"), {
        id: "user-1",
        kind: "user",
      }),
    );

    await Effect.runPromise(
      platform.completeTask(
        "task-2",
        { id: "user-1", kind: "user" },
        new Date("2026-02-24T12:30:00.000Z"),
      ),
    );

    const checkpoint = await Effect.runPromise(
      platform.createWorkflowCheckpoint({
        checkpointId: "checkpoint-1",
        name: "After planning",
        snapshotEntityRefs: [{ entityType: "task", entityId: "task-2" }],
        auditCursor: 10,
        rollbackTarget: "audit-10",
        actor: { id: "user-1", kind: "user" },
      }),
    );

    const task = await Effect.runPromise(platform.getEntity("task", "task-2"));

    expect((task as { status: string }).status).toBe("completed");
    expect(checkpoint.status).toBe("created");
  });

  test("wires task/event/project/note/notification/search service families end-to-end", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const actor = { id: "user-platform-services-1", kind: "user" } as const;

    const project = await Effect.runPromise(
      platform.createProject({
        projectId: "project-platform-services-1",
        name: "Platform planning project",
        description: "Initial platform planning scope",
        actor,
        at: new Date("2026-02-25T08:00:00.000Z"),
      }),
    );
    const updatedProject = await Effect.runPromise(
      platform.updateProject({
        projectId: project.id,
        description: "Expanded platform planning scope",
        actor,
        at: new Date("2026-02-25T08:05:00.000Z"),
      }),
    );
    const pausedProject = await Effect.runPromise(
      platform.setProjectLifecycle(
        project.id,
        "paused",
        actor,
        new Date("2026-02-25T08:06:00.000Z"),
      ),
    );
    const pausedProjects = await Effect.runPromise(
      platform.listProjects({ lifecycle: "paused" }),
    );

    const task = await Effect.runPromise(
      platform.createTask({
        taskId: "task-platform-services-1",
        title: "Platform planning task",
        description: "Draft task details",
        projectId: project.id,
        actor,
        at: new Date("2026-02-25T08:10:00.000Z"),
      }),
    );
    const updatedTask = await Effect.runPromise(
      platform.updateTask({
        taskId: task.id,
        title: "Platform planning task updated",
        description: "Refined task details",
        actor,
        at: new Date("2026-02-25T08:11:00.000Z"),
      }),
    );
    const listedTasks = await Effect.runPromise(
      platform.listTasks({ projectId: project.id }),
    );

    const eventA = await Effect.runPromise(
      platform.createEvent({
        eventId: "event-platform-services-1",
        title: "Platform planning sync",
        startAt: new Date("2026-02-25T09:00:00.000Z"),
        endAt: new Date("2026-02-25T10:00:00.000Z"),
        actor,
        at: new Date("2026-02-25T08:20:00.000Z"),
      }),
    );
    const eventB = await Effect.runPromise(
      platform.createEvent({
        eventId: "event-platform-services-2",
        title: "Platform planning overlap",
        startAt: new Date("2026-02-25T09:30:00.000Z"),
        endAt: new Date("2026-02-25T10:30:00.000Z"),
        actor,
        at: new Date("2026-02-25T08:21:00.000Z"),
      }),
    );
    const updatedEventA = await Effect.runPromise(
      platform.updateEvent({
        eventId: eventA.id,
        title: "Platform planning sync updated",
        actor,
        at: new Date("2026-02-25T08:22:00.000Z"),
      }),
    );
    const listedEvents = await Effect.runPromise(
      platform.listEvents({ sort: "updatedAt_desc" }),
    );
    const conflictsForEventA = await Effect.runPromise(
      platform.listEventConflicts(eventA.id),
    );

    const note = await Effect.runPromise(
      platform.createNote({
        noteId: "note-platform-services-1",
        body: "Platform planning notes",
        linkedEntityRefs: [`task:${task.id}`],
        actor,
        at: new Date("2026-02-25T08:30:00.000Z"),
      }),
    );
    const updatedNote = await Effect.runPromise(
      platform.updateNoteBody(
        note.id,
        "Platform planning notes refined",
        actor,
        new Date("2026-02-25T08:31:00.000Z"),
      ),
    );
    const linkedNote = await Effect.runPromise(
      platform.linkNoteEntity(
        note.id,
        `event:${eventA.id}`,
        actor,
        new Date("2026-02-25T08:32:00.000Z"),
      ),
    );
    const unlinkedNote = await Effect.runPromise(
      platform.unlinkNoteEntity(
        note.id,
        `event:${eventA.id}`,
        actor,
        new Date("2026-02-25T08:33:00.000Z"),
      ),
    );
    const notesForTask = await Effect.runPromise(
      platform.listNotes({ entityRef: `task:${task.id}` }),
    );

    const syncRequested = await Effect.runPromise(
      platform.requestEventSync(
        eventB.id,
        actor,
        new Date("2026-02-25T08:40:00.000Z"),
      ),
    );
    const pendingNotifications = await Effect.runPromise(
      platform.listNotifications({
        status: "pending",
        relatedEntity: { entityType: "event", entityId: eventB.id },
      }),
    );
    const acknowledgedNotification = await Effect.runPromise(
      platform.acknowledgeNotification(
        syncRequested.notification.id,
        actor,
        new Date("2026-02-25T08:41:00.000Z"),
      ),
    );
    const dismissedNotification = await Effect.runPromise(
      platform.dismissNotification(
        syncRequested.notification.id,
        actor,
        new Date("2026-02-25T08:42:00.000Z"),
      ),
    );
    const dismissedNotifications = await Effect.runPromise(
      platform.listNotifications({ status: "dismissed", limit: 1 }),
    );

    const searchResults = await Effect.runPromise(
      platform.searchEntities({
        query: "platform planning",
        entityTypes: ["project", "task", "note"],
      }),
    );

    expect(updatedProject.description).toBe("Expanded platform planning scope");
    expect(pausedProject.lifecycle).toBe("paused");
    expect(pausedProjects.map((row) => row.id)).toEqual([project.id]);

    expect(updatedTask.title).toBe("Platform planning task updated");
    expect(listedTasks.map((row) => row.id)).toEqual([task.id]);

    expect(updatedEventA.title).toBe("Platform planning sync updated");
    expect(listedEvents[0]?.id).toBe(eventA.id);
    expect(conflictsForEventA).toEqual([
      { eventId: eventA.id, conflictingEventId: eventB.id },
    ]);

    expect(updatedNote.body).toBe("Platform planning notes refined");
    expect(linkedNote.linkedEntityRefs).toContain(`event:${eventA.id}`);
    expect(unlinkedNote.linkedEntityRefs).not.toContain(`event:${eventA.id}`);
    expect(notesForTask.map((row) => row.id)).toEqual([note.id]);

    expect(syncRequested.event.syncState).toBe("pending_approval");
    expect(pendingNotifications.map((row) => row.id)).toEqual([
      syncRequested.notification.id,
    ]);
    expect(acknowledgedNotification.status).toBe("sent");
    expect(dismissedNotification.status).toBe("dismissed");
    expect(dismissedNotifications[0]?.id).toBe(syncRequested.notification.id);

    expect(searchResults.some((row) => row.entityType === "project")).toBe(true);
    expect(searchResults.some((row) => row.entityType === "task")).toBe(true);
    expect(searchResults.some((row) => row.entityType === "note")).toBe(true);
  });

  test("persists and rehydrates core entities across app restarts", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "origin-core-"));
    const snapshotPath = join(tempDir, "core-snapshot.json");

    try {
      const platformA = await Effect.runPromise(
        buildCorePlatform({
          snapshotPath,
        }),
      );

      await Effect.runPromise(
        platformA.captureEntry({
          entryId: "entry-3",
          content: "Persist me",
          actor: { id: "user-1", kind: "user" },
        }),
      );
      await Effect.runPromise(
        platformA.acceptEntryAsTask({
          entryId: "entry-3",
          taskId: "task-3",
          actor: { id: "user-1", kind: "user" },
        }),
      );
      await Effect.runPromise(platformA.persistSnapshot());

      const platformB = await Effect.runPromise(
        buildCorePlatform({
          snapshotPath,
          loadSnapshotOnInit: true,
        }),
      );

      const task = await Effect.runPromise(
        platformB.getEntity("task", "task-3"),
      );

      expect(task).toBeDefined();
      expect((task as { id: string }).id).toBe("task-3");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("wraps mutating workflow operations in repository transaction boundaries", async () => {
    const baseRepository = makeInMemoryCoreRepository();
    const transactionCalls: Array<string> = [];

    const repository: CoreRepository = {
      ...baseRepository,
      withTransaction: (effect) => {
        transactionCalls.push("withTransaction");
        return effect;
      },
    };
    const platform = await Effect.runPromise(
      buildCorePlatform({
        repository,
      }),
    );

    await Effect.runPromise(
      platform.captureEntry({
        entryId: "entry-tx-1",
        content: "Exercise transaction boundary",
        actor: { id: "user-1", kind: "user" },
      }),
    );

    expect(transactionCalls.length).toBe(1);
  });

  test("wraps legacy snapshot import in repository transaction boundary", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "origin-legacy-import-tx-"));
    const snapshotPath = join(tempDir, "legacy-snapshot.json");
    const baseRepository = makeInMemoryCoreRepository();
    const transactionCalls: Array<string> = [];

    writeFileSync(
      snapshotPath,
      JSON.stringify(
        {
          version: 1,
          entities: {
            entry: [
              {
                id: "entry-legacy-tx-1",
                content: "Imported entry",
                source: "manual",
                status: "captured",
                capturedAt: "2026-02-23T00:00:00.000Z",
                createdAt: "2026-02-23T00:00:00.000Z",
                updatedAt: "2026-02-23T00:00:00.000Z",
              },
            ],
          },
          auditTrail: [],
        },
        null,
        2,
      ),
      "utf8",
    );

    try {
      const repository: CoreRepository = {
        ...baseRepository,
        withTransaction: (effect) => {
          transactionCalls.push("withTransaction");
          return effect;
        },
      };

      const platform = await Effect.runPromise(
        buildCorePlatform({
          repository,
          snapshotPath,
          importSnapshotIntoDatabase: true,
        }),
      );

      const importedEntry = await Effect.runPromise(
        platform.getEntity<{ id: string }>("entry", "entry-legacy-tx-1"),
      );

      expect(importedEntry?.id).toBe("entry-legacy-tx-1");
      expect(transactionCalls).toEqual(["withTransaction"]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("exposes job/activity/checkpoint read surfaces and forwards retry fixSummary", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());

    await Effect.runPromise(
      platform.createJob({
        jobId: "job-platform-read-1",
        name: "Platform read test",
      }),
    );
    await Effect.runPromise(
      platform.recordJobRun({
        jobId: "job-platform-read-1",
        outcome: "failed",
        diagnostics: "Provider timeout",
        actor: { id: "system-1", kind: "system" },
        at: new Date("2026-02-23T19:00:00.000Z"),
      }),
    );
    await Effect.runPromise(
      platform.retryJob(
        "job-platform-read-1",
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T19:01:00.000Z"),
        "Increase timeout to 15 seconds",
      ),
    );

    await Effect.runPromise(
      platform.createWorkflowCheckpoint({
        checkpointId: "checkpoint-platform-read-1",
        name: "Checkpoint for inspect",
        snapshotEntityRefs: [],
        auditCursor: 20,
        rollbackTarget: "audit-20",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T19:02:00.000Z"),
      }),
    );

    const jobs = await Effect.runPromise(
      platform.listJobs({ runState: "retrying" }),
    );
    const inspectedCheckpoint = await Effect.runPromise(
      platform.inspectWorkflowCheckpoint("checkpoint-platform-read-1"),
    );
    const jobActivity = await Effect.runPromise(
      platform.listActivityFeed({
        entityType: "job",
        entityId: "job-platform-read-1",
      }),
    );
    const retryEntry = jobActivity.find((item) => item.toState === "retrying");

    expect(jobs.map((job) => job.id)).toEqual(["job-platform-read-1"]);
    expect(inspectedCheckpoint.id).toBe("checkpoint-platform-read-1");
    expect(retryEntry?.metadata).toMatchObject({
      fixSummary: "Increase timeout to 15 seconds",
    });
  });
});

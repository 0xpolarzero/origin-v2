/**
 * E2E Tests for Origin App Shell
 * 
 * These tests verify the actual app behavior end-to-end:
 * 1. Initial load completes (no infinite loading)
 * 2. Capture flow works
 * 3. Settings can be saved and loaded
 * 4. Full workflows work correctly
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { Effect } from "effect";

import { buildCorePlatform, type CorePlatform } from "../../src/core/app/core-platform";
import { makeInteractiveWorkflowApp, type InteractiveWorkflowApp } from "../../src/app/interactive-workflow-app";

// Test actor
const TEST_ACTOR = { id: "test-user", kind: "user" as const };

describe("E2E: App Shell Core Functionality", () => {
  let platform: CorePlatform;
  let app: InteractiveWorkflowApp;

  beforeEach(async () => {
    platform = await Effect.runPromise(buildCorePlatform());
    app = makeInteractiveWorkflowApp({
      platform,
      actor: TEST_ACTOR,
    });
  });

  afterEach(async () => {
    if (platform.close) {
      await Effect.runPromise(platform.close());
    }
  });

  test("app loads initial state without hanging", async () => {
    const startTime = Date.now();
    const state = await Effect.runPromise(app.load());
    const loadTime = Date.now() - startTime;

    // Should complete quickly (under 5 seconds)
    expect(loadTime).toBeLessThan(5000);

    // Should have empty initial state
    expect(state.inbox.entries).toHaveLength(0);
    expect(state.inbox.suggestions).toHaveLength(0);
    expect(state.tasks.tasks).toHaveLength(0);
    expect(state.events.events).toHaveLength(0);
    expect(state.projects.projects).toHaveLength(0);
    expect(state.notes.notes).toHaveLength(0);
  });

  test("AI is disabled by default", async () => {
    await Effect.runPromise(app.load());

    expect(app.isAIEnabled()).toBe(false);
    const config = app.getAIConfig();
    expect(config.enabled).toBe(false);
    expect(config.provider).toBe("openai");
    expect(config.modelId).toBe("");
  });

  test("saveSettings enables AI", async () => {
    await Effect.runPromise(app.load());
    expect(app.isAIEnabled()).toBe(false);

    const state = await Effect.runPromise(
      app.saveSettings({
        values: {
          "ai.enabled": true,
          "ai.provider": "anthropic",
          "ai.modelId": "claude-3",
          "ai.maxTokens": 1000,
          "ai.timeoutMs": 30000,
          "ai.temperature": 0.5,
        },
      })
    );

    // AI should now be enabled
    expect(app.isAIEnabled()).toBe(true);
    expect(state.settings.values["ai.enabled"]).toBe(true);
    expect(state.settings.values["ai.provider"]).toBe("anthropic");
  });

  test("full capture workflow: capture -> suggest -> accept", async () => {
    await Effect.runPromise(app.load());

    // Step 1: Capture entry
    let state = await Effect.runPromise(
      app.captureEntry({ content: "Draft project proposal" })
    );
    const entryId = state.inbox.entries[0].id;
    expect(state.inbox.entries[0].content).toBe("Draft project proposal");
    expect(state.inbox.entries[0].status).toBe("captured");

    // Step 2: Suggest as task
    state = await Effect.runPromise(
      app.suggestEntryAsTask({ entryId, suggestedTitle: "Prepare project proposal" })
    );
    const suggestedEntry = state.inbox.entries.find(e => e.id === entryId);
    expect(suggestedEntry?.status).toBe("suggested");
    expect(suggestedEntry?.suggestedTaskTitle).toBe("Prepare project proposal");

    // Step 3: Accept as task
    state = await Effect.runPromise(
      app.acceptEntryAsTask({ entryId, title: "Prepare project proposal" })
    );
    
    // Entry should be accepted and task created
    const allEntries = await Effect.runPromise(platform.listEntities("entry"));
    const acceptedEntry = allEntries.find((e: { id: string }) => e.id === entryId);
    expect(acceptedEntry?.status).toBe("accepted_as_task");
    expect(state.tasks.tasks).toHaveLength(1);
    expect(state.tasks.tasks[0].title).toBe("Prepare project proposal");
  });

  test("captureEntry creates entry and updates state", async () => {
    await Effect.runPromise(app.load());

    const state = await Effect.runPromise(
      app.captureEntry({ content: "Test capture entry" })
    );

    expect(state.inbox.entries).toHaveLength(1);
    expect(state.inbox.entries[0].content).toBe("Test capture entry");
    expect(state.inbox.entries[0].status).toBe("captured");
  });

  test("task lifecycle: create -> complete", async () => {
    await Effect.runPromise(app.load());

    // Create task
    let state = await Effect.runPromise(
      app.createTask({ title: "Complete me", description: "Test task" })
    );
    const taskId = state.tasks.tasks[0].id;
    expect(state.tasks.tasks[0].status).toBe("planned");

    // Complete task
    state = await Effect.runPromise(app.completeTask({ taskId }));
    expect(state.tasks.tasks[0].status).toBe("completed");
  });

  test("project lifecycle: create -> update -> set lifecycle", async () => {
    await Effect.runPromise(app.load());

    // Create project
    let state = await Effect.runPromise(
      app.createProject({ name: "Test Project", description: "A test project" })
    );
    const projectId = state.projects.projects[0].project.id;
    expect(state.projects.projects[0].project.lifecycle).toBe("active");

    // Update project
    state = await Effect.runPromise(
      app.updateProject({ projectId, name: "Updated Project" })
    );
    expect(state.projects.projects[0].project.name).toBe("Updated Project");

    // Set lifecycle to paused
    state = await Effect.runPromise(
      app.setProjectLifecycle({ projectId, lifecycle: "paused" })
    );
    expect(state.projects.projects[0].project.lifecycle).toBe("paused");

    // Set lifecycle to completed
    state = await Effect.runPromise(
      app.setProjectLifecycle({ projectId, lifecycle: "completed" })
    );
    expect(state.projects.projects[0].project.lifecycle).toBe("completed");
  });

  test("note with entity linking", async () => {
    await Effect.runPromise(app.load());

    // Create a project first
    let state = await Effect.runPromise(
      app.createProject({ name: "Project for Note" })
    );
    const projectId = state.projects.projects[0].project.id;

    // Create note with link
    state = await Effect.runPromise(
      app.createNote({ body: "Note about project", linkedEntityRefs: [`project:${projectId}`] })
    );
    const noteId = state.notes.notes[0].id;
    expect(state.notes.notes[0].linkedEntityRefs).toContain(`project:${projectId}`);

    // Add another link
    state = await Effect.runPromise(
      app.linkNoteEntity({ noteId, entityRef: "task:some-task" })
    );
    expect(state.notes.notes[0].linkedEntityRefs).toContain("task:some-task");

    // Remove link
    state = await Effect.runPromise(
      app.unlinkNoteEntity({ noteId, entityRef: `project:${projectId}` })
    );
    expect(state.notes.notes[0].linkedEntityRefs).not.toContain(`project:${projectId}`);
  });

  test("search functionality", async () => {
    await Effect.runPromise(app.load());

    // Create searchable entities
    await Effect.runPromise(
      app.createTask({ title: "Searchable task alpha" })
    );
    await Effect.runPromise(
      app.createProject({ name: "Searchable project beta" })
    );

    // Search
    const state = await Effect.runPromise(
      app.search({ query: "alpha", entityTypes: ["task"], limit: 1 })
    );
    expect(state.search.query).toBe("alpha");
    expect(state.search.results.length).toBeGreaterThan(0);
  });

  test("refresh reloads all data", async () => {
    await Effect.runPromise(app.load());

    // Add some data
    await Effect.runPromise(app.captureEntry({ content: "Entry before refresh" }));

    // Refresh should maintain data
    const state = await Effect.runPromise(app.load());
    expect(state.inbox.entries).toHaveLength(1);
    expect(state.inbox.entries[0].content).toBe("Entry before refresh");
  });

  test("defer and reschedule task", async () => {
    await Effect.runPromise(app.load());

    // Create task
    let state = await Effect.runPromise(
      app.createTask({ title: "Defer me" })
    );
    const taskId = state.tasks.tasks[0].id;

    // Defer task
    const deferUntil = new Date(Date.now() + 86400000); // Tomorrow
    state = await Effect.runPromise(
      app.deferTask({ taskId, until: deferUntil })
    );
    expect(state.tasks.tasks[0].status).toBe("deferred");

    // Reschedule task
    const rescheduleTo = new Date(Date.now() + 172800000); // Day after tomorrow
    state = await Effect.runPromise(
      app.rescheduleTask({ taskId, nextAt: rescheduleTo })
    );
    expect(state.tasks.tasks[0].status).toBe("planned");
  });

  test("event creation and sync approval", async () => {
    await Effect.runPromise(app.load());

    // Create event
    let state = await Effect.runPromise(
      app.createEvent({
        title: "Team meeting",
        startAt: new Date("2026-03-01T10:00:00Z"),
        endAt: new Date("2026-03-01T11:00:00Z"),
      })
    );
    const eventId = state.events.events[0].id;
    expect(state.events.events[0].syncState).toBe("local_only");

    // Request sync
    state = await Effect.runPromise(app.requestEventSync({ eventId }));
    expect(state.events.events[0].syncState).toBe("pending_approval");

    // Approve sync
    state = await Effect.runPromise(
      app.approveOutboundAction({
        actionType: "event_sync",
        entityType: "event",
        entityId: eventId,
        approved: true,
      })
    );
    expect(state.events.events[0].syncState).toBe("synced");
  });

  test("signal ingestion and conversion", async () => {
    await Effect.runPromise(app.load());

    // Ingest signal
    let state = await Effect.runPromise(
      app.ingestSignal({ source: "email", payload: "Action required: review PR" })
    );
    const signalId = state.signals.signals[0].id;
    expect(state.signals.signals[0].triageState).toBe("untriaged");

    // Triage signal
    state = await Effect.runPromise(
      app.triageSignal({ signalId, decision: "actionable" })
    );
    expect(state.signals.signals[0].triageState).toBe("triaged");

    // Convert to task
    state = await Effect.runPromise(
      app.convertSignal({ signalId, targetType: "task" })
    );
    expect(state.signals.signals[0].triageState).toBe("converted");
  });

  test("notification acknowledgment and dismissal", async () => {
    await Effect.runPromise(app.load());

    // Load notifications (some may be auto-generated)
    let state = await Effect.runPromise(app.loadNotifications({ status: "pending" }));
    
    if (state.notifications.notifications.length > 0) {
      const notificationId = state.notifications.notifications[0].id;

      // Acknowledge
      state = await Effect.runPromise(
        app.acknowledgeNotification({ notificationId })
      );
      const notification = state.notifications.notifications.find(n => n.id === notificationId);
      expect(notification?.status).toBe("sent");

      // Dismiss
      state = await Effect.runPromise(
        app.dismissNotification({ notificationId })
      );
      const dismissed = state.notifications.notifications.find(n => n.id === notificationId);
      expect(dismissed?.status).toBe("dismissed");
    }
  });

  test("job creation and inspection", async () => {
    await Effect.runPromise(app.load());

    // Create job
    let state = await Effect.runPromise(
      app.createJob({ jobId: "test-job-1", name: "Test Job" })
    );
    expect(state.jobs.jobs.some(j => j.id === "test-job-1")).toBe(true);

    // Record failed run
    state = await Effect.runPromise(
      app.recordJobRun({
        jobId: "test-job-1",
        outcome: "failed",
        diagnostics: "Connection timeout",
      })
    );

    // Inspect job
    state = await Effect.runPromise(app.inspectJob("test-job-1"));
    expect(state.jobs.inspection?.runState).toBe("failed");

    // Retry job
    state = await Effect.runPromise(
      app.retryJob({ jobId: "test-job-1", fixSummary: "Increase timeout" })
    );
    expect(state.jobs.inspection?.runState).toBe("retrying");
  });
});

describe("E2E: Settings Persistence", () => {
  let platform: CorePlatform;
  let app: InteractiveWorkflowApp;

  beforeEach(async () => {
    platform = await Effect.runPromise(buildCorePlatform());
    app = makeInteractiveWorkflowApp({
      platform,
      actor: TEST_ACTOR,
    });
  });

  afterEach(async () => {
    if (platform.close) {
      await Effect.runPromise(platform.close());
    }
  });

  test("settings persist across reloads", async () => {
    // Load and save settings
    await Effect.runPromise(app.load());
    await Effect.runPromise(
      app.saveSettings({
        values: {
          "ai.enabled": true,
          "ai.provider": "google",
          "custom.setting": "test-value",
        },
      })
    );

    // Reload app
    const state = await Effect.runPromise(app.load());
    expect(state.settings.values["ai.enabled"]).toBe(true);
    expect(state.settings.values["ai.provider"]).toBe("google");
    expect(state.settings.values["custom.setting"]).toBe("test-value");
  });

  test("partial settings update preserves other values", async () => {
    await Effect.runPromise(app.load());

    // Save initial settings
    await Effect.runPromise(
      app.saveSettings({
        values: {
          "ai.enabled": true,
          "ai.provider": "openai",
          "ai.modelId": "gpt-4",
        },
      })
    );

    // Update only modelId
    const state = await Effect.runPromise(
      app.saveSettings({
        values: {
          "ai.modelId": "gpt-3.5",
        },
      })
    );

    // Other settings should be preserved
    expect(state.settings.values["ai.enabled"]).toBe(true);
    expect(state.settings.values["ai.provider"]).toBe("openai");
    expect(state.settings.values["ai.modelId"]).toBe("gpt-3.5");
  });
});

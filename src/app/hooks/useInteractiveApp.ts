import { useState, useCallback, useEffect, useRef } from "react";
import { Effect } from "effect";

import {
  type InteractiveWorkflowApp,
  type InteractiveWorkflowAppState,
  type InteractiveWorkflowAppError,
} from "../interactive-workflow-app";

interface UseInteractiveAppReturn {
  // State
  state: InteractiveWorkflowAppState;
  loading: boolean;
  error: string | null;

  // Core actions
  refresh: () => Promise<void>;
  clearError: () => void;

  // Inbox actions
  captureEntry: (content: string) => Promise<void>;
  captureWithAISuggestion: (content: string) => Promise<void>;
  acceptEntryAsTask: (entryId: string, title?: string) => Promise<void>;
  editEntrySuggestion: (entryId: string, suggestedTitle: string) => Promise<void>;
  rejectEntrySuggestion: (entryId: string, reason?: string) => Promise<void>;
  suggestEntryAsTask: (entryId: string, suggestedTitle: string) => Promise<void>;

  // Signal actions
  ingestSignal: (source: string, payload: string) => Promise<void>;
  triageSignal: (signalId: string, decision: string) => Promise<void>;
  convertSignal: (
    signalId: string,
    targetType: "task" | "event" | "note" | "project" | "outbound_draft",
  ) => Promise<void>;

  // Task actions
  createTask: (input: {
    title: string;
    description?: string;
    scheduledFor?: Date;
    dueAt?: Date;
    projectId?: string;
  }) => Promise<void>;
  updateTask: (taskId: string, updates: { title?: string; description?: string | null; scheduledFor?: Date | null; dueAt?: Date | null; projectId?: string | null }) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  deferTask: (taskId: string, until: Date) => Promise<void>;
  rescheduleTask: (taskId: string, nextAt: Date) => Promise<void>;
  loadTasks: (filters?: { status?: "planned" | "completed" | "deferred"; projectId?: string }) => Promise<void>;

  // Event actions
  createEvent: (input: { title: string; startAt: Date; endAt?: Date }) => Promise<void>;
  updateEvent: (eventId: string, updates: { title?: string; startAt?: Date; endAt?: Date | null }) => Promise<void>;
  loadEvents: (filters?: { syncState?: "local_only" | "pending_approval" | "synced"; from?: Date; to?: Date }) => Promise<void>;
  requestEventSync: (eventId: string) => Promise<void>;
  approveOutboundAction: (
    actionType: "event_sync" | "outbound_draft",
    entityType: string,
    entityId: string,
    approved: boolean,
  ) => Promise<void>;

  // Project actions
  createProject: (input: { name: string; description?: string }) => Promise<void>;
  updateProject: (projectId: string, updates: { name?: string; description?: string }) => Promise<void>;
  setProjectLifecycle: (projectId: string, lifecycle: "active" | "paused" | "completed") => Promise<void>;
  loadProjects: (filters?: { lifecycle?: "active" | "paused" | "completed" }) => Promise<void>;

  // Note actions
  createNote: (body: string, linkedEntityRefs?: string[]) => Promise<void>;
  updateNote: (noteId: string, body: string) => Promise<void>;
  linkNoteEntity: (noteId: string, entityRef: string) => Promise<void>;
  unlinkNoteEntity: (noteId: string, entityRef: string) => Promise<void>;
  loadNotes: (filters?: { linkedEntityRef?: string }) => Promise<void>;

  // Notification actions
  acknowledgeNotification: (notificationId: string) => Promise<void>;
  dismissNotification: (notificationId: string) => Promise<void>;
  loadNotifications: (filters?: { status?: "pending" | "sent" | "dismissed"; type?: string }) => Promise<void>;
  clearAllNotifications: () => Promise<void>;

  // Search actions
  search: (query: string, options?: { entityTypes?: string[]; limit?: number }) => Promise<void>;
  clearSearch: () => void;

  // Settings actions
  saveSettings: (input: { values: Record<string, unknown>; source?: string; confidence?: number }) => Promise<void>;
  loadSettings: (keys?: string[]) => Promise<void>;

  // Job actions
  createJob: (input: { jobId: string; name: string }) => Promise<void>;
  inspectJob: (jobId: string) => Promise<void>;
  retryJob: (jobId: string, fixSummary?: string) => Promise<void>;
  recordJobRun: (input: { jobId: string; outcome: "succeeded" | "failed"; diagnostics?: string }) => Promise<void>;

  // Activity actions
  inspectCheckpoint: (checkpointId: string) => Promise<void>;
  keepCheckpoint: (checkpointId: string) => Promise<void>;
  recoverCheckpoint: (checkpointId: string) => Promise<void>;
  loadActivity: (filters?: { entityType?: string; entityId?: string; from?: Date; to?: Date }) => Promise<void>;

  // AI info
  isAIEnabled: () => boolean;
  getAIConfig: () => { enabled: boolean; provider: string; modelId: string; maxTokens: number; timeoutMs: number; temperature: number };
}

export function useInteractiveApp(app: InteractiveWorkflowApp): UseInteractiveAppReturn {
  const [state, setState] = useState<InteractiveWorkflowAppState>(() => app.getState());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const isFirstLoadRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Helper to handle Effect operations
  const runEffect = useCallback(
    async <A, E extends InteractiveWorkflowAppError>(
      effect: Effect.Effect<A, E>,
      onSuccess?: (result: A) => void,
    ): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const result = await Effect.runPromise(effect);
        if (isMountedRef.current) {
          setState(app.getState());
          onSuccess?.(result);
        }
      } catch (err) {
        if (isMountedRef.current) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          setError(errorMessage);
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [app],
  );

  // Load initial state - only once on mount
  useEffect(() => {
    if (!isFirstLoadRef.current) {
      return;
    }
    isFirstLoadRef.current = false;

    // Use a timeout to ensure the component is fully mounted
    const timeoutId = setTimeout(() => {
      runEffect(app.load()).catch(() => {
        // Error is already handled in runEffect
      });
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []); // Empty deps - only run once on mount

  // Core actions
  const refresh = useCallback(async (): Promise<void> => {
    await runEffect(app.load());
  }, [app, runEffect]);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  // Inbox actions
  const captureEntry = useCallback(
    async (content: string): Promise<void> => {
      await runEffect(app.captureEntry({ content }));
    },
    [app, runEffect],
  );

  const captureWithAISuggestion = useCallback(
    async (content: string): Promise<void> => {
      await runEffect(app.captureWithAISuggestion({ content }));
    },
    [app, runEffect],
  );

  const acceptEntryAsTask = useCallback(
    async (entryId: string, title?: string): Promise<void> => {
      await runEffect(app.acceptEntryAsTask({ entryId, title }));
    },
    [app, runEffect],
  );

  const editEntrySuggestion = useCallback(
    async (entryId: string, suggestedTitle: string): Promise<void> => {
      await runEffect(app.editEntrySuggestion({ entryId, suggestedTitle }));
    },
    [app, runEffect],
  );

  const rejectEntrySuggestion = useCallback(
    async (entryId: string, reason?: string): Promise<void> => {
      await runEffect(app.rejectEntrySuggestion({ entryId, reason }));
    },
    [app, runEffect],
  );

  const suggestEntryAsTask = useCallback(
    async (entryId: string, suggestedTitle: string): Promise<void> => {
      await runEffect(app.suggestEntryAsTask({ entryId, suggestedTitle }));
    },
    [app, runEffect],
  );

  // Signal actions
  const ingestSignal = useCallback(
    async (source: string, payload: string): Promise<void> => {
      await runEffect(app.ingestSignal({ source, payload }));
    },
    [app, runEffect],
  );

  const triageSignal = useCallback(
    async (signalId: string, decision: string): Promise<void> => {
      await runEffect(app.triageSignal({ signalId, decision }));
    },
    [app, runEffect],
  );

  const convertSignal = useCallback(
    async (
      signalId: string,
      targetType: "task" | "event" | "note" | "project" | "outbound_draft",
    ): Promise<void> => {
      await runEffect(app.convertSignal({ signalId, targetType }));
    },
    [app, runEffect],
  );

  // Task actions
  const createTask = useCallback(
    async (input: {
      title: string;
      description?: string;
      scheduledFor?: Date;
      dueAt?: Date;
      projectId?: string;
    }): Promise<void> => {
      await runEffect(app.createTask(input));
    },
    [app, runEffect],
  );

  const updateTask = useCallback(
    async (
      taskId: string,
      updates: { title?: string; description?: string | null; scheduledFor?: Date | null; dueAt?: Date | null; projectId?: string | null },
    ): Promise<void> => {
      await runEffect(app.updateTask({ taskId, ...updates }));
    },
    [app, runEffect],
  );

  const completeTask = useCallback(
    async (taskId: string): Promise<void> => {
      await runEffect(app.completeTask({ taskId }));
    },
    [app, runEffect],
  );

  const deferTask = useCallback(
    async (taskId: string, until: Date): Promise<void> => {
      await runEffect(app.deferTask({ taskId, until }));
    },
    [app, runEffect],
  );

  const rescheduleTask = useCallback(
    async (taskId: string, nextAt: Date): Promise<void> => {
      await runEffect(app.rescheduleTask({ taskId, nextAt }));
    },
    [app, runEffect],
  );

  const loadTasks = useCallback(
    async (filters?: { status?: "planned" | "completed" | "deferred"; projectId?: string }): Promise<void> => {
      await runEffect(app.loadTasks(filters));
    },
    [app, runEffect],
  );

  // Event actions
  const createEvent = useCallback(
    async (input: { title: string; startAt: Date; endAt?: Date }): Promise<void> => {
      await runEffect(app.createEvent(input));
    },
    [app, runEffect],
  );

  const updateEvent = useCallback(
    async (eventId: string, updates: { title?: string; startAt?: Date; endAt?: Date | null }): Promise<void> => {
      await runEffect(app.updateEvent({ eventId, ...updates }));
    },
    [app, runEffect],
  );

  const loadEvents = useCallback(
    async (filters?: { syncState?: "local_only" | "pending_approval" | "synced"; from?: Date; to?: Date }): Promise<void> => {
      await runEffect(app.loadEvents(filters));
    },
    [app, runEffect],
  );

  const requestEventSync = useCallback(
    async (eventId: string): Promise<void> => {
      await runEffect(app.requestEventSync({ eventId }));
    },
    [app, runEffect],
  );

  const approveOutboundAction = useCallback(
    async (
      actionType: "event_sync" | "outbound_draft",
      entityType: string,
      entityId: string,
      approved: boolean,
    ): Promise<void> => {
      await runEffect(app.approveOutboundAction({ actionType, entityType, entityId, approved }));
    },
    [app, runEffect],
  );

  // Project actions
  const createProject = useCallback(
    async (input: { name: string; description?: string }): Promise<void> => {
      await runEffect(app.createProject(input));
    },
    [app, runEffect],
  );

  const updateProject = useCallback(
    async (projectId: string, updates: { name?: string; description?: string }): Promise<void> => {
      await runEffect(app.updateProject({ projectId, ...updates }));
    },
    [app, runEffect],
  );

  const setProjectLifecycle = useCallback(
    async (projectId: string, lifecycle: "active" | "paused" | "completed"): Promise<void> => {
      await runEffect(app.setProjectLifecycle({ projectId, lifecycle }));
    },
    [app, runEffect],
  );

  const loadProjects = useCallback(
    async (filters?: { lifecycle?: "active" | "paused" | "completed" }): Promise<void> => {
      await runEffect(app.loadProjects(filters));
    },
    [app, runEffect],
  );

  // Note actions
  const createNote = useCallback(
    async (body: string, linkedEntityRefs?: string[]): Promise<void> => {
      await runEffect(app.createNote({ body, linkedEntityRefs }));
    },
    [app, runEffect],
  );

  const updateNote = useCallback(
    async (noteId: string, body: string): Promise<void> => {
      await runEffect(app.updateNote({ noteId, body }));
    },
    [app, runEffect],
  );

  const linkNoteEntity = useCallback(
    async (noteId: string, entityRef: string): Promise<void> => {
      await runEffect(app.linkNoteEntity({ noteId, entityRef }));
    },
    [app, runEffect],
  );

  const unlinkNoteEntity = useCallback(
    async (noteId: string, entityRef: string): Promise<void> => {
      await runEffect(app.unlinkNoteEntity({ noteId, entityRef }));
    },
    [app, runEffect],
  );

  const loadNotes = useCallback(
    async (filters?: { linkedEntityRef?: string }): Promise<void> => {
      await runEffect(app.loadNotes(filters));
    },
    [app, runEffect],
  );

  // Notification actions
  const acknowledgeNotification = useCallback(
    async (notificationId: string): Promise<void> => {
      await runEffect(app.acknowledgeNotification({ notificationId }));
    },
    [app, runEffect],
  );

  const dismissNotification = useCallback(
    async (notificationId: string): Promise<void> => {
      await runEffect(app.dismissNotification({ notificationId }));
    },
    [app, runEffect],
  );

  const loadNotifications = useCallback(
    async (filters?: { status?: "pending" | "sent" | "dismissed"; type?: string }): Promise<void> => {
      await runEffect(app.loadNotifications(filters));
    },
    [app, runEffect],
  );

  const clearAllNotifications = useCallback(async (): Promise<void> => {
    // Dismiss all non-dismissed notifications
    const pendingNotifications = state.notifications.notifications.filter(
      (n) => n.status !== "dismissed",
    );
    for (const notification of pendingNotifications) {
      await runEffect(app.dismissNotification({ notificationId: notification.id }));
    }
  }, [app, runEffect, state.notifications.notifications]);

  // Search actions
  const search = useCallback(
    async (query: string, options?: { entityTypes?: string[]; limit?: number }): Promise<void> => {
      await runEffect(app.search({ query, ...options }));
    },
    [app, runEffect],
  );

  const clearSearch = useCallback((): void => {
    setState((prev) => ({
      ...prev,
      search: { ...prev.search, query: "", results: [] },
    }));
  }, []);

  // Settings actions
  const saveSettings = useCallback(
    async (input: { values: Record<string, unknown>; source?: string; confidence?: number }): Promise<void> => {
      // Cast to the expected type - the SettingsValue union is compatible with unknown values
      await runEffect(app.saveSettings(input as Parameters<typeof app.saveSettings>[0]));
    },
    [app, runEffect],
  );

  const loadSettings = useCallback(
    async (keys?: string[]): Promise<void> => {
      await runEffect(app.loadSettings(keys));
    },
    [app, runEffect],
  );

  // Job actions
  const createJob = useCallback(
    async (input: { jobId: string; name: string }): Promise<void> => {
      await runEffect(app.createJob(input));
    },
    [app, runEffect],
  );

  const inspectJob = useCallback(
    async (jobId: string): Promise<void> => {
      await runEffect(app.inspectJob(jobId));
    },
    [app, runEffect],
  );

  const retryJob = useCallback(
    async (jobId: string, fixSummary?: string): Promise<void> => {
      await runEffect(app.retryJob({ jobId, fixSummary }));
    },
    [app, runEffect],
  );

  const recordJobRun = useCallback(
    async (input: { jobId: string; outcome: "succeeded" | "failed"; diagnostics?: string }): Promise<void> => {
      await runEffect(app.recordJobRun(input));
    },
    [app, runEffect],
  );

  // Activity actions
  const inspectCheckpoint = useCallback(
    async (checkpointId: string): Promise<void> => {
      await runEffect(app.inspectCheckpoint(checkpointId));
    },
    [app, runEffect],
  );

  const keepCheckpoint = useCallback(
    async (checkpointId: string): Promise<void> => {
      await runEffect(app.keepCheckpoint({ checkpointId }));
    },
    [app, runEffect],
  );

  const recoverCheckpoint = useCallback(
    async (checkpointId: string): Promise<void> => {
      await runEffect(app.recoverCheckpoint({ checkpointId }));
    },
    [app, runEffect],
  );

  const loadActivity = useCallback(
    async (filters?: { entityType?: string; entityId?: string; from?: Date; to?: Date }): Promise<void> => {
      // The app.load() refreshes all surfaces, including activity
      await runEffect(app.load());
    },
    [app, runEffect],
  );

  // AI info
  const isAIEnabled = useCallback((): boolean => {
    return app.isAIEnabled();
  }, [app]);

  const getAIConfig = useCallback(() => {
    return app.getAIConfig();
  }, [app]);

  return {
    // State
    state,
    loading,
    error,

    // Core actions
    refresh,
    clearError,

    // Inbox actions
    captureEntry,
    captureWithAISuggestion,
    acceptEntryAsTask,
    editEntrySuggestion,
    rejectEntrySuggestion,
    suggestEntryAsTask,

    // Signal actions
    ingestSignal,
    triageSignal,
    convertSignal,

    // Task actions
    createTask,
    updateTask,
    completeTask,
    deferTask,
    rescheduleTask,
    loadTasks,

    // Event actions
    createEvent,
    updateEvent,
    loadEvents,
    requestEventSync,
    approveOutboundAction,

    // Project actions
    createProject,
    updateProject,
    setProjectLifecycle,
    loadProjects,

    // Note actions
    createNote,
    updateNote,
    linkNoteEntity,
    unlinkNoteEntity,
    loadNotes,

    // Notification actions
    acknowledgeNotification,
    dismissNotification,
    loadNotifications,
    clearAllNotifications,

    // Search actions
    search,
    clearSearch,

    // Settings actions
    saveSettings,
    loadSettings,

    // Job actions
    createJob,
    inspectJob,
    retryJob,
    recordJobRun,

    // Activity actions
    inspectCheckpoint,
    keepCheckpoint,
    recoverCheckpoint,
    loadActivity,

    // AI info
    isAIEnabled,
    getAIConfig,
  };
}

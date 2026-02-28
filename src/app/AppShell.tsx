import React, { useState, useCallback } from "react";

import { type InteractiveWorkflowApp } from "./interactive-workflow-app";
import { useInteractiveApp } from "./hooks/useInteractiveApp";
import { type ShellViewKey, SHELL_VIEWS } from "./shell-navigation";

// Import all view components
import { InboxView } from "../ui/views/InboxView";
import { PlanView } from "../ui/views/PlanView";
import { TasksView } from "../ui/views/TasksView";
import { EventsView } from "../ui/views/EventsView";
import { ProjectsView } from "../ui/views/ProjectsView";
import { NotesView } from "../ui/views/NotesView";
import { SignalsView } from "../ui/views/SignalsView";
import { JobsView } from "../ui/views/JobsView";
import { NotificationsView } from "../ui/views/NotificationsView";
import { SearchView } from "../ui/views/SearchView";
import { SettingsView } from "../ui/views/SettingsView";
import { ActivityView } from "../ui/views/ActivityView";
import { CaptureInput } from "../ui/components/CaptureInput";

interface AppShellProps {
  app: InteractiveWorkflowApp;
}

interface NavItemProps {
  viewKey: ShellViewKey;
  label: string;
  isActive: boolean;
  badge?: number;
  onClick: () => void;
}

const NavItem = ({ viewKey, label, isActive, badge, onClick }: NavItemProps): React.JSX.Element => (
  <button
    type="button"
    className={`nav-item ${isActive ? "nav-item-active" : ""}`}
    onClick={onClick}
    aria-current={isActive ? "page" : undefined}
    data-view={viewKey}
  >
    <span className="nav-label">{label}</span>
    {badge !== undefined && badge > 0 && <span className="nav-badge">{badge}</span>}
  </button>
);

export function AppShell({ app }: AppShellProps): React.JSX.Element {
  const [currentView, setCurrentView] = useState<ShellViewKey>("inbox");
  const {
    state,
    loading,
    error,
    clearError,
    refresh,

    // Inbox
    captureEntry,
    captureWithAISuggestion,
    acceptEntryAsTask,
    editEntrySuggestion,
    rejectEntrySuggestion,
    suggestEntryAsTask,

    // Signals
    ingestSignal,
    triageSignal,
    convertSignal,

    // Tasks
    createTask,
    updateTask,
    completeTask,
    deferTask,
    rescheduleTask,
    loadTasks,

    // Events
    createEvent,
    updateEvent,
    loadEvents,
    requestEventSync,
    approveOutboundAction,

    // Projects
    createProject,
    updateProject,
    setProjectLifecycle,
    loadProjects,

    // Notes
    createNote,
    updateNote,
    linkNoteEntity,
    unlinkNoteEntity,
    loadNotes,

    // Notifications
    acknowledgeNotification,
    dismissNotification,
    loadNotifications,
    clearAllNotifications,

    // Search
    search,
    clearSearch,

    // Settings
    saveSettings,
    loadSettings,

    // Jobs
    createJob,
    inspectJob,
    retryJob,

    // Activity
    inspectCheckpoint,
    keepCheckpoint,
    recoverCheckpoint,

    // AI
    isAIEnabled,
  } = useInteractiveApp(app);

  // Navigation handler
  const handleNavigate = useCallback((view: ShellViewKey) => {
    setCurrentView(view);
  }, []);

  // Handle capture from header
  const handleCapture = useCallback(
    async (content: string) => {
      if (isAIEnabled()) {
        await captureWithAISuggestion(content);
      } else {
        await captureEntry(content);
      }
    },
    [captureEntry, captureWithAISuggestion, isAIEnabled],
  );

  // Calculate badge counts
  const inboxCount = state.inbox.entries.length + state.inbox.suggestions.length;
  const pendingNotificationsCount = state.notifications.notifications.filter(
    (n) => n.status === "pending",
  ).length;

  // Render current view
  const renderView = (): React.JSX.Element => {
    switch (currentView) {
      case "inbox":
        return (
          <InboxView
            entries={state.inbox.entries}
            signals={state.inbox.signals}
            suggestions={state.inbox.suggestions}
            onCaptureEntry={handleCapture}
            onAcceptSuggestion={acceptEntryAsTask}
            onEditSuggestion={editEntrySuggestion}
            onRejectSuggestion={rejectEntrySuggestion}
            onGenerateSuggestion={(entryId) => suggestEntryAsTask(entryId, "")}
            aiEnabled={isAIEnabled()}
          />
        );

      case "plan":
        return (
          <PlanView
            timeline={state.plan.timeline}
            tasks={state.plan.tasks}
            events={state.plan.events}
            onTaskComplete={completeTask}
            onTaskDefer={deferTask}
            onTaskReschedule={rescheduleTask}
            onEventApprove={(eventId) => approveOutboundAction("event_sync", "event", eventId, true)}
            filters={state.plan.filters}
            onFilterChange={(filters) => {
              // Plan surface filters would be updated here
              void refresh();
            }}
          />
        );

      case "tasks":
        return (
          <TasksView
            tasks={state.tasks.tasks}
            onCreateTask={createTask}
            onUpdateTask={(taskId, updates) => updateTask(taskId, updates as { title?: string; description?: string | null; scheduledFor?: Date | null; dueAt?: Date | null; projectId?: string | null })}
            onCompleteTask={completeTask}
            onDeferTask={deferTask}
            onRescheduleTask={rescheduleTask}
            filters={state.tasks.filters}
            onFilterChange={loadTasks}
            projects={state.projects.projects.map((p) => ({ id: p.project.id, name: p.project.name }))}
          />
        );

      case "events":
        return (
          <EventsView
            events={state.events.events}
            pendingApprovalCount={state.events.pendingApprovalCount}
            onCreateEvent={createEvent}
            onUpdateEvent={(eventId, updates) => updateEvent(eventId, updates as { title?: string; startAt?: Date; endAt?: Date | null })}
            onRequestSync={requestEventSync}
            onApproveEvent={(eventId, approved) =>
              approveOutboundAction("event_sync", "event", eventId, approved)
            }
            filters={state.events.filters}
            onFilterChange={loadEvents}
          />
        );

      case "projects":
        return (
          <ProjectsView
            projects={state.projects.projects}
            onCreateProject={createProject}
            onUpdateProject={updateProject}
            onSetLifecycle={setProjectLifecycle}
            filters={state.projects.filters}
            onFilterChange={loadProjects}
          />
        );

      case "notes":
        return (
          <NotesView
            notes={state.notes.notes}
            onCreateNote={createNote}
            onUpdateNote={updateNote}
            onLinkEntity={linkNoteEntity}
            onUnlinkEntity={unlinkNoteEntity}
            filters={state.notes.filters}
          />
        );

      case "signals":
        return (
          <SignalsView
            signals={state.signals.signals}
            onIngestSignal={ingestSignal}
            onTriageSignal={triageSignal}
            onConvertSignal={convertSignal}
            onRejectSignal={(signalId) => triageSignal(signalId, "rejected")}
            filters={state.signals.filters}
            onFilterChange={(filters) => {
              // Signals surface filters would be updated here
              void refresh();
            }}
          />
        );

      case "jobs":
        return (
          <JobsView
            jobs={state.jobs.jobs}
            selectedJobId={state.jobs.inspection?.jobId}
            inspection={state.jobs.inspection}
            history={state.jobs.history}
            onCreateJob={createJob}
            onInspectJob={inspectJob}
            onRetryJob={retryJob}
            filters={state.jobs.filters}
            onFilterChange={(filters) => {
              // Jobs surface filters would be updated here
              void refresh();
            }}
          />
        );

      case "notifications":
        return (
          <NotificationsView
            notifications={state.notifications.notifications}
            onAcknowledge={acknowledgeNotification}
            onDismiss={dismissNotification}
            onClearAll={clearAllNotifications}
          />
        );

      case "search":
        return (
          <SearchView
            query={state.search.query}
            results={state.search.results}
            scannedEntityTypes={state.search.scannedEntityTypes}
            onSearch={search}
            onSelectResult={(entityType, entityId) => {
              // Navigate to appropriate view based on entity type
              switch (entityType) {
                case "task":
                  setCurrentView("tasks");
                  break;
                case "project":
                  setCurrentView("projects");
                  break;
                case "note":
                  setCurrentView("notes");
                  break;
                case "event":
                  setCurrentView("events");
                  break;
                case "entry":
                  setCurrentView("inbox");
                  break;
                case "signal":
                  setCurrentView("signals");
                  break;
                case "job":
                  setCurrentView("jobs");
                  break;
                default:
                  break;
              }
            }}
            onClearSearch={clearSearch}
          />
        );

      case "settings":
        return (
          <SettingsView
            settings={state.settings.values}
            onSaveSettings={(values) => saveSettings({ values })}
            aiEnabled={isAIEnabled()}
          />
        );

      case "activity":
        return (
          <ActivityView
            feed={state.activity.feed}
            filters={state.activity.filters}
            onFilterChange={(filters) => {
              // Activity surface filters would be updated here
              void refresh();
            }}
            selectedCheckpoint={state.activity.selectedCheckpoint}
            onInspectCheckpoint={inspectCheckpoint}
            onKeepCheckpoint={keepCheckpoint}
            onRecoverCheckpoint={recoverCheckpoint}
          />
        );

      default:
        return <div className="empty-state">View not found</div>;
    }
  };

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <h1 className="app-title">Origin</h1>
        </div>

        {/* Global Capture Input */}
        <div className="sidebar-capture">
          <CaptureInput
            onCapture={handleCapture}
            aiEnabled={isAIEnabled()}
            placeholder="Quick capture..."
            disabled={loading}
          />
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav" aria-label="Main navigation">
          {SHELL_VIEWS.map((view) => (
            <NavItem
              key={view.key}
              viewKey={view.key}
              label={view.label}
              isActive={currentView === view.key}
              badge={
                view.key === "inbox"
                  ? inboxCount
                  : view.key === "notifications"
                    ? pendingNotificationsCount
                    : undefined
              }
              onClick={() => handleNavigate(view.key)}
            />
          ))}
        </nav>

        {/* Footer info */}
        <div className="sidebar-footer">
          {error && (
            <div className="error-banner">
              <p className="error-message">{error}</p>
              <button type="button" className="btn-link" onClick={clearError}>
                Dismiss
              </button>
              <button type="button" className="btn-link" onClick={refresh}>
                Retry
              </button>
            </div>
          )}
          {loading && <div className="loading-indicator">Loading...</div>}
          {state.lastUpdatedAt && (
            <div className="last-updated">
              Updated: {new Date(state.lastUpdatedAt).toLocaleTimeString()}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="app-main" role="main">
        {renderView()}
      </main>
    </div>
  );
}

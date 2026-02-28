import * as React from "react";
import type { Event } from "../../core/domain/event";
import type { Task } from "../../core/domain/task";
import type { PlanTimelineItem } from "../workflows/plan-surface";

interface PlanViewProps {
  timeline: ReadonlyArray<PlanTimelineItem>;
  tasks: ReadonlyArray<Task>;
  events: ReadonlyArray<Event>;
  onTaskComplete: (taskId: string) => void;
  onTaskDefer: (taskId: string, until: Date) => void;
  onTaskReschedule: (taskId: string, nextAt: Date) => void;
  onEventApprove: (eventId: string) => void;
  filters?: { from?: Date; to?: Date };
  onFilterChange?: (filters: { from?: Date; to?: Date }) => void;
}

const formatDateTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleString();
};

const getTaskStatusClass = (status: Task["status"]): string => {
  switch (status) {
    case "completed":
      return "status-completed";
    case "deferred":
      return "status-deferred";
    default:
      return "status-planned";
  }
};

const getEventSyncStateClass = (syncState: Event["syncState"]): string => {
  switch (syncState) {
    case "synced":
      return "sync-synced";
    case "pending_approval":
      return "sync-pending";
    default:
      return "sync-local";
  }
};

export function PlanView({
  timeline,
  tasks,
  events,
  onTaskComplete,
  onTaskDefer,
  onTaskReschedule,
  onEventApprove,
  filters,
  onFilterChange,
}: PlanViewProps): React.ReactElement {
  const handleFromChange = (value: string) => {
    if (!onFilterChange) return;
    onFilterChange({
      ...filters,
      from: value ? new Date(value) : undefined,
    });
  };

  const handleToChange = (value: string) => {
    if (!onFilterChange) return;
    onFilterChange({
      ...filters,
      to: value ? new Date(value) : undefined,
    });
  };

  const handleDefer = (taskId: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    onTaskDefer(taskId, tomorrow);
  };

  const handleReschedule = (taskId: string) => {
    const now = new Date();
    onTaskReschedule(taskId, now);
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <h2>Plan</h2>
        <div className="view-stats">
          <span>{tasks.length} tasks</span>
          <span>{events.length} events</span>
        </div>
      </div>

      {onFilterChange && (
        <div className="filter-bar">
          <label>
            From:
            <input
              type="date"
              className="form-input"
              value={filters?.from?.toISOString().split("T")[0] ?? ""}
              onChange={(e) => handleFromChange(e.target.value)}
            />
          </label>
          <label>
            To:
            <input
              type="date"
              className="form-input"
              value={filters?.to?.toISOString().split("T")[0] ?? ""}
              onChange={(e) => handleToChange(e.target.value)}
            />
          </label>
        </div>
      )}

      <div className="list-container">
        {timeline.length === 0 ? (
          <div className="empty-state">No items in timeline</div>
        ) : (
          timeline.map((item) => (
            <div
              key={`${item.kind}-${item.id}`}
              className={`list-item timeline-item timeline-item-${item.kind}`}
            >
              {item.kind === "task" && item.task && (
                <div className={`task-content ${getTaskStatusClass(item.task.status)}`}>
                  <div className="item-type">Task</div>
                  <div className="item-title">{item.task.title}</div>
                  {item.task.description && (
                    <div className="item-description">{item.task.description}</div>
                  )}
                  <div className="item-meta">
                    <span className={`status-badge ${getTaskStatusClass(item.task.status)}`}>
                      {item.task.status}
                    </span>
                    {item.task.scheduledFor && (
                      <span className="date-badge">
                        Scheduled: {formatDateTime(item.task.scheduledFor)}
                      </span>
                    )}
                    {item.task.dueAt && (
                      <span className="date-badge">Due: {formatDateTime(item.task.dueAt)}</span>
                    )}
                    {item.task.deferredUntil && (
                      <span className="date-badge deferred">
                        Deferred until: {formatDateTime(item.task.deferredUntil)}
                      </span>
                    )}
                  </div>
                  {item.task.status === "planned" && (
                    <div className="item-actions">
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => onTaskComplete(item.task!.id)}
                      >
                        Complete
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => handleDefer(item.task!.id)}
                      >
                        Defer
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => handleReschedule(item.task!.id)}
                      >
                        Reschedule
                      </button>
                    </div>
                  )}
                </div>
              )}

              {item.kind === "event" && item.event && (
                <div className={`event-content ${getEventSyncStateClass(item.event.syncState)}`}>
                  <div className="item-type">Event</div>
                  <div className="item-title">{item.event.title}</div>
                  <div className="item-meta">
                    <span className={`sync-badge ${getEventSyncStateClass(item.event.syncState)}`}>
                      {item.event.syncState}
                    </span>
                    <span className="date-badge">
                      Start: {formatDateTime(item.event.startAt)}
                    </span>
                    {item.event.endAt && (
                      <span className="date-badge">End: {formatDateTime(item.event.endAt)}</span>
                    )}
                  </div>
                  {item.event.syncState === "pending_approval" && (
                    <div className="item-actions">
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => onEventApprove(item.event!.id)}
                      >
                        Approve
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

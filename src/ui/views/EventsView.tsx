import { useState } from "react";

import * as React from "react";
import type { Event } from "../../core/domain/event";

type EventSyncState = Event["syncState"];

interface EventsViewProps {
  events: ReadonlyArray<Event>;
  pendingApprovalCount: number;
  onCreateEvent: (input: { title: string; startAt: Date; endAt?: Date }) => void;
  onUpdateEvent: (eventId: string, updates: Partial<Event>) => void;
  onRequestSync: (eventId: string) => void;
  onApproveEvent: (eventId: string, approved: boolean) => void;
  filters?: { syncState?: EventSyncState; from?: Date; to?: Date };
  onFilterChange?: (filters: { syncState?: EventSyncState; from?: Date; to?: Date }) => void;
}

const formatDateTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleString();
};

const formatDateForInput = (date: Date | undefined): string => {
  if (!date) return "";
  return date.toISOString().slice(0, 16);
};

const getSyncStateClass = (syncState: EventSyncState): string => {
  switch (syncState) {
    case "synced":
      return "sync-synced";
    case "pending_approval":
      return "sync-pending";
    default:
      return "sync-local";
  }
};

const getSyncStateLabel = (syncState: EventSyncState): string => {
  switch (syncState) {
    case "synced":
      return "Synced";
    case "pending_approval":
      return "Pending Approval";
    default:
      return "Local Only";
  }
};

export function EventsView({
  events,
  pendingApprovalCount,
  onCreateEvent,
  onUpdateEvent,
  onRequestSync,
  onApproveEvent,
  filters,
  onFilterChange,
}: EventsViewProps): React.ReactElement {
  const [isCreating, setIsCreating] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    title: "",
    startAt: "",
    endAt: "",
  });
  const [editForm, setEditForm] = useState<Partial<Event>>({});

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim() || !createForm.startAt) return;

    onCreateEvent({
      title: createForm.title,
      startAt: new Date(createForm.startAt),
      endAt: createForm.endAt ? new Date(createForm.endAt) : undefined,
    });

    setCreateForm({ title: "", startAt: "", endAt: "" });
    setIsCreating(false);
  };

  const handleEditStart = (event: Event) => {
    setEditingEventId(event.id);
    setEditForm({ ...event });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEventId) return;

    onUpdateEvent(editingEventId, editForm);
    setEditingEventId(null);
    setEditForm({});
  };

  const handleFilterSyncStateChange = (syncState: string) => {
    if (!onFilterChange) return;
    onFilterChange({
      ...filters,
      syncState: syncState ? (syncState as EventSyncState) : undefined,
    });
  };

  const handleFilterFromChange = (value: string) => {
    if (!onFilterChange) return;
    onFilterChange({
      ...filters,
      from: value ? new Date(value) : undefined,
    });
  };

  const handleFilterToChange = (value: string) => {
    if (!onFilterChange) return;
    onFilterChange({
      ...filters,
      to: value ? new Date(value) : undefined,
    });
  };

  const pendingEvents = events.filter((e) => e.syncState === "pending_approval");
  const otherEvents = events.filter((e) => e.syncState !== "pending_approval");

  const hasConflicts = (event: Event): boolean => {
    return "conflicts" in event && Array.isArray((event as unknown as Record<string, unknown>).conflicts);
  };

  const renderEventItem = (event: Event) => {
    if (editingEventId === event.id) {
      return (
        <form key={event.id} className="list-item edit-form" onSubmit={handleEditSubmit}>
          <input
            type="text"
            className="form-input"
            value={editForm.title ?? ""}
            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            placeholder="Event title"
          />
          <input
            type="datetime-local"
            className="form-input"
            value={formatDateForInput(editForm.startAt ? new Date(editForm.startAt) : undefined)}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                startAt: e.target.value ? new Date(e.target.value).toISOString() : undefined,
              })
            }
          />
          <input
            type="datetime-local"
            className="form-input"
            value={formatDateForInput(editForm.endAt ? new Date(editForm.endAt) : undefined)}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                endAt: e.target.value ? new Date(e.target.value).toISOString() : undefined,
              })
            }
          />
          <div className="form-actions">
            <button type="submit" className="btn-primary">
              Save
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditingEventId(null)}>
              Cancel
            </button>
          </div>
        </form>
      );
    }

    return (
      <div key={event.id} className={`list-item ${getSyncStateClass(event.syncState)}`}>
        <div className="item-title">{event.title}</div>
        <div className="item-meta">
          <span className={`sync-badge ${getSyncStateClass(event.syncState)}`}>
            {getSyncStateLabel(event.syncState)}
          </span>
          <span className="date-badge">Start: {formatDateTime(event.startAt)}</span>
          {event.endAt && <span className="date-badge">End: {formatDateTime(event.endAt)}</span>}
          {hasConflicts(event) && (
            <span className="conflict-badge">Conflict detected</span>
          )}
        </div>
        <div className="item-actions">
          {event.syncState === "local_only" && (
            <button type="button" className="btn-primary" onClick={() => onRequestSync(event.id)}>
              Request Sync
            </button>
          )}
          {event.syncState === "pending_approval" && (
            <>
              <button
                type="button"
                className="btn-primary"
                onClick={() => onApproveEvent(event.id, true)}
              >
                Approve
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onApproveEvent(event.id, false)}
              >
                Reject
              </button>
            </>
          )}
          <button type="button" className="btn-secondary" onClick={() => handleEditStart(event)}>
            Edit
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <h2>Events</h2>
        <div className="view-stats">
          <span>{events.length} events</span>
          {pendingApprovalCount > 0 && (
            <span className="pending-count">{pendingApprovalCount} pending approval</span>
          )}
        </div>
        <button type="button" className="btn-primary" onClick={() => setIsCreating(!isCreating)}>
          {isCreating ? "Cancel" : "New Event"}
        </button>
      </div>

      {onFilterChange && (
        <div className="filter-bar">
          <select
            className="form-select"
            value={filters?.syncState ?? ""}
            onChange={(e) => handleFilterSyncStateChange(e.target.value)}
          >
            <option value="">All sync states</option>
            <option value="local_only">Local Only</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="synced">Synced</option>
          </select>
          <label>
            From:
            <input
              type="date"
              className="form-input"
              value={filters?.from ? formatDateForInput(filters.from).split("T")[0] : ""}
              onChange={(e) => handleFilterFromChange(e.target.value)}
            />
          </label>
          <label>
            To:
            <input
              type="date"
              className="form-input"
              value={filters?.to ? formatDateForInput(filters.to).split("T")[0] : ""}
              onChange={(e) => handleFilterToChange(e.target.value)}
            />
          </label>
        </div>
      )}

      {isCreating && (
        <form className="create-form" onSubmit={handleCreateSubmit}>
          <input
            type="text"
            className="form-input"
            value={createForm.title}
            onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
            placeholder="Event title"
            required
          />
          <input
            type="datetime-local"
            className="form-input"
            value={createForm.startAt}
            onChange={(e) => setCreateForm({ ...createForm, startAt: e.target.value })}
            placeholder="Start at"
            required
          />
          <input
            type="datetime-local"
            className="form-input"
            value={createForm.endAt}
            onChange={(e) => setCreateForm({ ...createForm, endAt: e.target.value })}
            placeholder="End at (optional)"
          />
          <div className="form-actions">
            <button type="submit" className="btn-primary">
              Create Event
            </button>
          </div>
        </form>
      )}

      <div className="list-container">
        {pendingEvents.length > 0 && !filters?.syncState && (
          <div className="pending-section">
            <h3>Pending Approval ({pendingEvents.length})</h3>
            {pendingEvents.map(renderEventItem)}
          </div>
        )}

        {otherEvents.length > 0 && (
          <div className="events-section">
            {pendingEvents.length > 0 && !filters?.syncState && <h3>All Events</h3>}
            {otherEvents.map(renderEventItem)}
          </div>
        )}

        {events.length === 0 && <div className="empty-state">No events</div>}
      </div>
    </div>
  );
}

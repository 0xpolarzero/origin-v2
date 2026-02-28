import * as React from "react";
const { useState, useCallback } = React;
import type { Checkpoint } from "../../core/domain/checkpoint";
import type { ActivityFeedItem } from "../../core/services/activity-service";

interface ActivityViewProps {
  feed: ReadonlyArray<ActivityFeedItem>;
  filters?: { entityType?: string; entityId?: string; from?: Date; to?: Date };
  onFilterChange?: (filters: { entityType?: string; entityId?: string; from?: Date; to?: Date }) => void;
  selectedCheckpoint?: Checkpoint;
  onInspectCheckpoint?: (checkpointId: string) => void;
  onKeepCheckpoint?: (checkpointId: string) => void;
  onRecoverCheckpoint?: (checkpointId: string) => void;
}

interface CheckpointViewModel {
  id: string;
  name: string;
  rollbackTarget: string;
  auditCursor: number;
  snapshotEntityRefs: ReadonlyArray<{ entityType: string; entityId: string }>;
  kept: boolean;
  recovered: boolean;
  createdAt: string;
  updatedAt: string;
}

const formatDateTime = (isoString: string | undefined): string => {
  if (!isoString) return "N/A";
  const date = new Date(isoString);
  return date.toLocaleString();
};

const getActivityIcon = (fromState: string, toState: string): string => {
  if (toState === "completed") return "✓";
  if (toState === "failed") return "✗";
  if (fromState === "created" || toState === "created") return "+";
  if (toState === "deferred") return "⏸";
  if (toState === "retrying") return "↻";
  return "•";
};

const getActivityClass = (actorKind: string): string => {
  switch (actorKind) {
    case "ai":
      return "activity-ai";
    case "system":
      return "activity-system";
    default:
      return "activity-user";
  }
};

const isCheckpointActivity = (item: ActivityFeedItem): boolean => {
  return item.entityType === "checkpoint" || 
    !!(item.metadata && typeof item.metadata === "object" && "checkpointId" in item.metadata);
};

const getCheckpointIdFromActivity = (item: ActivityFeedItem): string | undefined => {
  if (item.entityType === "checkpoint") {
    return item.entityId;
  }
  return item.metadata?.checkpointId;
};

export function ActivityView({
  feed,
  filters,
  onFilterChange,
  selectedCheckpoint,
  onInspectCheckpoint,
  onKeepCheckpoint,
  onRecoverCheckpoint,
}: ActivityViewProps): React.ReactElement {
  const [showCheckpointDetail, setShowCheckpointDetail] = useState(false);

  const handleEntityTypeChange = useCallback((value: string) => {
    if (!onFilterChange) return;
    onFilterChange({
      ...filters,
      entityType: value || undefined,
    });
  }, [filters, onFilterChange]);

  const handleEntityIdChange = useCallback((value: string) => {
    if (!onFilterChange) return;
    onFilterChange({
      ...filters,
      entityId: value || undefined,
    });
  }, [filters, onFilterChange]);

  const handleFromChange = useCallback((value: string) => {
    if (!onFilterChange) return;
    onFilterChange({
      ...filters,
      from: value ? new Date(value) : undefined,
    });
  }, [filters, onFilterChange]);

  const handleToChange = useCallback((value: string) => {
    if (!onFilterChange) return;
    onFilterChange({
      ...filters,
      to: value ? new Date(value) : undefined,
    });
  }, [filters, onFilterChange]);

  const handleInspectCheckpoint = useCallback((checkpointId: string) => {
    if (onInspectCheckpoint) {
      onInspectCheckpoint(checkpointId);
      setShowCheckpointDetail(true);
    }
  }, [onInspectCheckpoint]);

  const handleCloseCheckpointDetail = useCallback(() => {
    setShowCheckpointDetail(false);
  }, []);

  const handleKeepCheckpoint = useCallback(() => {
    if (selectedCheckpoint && onKeepCheckpoint) {
      onKeepCheckpoint(selectedCheckpoint.id);
    }
  }, [selectedCheckpoint, onKeepCheckpoint]);

  const handleRecoverCheckpoint = useCallback(() => {
    if (selectedCheckpoint && onRecoverCheckpoint) {
      onRecoverCheckpoint(selectedCheckpoint.id);
    }
  }, [selectedCheckpoint, onRecoverCheckpoint]);

  const getCheckpointStatus = (checkpoint: Checkpoint): string => {
    if (checkpoint.status === "kept") return "Kept";
    if (checkpoint.status === "recovered") return "Recovered";
    return "Active";
  };

  const getCheckpointStatusClass = (checkpoint: Checkpoint): string => {
    if (checkpoint.status === "kept") return "status-kept";
    if (checkpoint.status === "recovered") return "status-recovered";
    return "status-active";
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <h2>Activity</h2>
        <div className="view-stats">
          <span>{feed.length} activities</span>
        </div>
      </div>

      {onFilterChange && (
        <div className="filter-bar">
          <div className="filter-group">
            <label className="form-label" htmlFor="filter-entity-type">
              Entity Type
            </label>
            <input
              id="filter-entity-type"
              type="text"
              className="form-input"
              value={filters?.entityType ?? ""}
              onChange={(e) => handleEntityTypeChange(e.target.value)}
              placeholder="e.g., task, event, job"
            />
          </div>
          <div className="filter-group">
            <label className="form-label" htmlFor="filter-entity-id">
              Entity ID
            </label>
            <input
              id="filter-entity-id"
              type="text"
              className="form-input"
              value={filters?.entityId ?? ""}
              onChange={(e) => handleEntityIdChange(e.target.value)}
              placeholder="Entity ID"
            />
          </div>
          <div className="filter-group">
            <label className="form-label" htmlFor="filter-from">
              From
            </label>
            <input
              id="filter-from"
              type="date"
              className="form-input"
              value={filters?.from?.toISOString().split("T")[0] ?? ""}
              onChange={(e) => handleFromChange(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label className="form-label" htmlFor="filter-to">
              To
            </label>
            <input
              id="filter-to"
              type="date"
              className="form-input"
              value={filters?.to?.toISOString().split("T")[0] ?? ""}
              onChange={(e) => handleToChange(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="activity-content">
        <div className={`timeline-container ${showCheckpointDetail && selectedCheckpoint ? "with-detail" : ""}`}>
          <h3>Activity Feed</h3>
          <div className="timeline">
            {feed.length === 0 ? (
              <div className="empty-state">No activity found</div>
            ) : (
              feed.map((item) => {
                const checkpointId = getCheckpointIdFromActivity(item);
                const isCheckpoint = isCheckpointActivity(item);

                return (
                  <div
                    key={item.id}
                    className={`timeline-item ${getActivityClass(item.actor.kind)}`}
                  >
                    <div className="timeline-marker">
                      <span className="activity-icon">
                        {getActivityIcon(item.fromState, item.toState)}
                      </span>
                    </div>
                    <div className="timeline-content">
                      <div className="activity-header">
                        <span className={`actor-badge actor-${item.actor.kind}`}>
                          {item.actor.kind}
                        </span>
                        <span className="activity-time">
                          {formatDateTime(item.at)}
                        </span>
                      </div>
                      <div className="activity-body">
                        <span className="entity-type">{item.entityType}</span>
                        <span className="state-transition">
                          {item.fromState} → {item.toState}
                        </span>
                      </div>
                      <div className="activity-reason">{item.reason}</div>
                      {item.metadata && Object.keys(item.metadata).length > 0 && (
                        <div className="activity-metadata">
                          {Object.entries(item.metadata).map(([key, value]) => (
                            <span key={key} className="metadata-tag">
                              {key}: {value}
                            </span>
                          ))}
                        </div>
                      )}
                      {isCheckpoint && checkpointId && onInspectCheckpoint && (
                        <div className="activity-actions">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleInspectCheckpoint(checkpointId)}
                          >
                            Inspect Checkpoint
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {showCheckpointDetail && selectedCheckpoint && (
          <div className="checkpoint-detail-panel">
            <div className="checkpoint-detail-header">
              <h3>Checkpoint Details</h3>
              <button
                type="button"
                className="btn-close"
                onClick={handleCloseCheckpointDetail}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="checkpoint-card">
              <div className="checkpoint-header">
                <h4>{selectedCheckpoint.name}</h4>
                <span className={`status-badge ${getCheckpointStatusClass(selectedCheckpoint)}`}>
                  {getCheckpointStatus(selectedCheckpoint)}
                </span>
              </div>
              <div className="checkpoint-meta">
                <div className="meta-row">
                  <span className="meta-label">ID:</span>
                  <span className="meta-value">{selectedCheckpoint.id}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Audit Cursor:</span>
                  <span className="meta-value">{selectedCheckpoint.auditCursor}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Rollback Target:</span>
                  <span className="meta-value">{selectedCheckpoint.rollbackTarget}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Created:</span>
                  <span className="meta-value">{formatDateTime(selectedCheckpoint.createdAt)}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Updated:</span>
                  <span className="meta-value">{formatDateTime(selectedCheckpoint.updatedAt)}</span>
                </div>
              </div>
              <div className="checkpoint-entities">
                <h5>Snapshotted Entities ({selectedCheckpoint.snapshotEntityRefs.length})</h5>
                <ul className="entity-list">
                  {selectedCheckpoint.snapshotEntityRefs.map((ref) => (
                    <li key={`${ref.entityType}-${ref.entityId}`} className="entity-ref">
                      <span className="entity-type">{ref.entityType}</span>
                      <span className="entity-id">{ref.entityId}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {selectedCheckpoint.status === "created" && (
                <div className="checkpoint-actions">
                  {onKeepCheckpoint && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleKeepCheckpoint}
                    >
                      Keep Changes
                    </button>
                  )}
                  {onRecoverCheckpoint && (
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={handleRecoverCheckpoint}
                    >
                      Recover (Rollback)
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

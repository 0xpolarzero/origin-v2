import * as React from "react";
import { Notification, NotificationStatus } from "../../core/domain/notification";

interface NotificationsViewProps {
  notifications: ReadonlyArray<Notification>;
  onAcknowledge: (notificationId: string) => void;
  onDismiss: (notificationId: string) => void;
  onClearAll: () => void;
  filters?: { status?: Notification["status"]; type?: string };
}

const STATUS_LABELS: Record<NotificationStatus, string> = {
  pending: "Pending",
  sent: "Sent",
  dismissed: "Dismissed",
};

const STATUS_BADGES: Record<NotificationStatus, string> = {
  pending: "badge-pending",
  sent: "badge-completed",
  dismissed: "badge-danger",
};

const TYPE_ICONS: Record<string, string> = {
  task: "📝",
  event: "📅",
  reminder: "⏰",
  sync: "🔄",
  error: "⚠️",
  info: "ℹ️",
  success: "✅",
  default: "📌",
};

const getTypeIcon = (type: string): string => TYPE_ICONS[type] || TYPE_ICONS.default;

const getTypeLabel = (type: string): string => {
  return type.charAt(0).toUpperCase() + type.slice(1);
};

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  onAcknowledge,
  onDismiss,
  onClearAll,
  filters = {},
}) => {
  const [filterStatus, setFilterStatus] = React.useState<NotificationStatus | "">(
    filters.status || ""
  );
  const [filterType, setFilterType] = React.useState<string>(filters.type || "");

  // Apply filters
  const filteredNotifications = notifications.filter((notification) => {
    if (filterStatus && notification.status !== filterStatus) {
      return false;
    }
    if (filterType && notification.type !== filterType) {
      return false;
    }
    return true;
  });

  // Group by type
  const notificationsByType = filteredNotifications.reduce<Record<string, Notification[]>>(
    (acc, notification) => {
      if (!acc[notification.type]) {
        acc[notification.type] = [];
      }
      acc[notification.type].push(notification);
      return acc;
    },
    {}
  );

  const sortedTypes = Object.keys(notificationsByType).sort();

  // Get available filter options
  const availableTypes = Array.from(new Set(notifications.map((n) => n.type))).sort();
  const pendingCount = notifications.filter((n) => n.status === "pending").length;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const handleClearFilters = () => {
    setFilterStatus("");
    setFilterType("");
  };

  return (
    <div className="view-container">
      <header className="view-header">
        <h1>Notifications</h1>
        <div className="header-actions">
          <span className="badge-pending">{notifications.length} total</span>
          {pendingCount > 0 && (
            <span className="badge-pending">{pendingCount} pending</span>
          )}
        </div>
      </header>

      <section className="notifications-controls">
        <div className="filter-controls">
          <select
            className="form-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as NotificationStatus | "")}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="dismissed">Dismissed</option>
          </select>
          <select
            className="form-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All Types</option>
            {availableTypes.map((type) => (
              <option key={type} value={type}>
                {getTypeLabel(type)}
              </option>
            ))}
          </select>
          {(filterStatus || filterType) && (
            <button className="btn-secondary" onClick={handleClearFilters}>
              Clear Filters
            </button>
          )}
        </div>

        {notifications.some((n) => n.status !== "dismissed") && (
          <button className="btn-secondary" onClick={onClearAll}>
            Clear All
          </button>
        )}
      </section>

      <section className="notifications-list-section">
        {filteredNotifications.length === 0 ? (
          <div className="empty-state">
            <p>No notifications found.</p>
            {(filterStatus || filterType) ? (
              <p>Try adjusting your filters.</p>
            ) : (
              <p>You&apos;re all caught up!</p>
            )}
          </div>
        ) : (
          sortedTypes.map((type) => (
            <div key={type} className="notification-group">
              <h3 className="notification-group-header">
                <span className="type-icon">{getTypeIcon(type)}</span>
                {getTypeLabel(type)}
                <span className="group-count">({notificationsByType[type].length})</span>
              </h3>
              <div className="list-container">
                {notificationsByType[type].map((notification) => (
                  <div
                    key={notification.id}
                    className={`list-item notification-card ${notification.status === "dismissed" ? "dismissed" : ""}`}
                  >
                    <div className="notification-header">
                      <span className={STATUS_BADGES[notification.status]}>
                        {STATUS_LABELS[notification.status]}
                      </span>
                      <span className="notification-date">
                        {formatDate(notification.updatedAt)}
                      </span>
                    </div>

                    <div className="notification-content">
                      <p className="notification-message">{notification.message}</p>
                    </div>

                    {notification.relatedEntityType && (
                      <div className="notification-related">
                        <span className="badge-secondary">
                          {notification.relatedEntityType}
                        </span>
                        {notification.relatedEntityId && (
                          <span className="related-id">{notification.relatedEntityId}</span>
                        )}
                      </div>
                    )}

                    <div className="notification-actions">
                      {notification.status === "pending" && (
                        <button
                          className="btn-primary"
                          onClick={() => onAcknowledge(notification.id)}
                        >
                          Acknowledge
                        </button>
                      )}
                      {notification.status !== "dismissed" && (
                        <button
                          className="btn-secondary"
                          onClick={() => onDismiss(notification.id)}
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
};

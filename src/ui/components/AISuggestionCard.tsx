import * as React from "react";

export interface AISuggestionMetadata {
  aiResolution?: "ai" | "manual";
  provider?: string;
  modelId?: string;
  timestamp?: string;
}

export interface AISuggestionCardProps {
  entryId: string;
  content: string; // Original captured content
  suggestedTitle: string;
  metadata?: AISuggestionMetadata;
  onAccept: () => void;
  onEdit: (newTitle: string) => void;
  onReject: (reason?: string) => void;
}

export const AISuggestionCard: React.FC<AISuggestionCardProps> = ({
  content,
  suggestedTitle,
  metadata,
  onAccept,
  onEdit,
  onReject,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(suggestedTitle);
  const [isRejecting, setIsRejecting] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");

  // Reset edit value when suggestedTitle changes
  React.useEffect(() => {
    setEditValue(suggestedTitle);
  }, [suggestedTitle]);

  const isAIGenerated = metadata?.aiResolution === "ai";
  const badgeText = isAIGenerated ? "AI-generated" : "Manual";
  const badgeClass = isAIGenerated ? "badge-ai" : "badge-manual";

  const formatTimestamp = (timestamp?: string): string => {
    if (!timestamp) return "";
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const handleEditSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== suggestedTitle) {
      onEdit(trimmed);
    }
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setEditValue(suggestedTitle);
    setIsEditing(false);
  };

  const handleRejectConfirm = () => {
    onReject(rejectReason.trim() || undefined);
    setIsRejecting(false);
    setRejectReason("");
  };

  const handleRejectCancel = () => {
    setIsRejecting(false);
    setRejectReason("");
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter") {
      action();
    } else if (e.key === "Escape") {
      if (isEditing) {
        handleEditCancel();
      } else if (isRejecting) {
        handleRejectCancel();
      }
    }
  };

  return (
    <div className="ai-suggestion-card" data-testid="ai-suggestion-card">
      <div className="suggestion-header">
        <span className={`suggestion-badge ${badgeClass}`}>{badgeText}</span>
        {metadata?.timestamp && (
          <span className="suggestion-timestamp">
            {formatTimestamp(metadata.timestamp)}
          </span>
        )}
        {metadata?.provider && (
          <span className="suggestion-provider" title={`Model: ${metadata.modelId || "unknown"}`}>
            {metadata.provider}
          </span>
        )}
      </div>

      {isEditing ? (
        <div className="suggestion-edit-mode">
          <input
            type="text"
            className="suggestion-edit-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, handleEditSave)}
            autoFocus
            aria-label="Edit suggested title"
          />
          <div className="suggestion-edit-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={handleEditSave}
              disabled={!editValue.trim()}
            >
              Save
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleEditCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="suggestion-title-container">
          <h4 className="suggested-title">{suggestedTitle}</h4>
        </div>
      )}

      <div className="suggestion-source-section">
        <button
          type="button"
          className="expand-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Hide original content" : "Show original content"}
        >
          <span className="expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span className="expand-text">Original content</span>
        </button>
        {isExpanded && (
          <p className="original-content">
            <em>{content}</em>
          </p>
        )}
      </div>

      {isRejecting ? (
        <div className="suggestion-reject-mode">
          <input
            type="text"
            className="reject-reason-input"
            placeholder="Reason for rejection (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, handleRejectConfirm)}
            autoFocus
            aria-label="Rejection reason"
          />
          <div className="suggestion-reject-actions">
            <button
              type="button"
              className="btn-danger"
              onClick={handleRejectConfirm}
            >
              Confirm Reject
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleRejectCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="suggestion-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={onAccept}
            aria-label="Accept suggestion"
          >
            Accept
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setIsEditing(true)}
            disabled={isEditing}
            aria-label="Edit suggestion"
          >
            Edit
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={() => setIsRejecting(true)}
            disabled={isRejecting}
            aria-label="Reject suggestion"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
};

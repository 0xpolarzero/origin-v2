import * as React from "react";
import { Entry } from "../../core/domain/entry";
import { Signal } from "../../core/domain/signal";

interface InboxViewProps {
  entries: ReadonlyArray<Entry>;
  signals: ReadonlyArray<Signal>;
  suggestions: ReadonlyArray<Entry>;
  onCaptureEntry: (content: string) => void;
  onAcceptSuggestion: (entryId: string, title?: string) => void;
  onEditSuggestion: (entryId: string, newTitle: string) => void;
  onRejectSuggestion: (entryId: string, reason?: string) => void;
  onGenerateSuggestion: (entryId: string) => void;
  aiEnabled: boolean;
}

export const InboxView: React.FC<InboxViewProps> = ({
  entries,
  signals,
  suggestions,
  onCaptureEntry,
  onAcceptSuggestion,
  onEditSuggestion,
  onRejectSuggestion,
  onGenerateSuggestion,
  aiEnabled,
}) => {
  const [captureInput, setCaptureInput] = React.useState("");
  const [editingEntry, setEditingEntry] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [rejectingEntry, setRejectingEntry] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");

  const capturedEntries = entries.filter((entry) => entry.status === "captured");

  const handleCapture = () => {
    if (captureInput.trim()) {
      onCaptureEntry(captureInput.trim());
      setCaptureInput("");
    }
  };

  const handleEditStart = (entry: Entry) => {
    setEditingEntry(entry.id);
    setEditValue(entry.suggestedTaskTitle || entry.content);
  };

  const handleEditSave = (entryId: string) => {
    if (editValue.trim()) {
      onEditSuggestion(entryId, editValue.trim());
    }
    setEditingEntry(null);
    setEditValue("");
  };

  const handleRejectStart = (entryId: string) => {
    setRejectingEntry(entryId);
    setRejectReason("");
  };

  const handleRejectConfirm = (entryId: string) => {
    onRejectSuggestion(entryId, rejectReason.trim() || undefined);
    setRejectingEntry(null);
    setRejectReason("");
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <div className="view-container">
      <header className="view-header">
        <h1>Inbox</h1>
        <span className="badge-pending">{capturedEntries.length + suggestions.length} items</span>
      </header>

      <div className="capture-section">
        <input
          type="text"
          className="form-input"
          placeholder="Quick capture..."
          value={captureInput}
          onChange={(e) => setCaptureInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleCapture();
            }
          }}
        />
        <button className="btn-primary" onClick={handleCapture} disabled={!captureInput.trim()}>
          Capture
        </button>
      </div>

      {suggestions.length > 0 && (
        <section className="suggestions-section">
          <h2>AI Suggestions</h2>
          <div className="list-container">
            {suggestions.map((suggestion) => (
              <div key={suggestion.id} className="list-item suggestion-card">
                <div className="suggestion-header">
                  <span className="badge-pending">Suggested</span>
                  {suggestion.suggestionUpdatedAt && (
                    <span className="suggestion-meta">
                      AI-generated • {formatDate(suggestion.suggestionUpdatedAt)}
                    </span>
                  )}
                </div>

                {editingEntry === suggestion.id ? (
                  <div className="suggestion-edit">
                    <input
                      type="text"
                      className="form-input"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleEditSave(suggestion.id);
                        } else if (e.key === "Escape") {
                          setEditingEntry(null);
                        }
                      }}
                      autoFocus
                    />
                    <div className="suggestion-actions">
                      <button
                        className="btn-secondary"
                        onClick={() => handleEditSave(suggestion.id)}
                      >
                        Save
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => setEditingEntry(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="suggestion-title">
                      {suggestion.suggestedTaskTitle || suggestion.content}
                    </p>
                    <p className="suggestion-source">
                      From: <em>{suggestion.content}</em>
                    </p>
                    <div className="suggestion-actions">
                      <button
                        className="btn-primary"
                        onClick={() => onAcceptSuggestion(suggestion.id, suggestion.suggestedTaskTitle)}
                      >
                        Accept
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => handleEditStart(suggestion)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-danger"
                        onClick={() => handleRejectStart(suggestion.id)}
                      >
                        Reject
                      </button>
                    </div>
                  </>
                )}

                {rejectingEntry === suggestion.id && (
                  <div className="reject-reason">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Reason for rejection (optional)"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleRejectConfirm(suggestion.id);
                        } else if (e.key === "Escape") {
                          setRejectingEntry(null);
                        }
                      }}
                      autoFocus
                    />
                    <div className="suggestion-actions">
                      <button
                        className="btn-danger"
                        onClick={() => handleRejectConfirm(suggestion.id)}
                      >
                        Confirm Reject
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => setRejectingEntry(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {capturedEntries.length > 0 && (
        <section className="captured-section">
          <h2>Captured</h2>
          <div className="list-container">
            {capturedEntries.map((entry) => (
              <div key={entry.id} className="list-item">
                <div className="entry-content">
                  <p>{entry.content}</p>
                  <span className="entry-meta">
                    {formatDate(entry.capturedAt)} • {entry.source}
                  </span>
                </div>
                <div className="entry-actions">
                  {aiEnabled && (
                    <button
                      className="btn-secondary"
                      onClick={() => onGenerateSuggestion(entry.id)}
                    >
                      Generate with AI
                    </button>
                  )}
                  <button
                    className="btn-primary"
                    onClick={() => onAcceptSuggestion(entry.id)}
                  >
                    Convert to Task
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {signals.length > 0 && (
        <section className="signals-section">
          <h2>Untriaged Signals ({signals.length})</h2>
          <div className="list-container">
            {signals.slice(0, 5).map((signal) => (
              <div key={signal.id} className="list-item signal-preview">
                <span className="badge-pending">Signal</span>
                <p className="signal-source">{signal.source}</p>
                <p className="signal-payload">{signal.payload}</p>
              </div>
            ))}
            {signals.length > 5 && (
              <p className="more-signals">+{signals.length - 5} more signals</p>
            )}
          </div>
        </section>
      )}

      {suggestions.length === 0 && capturedEntries.length === 0 && signals.length === 0 && (
        <div className="empty-state">
          <p>Your inbox is empty!</p>
          <p>Use the quick capture above to add new entries.</p>
        </div>
      )}
    </div>
  );
};

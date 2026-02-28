import * as React from "react";
import { Signal, SignalTriageState } from "../../core/domain/signal";

interface SignalsViewProps {
  signals: ReadonlyArray<Signal>;
  onIngestSignal: (source: string, payload: string) => void;
  onTriageSignal: (signalId: string, decision: string) => void;
  onConvertSignal: (signalId: string, targetType: "task" | "event" | "note" | "project") => void;
  onRejectSignal: (signalId: string) => void;
  filters?: { triageState?: Signal["triageState"]; source?: string };
  onFilterChange?: (filters: { triageState?: Signal["triageState"]; source?: string }) => void;
}

const TRIAGE_STATE_LABELS: Record<SignalTriageState, string> = {
  untriaged: "Untriaged",
  triaged: "Triaged",
  converted: "Converted",
  rejected: "Rejected",
};

const TRIAGE_STATE_BADGES: Record<SignalTriageState, string> = {
  untriaged: "badge-pending",
  triaged: "badge-completed",
  converted: "badge-completed",
  rejected: "badge-danger",
};

export const SignalsView: React.FC<SignalsViewProps> = ({
  signals,
  onIngestSignal,
  onTriageSignal,
  onConvertSignal,
  onRejectSignal,
  filters = {},
  onFilterChange,
}) => {
  const [sourceInput, setSourceInput] = React.useState("");
  const [payloadInput, setPayloadInput] = React.useState("");
  const [triageReason, setTriageReason] = React.useState<Record<string, string>>({});
  const [expandedSignal, setExpandedSignal] = React.useState<string | null>(null);

  const handleIngest = () => {
    if (sourceInput.trim() && payloadInput.trim()) {
      onIngestSignal(sourceInput.trim(), payloadInput.trim());
      setSourceInput("");
      setPayloadInput("");
    }
  };

  const handleTriage = (signalId: string) => {
    const reason = triageReason[signalId]?.trim();
    if (reason) {
      onTriageSignal(signalId, reason);
      setTriageReason((prev) => ({ ...prev, [signalId]: "" }));
    }
  };

  const handleFilterChange = (key: keyof typeof filters, value: string | undefined) => {
    onFilterChange?.({
      ...filters,
      [key]: value || undefined,
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  // Group signals by source
  const signalsBySource = signals.reduce<Record<string, Signal[]>>((acc, signal) => {
    if (!acc[signal.source]) {
      acc[signal.source] = [];
    }
    acc[signal.source].push(signal);
    return acc;
  }, {});

  const uniqueSources = Object.keys(signalsBySource).sort();

  // Get available filter options
  const availableSources = Array.from(new Set(signals.map((s) => s.source))).sort();

  return (
    <div className="view-container">
      <header className="view-header">
        <h1>Signals</h1>
        <span className="badge-pending">{signals.length} signals</span>
      </header>

      <section className="ingest-section">
        <h2>Manual Signal Ingestion</h2>
        <div className="ingest-form">
          <input
            type="text"
            className="form-input"
            placeholder="Source (e.g., email, slack, api)"
            value={sourceInput}
            onChange={(e) => setSourceInput(e.target.value)}
          />
          <textarea
            className="form-input"
            placeholder="Payload content..."
            value={payloadInput}
            onChange={(e) => setPayloadInput(e.target.value)}
            rows={3}
          />
          <button
            className="btn-primary"
            onClick={handleIngest}
            disabled={!sourceInput.trim() || !payloadInput.trim()}
          >
            Ingest Signal
          </button>
        </div>
      </section>

      <section className="filters-section">
        <div className="filter-controls">
          <select
            className="form-select"
            value={filters.triageState || ""}
            onChange={(e) => handleFilterChange("triageState", e.target.value || undefined)}
          >
            <option value="">All States</option>
            <option value="untriaged">Untriaged</option>
            <option value="triaged">Triaged</option>
            <option value="converted">Converted</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            className="form-select"
            value={filters.source || ""}
            onChange={(e) => handleFilterChange("source", e.target.value || undefined)}
          >
            <option value="">All Sources</option>
            {availableSources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
          {(filters.triageState || filters.source) && (
            <button
              className="btn-secondary"
              onClick={() => onFilterChange?.({})}
            >
              Clear Filters
            </button>
          )}
        </div>
      </section>

      <section className="signals-list-section">
        {signals.length === 0 ? (
          <div className="empty-state">
            <p>No signals found.</p>
            <p>Use the form above to ingest signals manually.</p>
          </div>
        ) : (
          uniqueSources.map((source) => (
            <div key={source} className="signal-group">
              <h3 className="signal-group-header">{source}</h3>
              <div className="list-container">
                {signalsBySource[source].map((signal) => (
                  <div key={signal.id} className="list-item signal-card">
                    <div className="signal-header">
                      <span className={TRIAGE_STATE_BADGES[signal.triageState]}>
                        {TRIAGE_STATE_LABELS[signal.triageState]}
                      </span>
                      <span className="signal-date">{formatDate(signal.updatedAt)}</span>
                    </div>

                    <div className="signal-content">
                      <p className="signal-payload">{signal.payload}</p>
                    </div>

                    {signal.triageDecision && (
                      <div className="signal-decision">
                        <strong>Decision:</strong> {signal.triageDecision}
                      </div>
                    )}

                    {signal.triageState === "converted" && signal.convertedEntityType && (
                      <div className="signal-converted">
                        <span className="badge-completed">Converted to {signal.convertedEntityType}</span>
                        {signal.convertedEntityId && (
                          <span className="converted-id">ID: {signal.convertedEntityId}</span>
                        )}
                      </div>
                    )}

                    <div className="signal-actions">
                      {signal.triageState === "untriaged" && (
                        <>
                          <div className="triage-row">
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Add triage note/decision..."
                              value={triageReason[signal.id] || ""}
                              onChange={(e) =>
                                setTriageReason((prev) => ({
                                  ...prev,
                                  [signal.id]: e.target.value,
                                }))
                              }
                            />
                            <button
                              className="btn-secondary"
                              onClick={() => handleTriage(signal.id)}
                              disabled={!triageReason[signal.id]?.trim()}
                            >
                              Add Note
                            </button>
                          </div>
                          <div className="convert-actions">
                            <span className="convert-label">Convert to:</span>
                            <button
                              className="btn-primary"
                              onClick={() => onConvertSignal(signal.id, "task")}
                            >
                              Task
                            </button>
                            <button
                              className="btn-primary"
                              onClick={() => onConvertSignal(signal.id, "event")}
                            >
                              Event
                            </button>
                            <button
                              className="btn-primary"
                              onClick={() => onConvertSignal(signal.id, "note")}
                            >
                              Note
                            </button>
                            <button
                              className="btn-primary"
                              onClick={() => onConvertSignal(signal.id, "project")}
                            >
                              Project
                            </button>
                            <button
                              className="btn-danger"
                              onClick={() => onRejectSignal(signal.id)}
                            >
                              Reject
                            </button>
                          </div>
                        </>
                      )}

                      {signal.triageState !== "untriaged" && signal.triageState !== "rejected" && (
                        <button
                          className="btn-secondary"
                          onClick={() => setExpandedSignal(expandedSignal === signal.id ? null : signal.id)}
                        >
                          {expandedSignal === signal.id ? "Hide Details" : "View Details"}
                        </button>
                      )}
                    </div>

                    {expandedSignal === signal.id && (
                      <div className="signal-details">
                        <p>
                          <strong>ID:</strong> {signal.id}
                        </p>
                        <p>
                          <strong>Created:</strong> {formatDate(signal.createdAt)}
                        </p>
                        <p>
                          <strong>Updated:</strong> {formatDate(signal.updatedAt)}
                        </p>
                        {signal.convertedEntityId && (
                          <p>
                            <strong>Converted Entity ID:</strong> {signal.convertedEntityId}
                          </p>
                        )}
                      </div>
                    )}
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

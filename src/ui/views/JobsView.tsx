import * as React from "react";
const { useState, useCallback } = React;
import type { Job } from "../../core/domain/job";
import type { JobListItem, JobRunHistoryRecord, JobRunInspection } from "../../core/services/job-service";

interface JobsViewProps {
  jobs: ReadonlyArray<JobListItem>;
  selectedJobId?: string;
  inspection?: JobRunInspection;
  history: ReadonlyArray<JobRunHistoryRecord>;
  onCreateJob: (input: { jobId: string; name: string }) => void;
  onInspectJob: (jobId: string) => void;
  onRetryJob: (jobId: string, fixSummary?: string) => void;
  onRunJob?: (jobId: string) => void;
  filters?: { runState?: Job["runState"] };
  onFilterChange?: (filters: { runState?: Job["runState"] }) => void;
}

const JOB_STATES: ReadonlyArray<{ value: Job["runState"]; label: string }> = [
  { value: "idle", label: "Idle" },
  { value: "running", label: "Running" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "retrying", label: "Retrying" },
];

const formatDateTime = (isoString: string | undefined): string => {
  if (!isoString) return "N/A";
  const date = new Date(isoString);
  return date.toLocaleString();
};

const formatDuration = (startAt: string, endAt: string): string => {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const durationMs = end - start;
  if (durationMs < 1000) return `${durationMs}ms`;
  if (durationMs < 60000) return `${Math.round(durationMs / 1000)}s`;
  return `${Math.round(durationMs / 60000)}m`;
};

const getJobStateClass = (runState: Job["runState"]): string => {
  switch (runState) {
    case "idle":
      return "job-state-idle";
    case "running":
      return "job-state-running";
    case "succeeded":
      return "job-state-succeeded";
    case "failed":
      return "job-state-failed";
    case "retrying":
      return "job-state-retrying";
    default:
      return "";
  }
};

const getJobStateIcon = (runState: Job["runState"]): string => {
  switch (runState) {
    case "idle":
      return "○";
    case "running":
      return "⟳";
    case "succeeded":
      return "✓";
    case "failed":
      return "✗";
    case "retrying":
      return "↻";
    default:
      return "•";
  }
};

export function JobsView({
  jobs,
  selectedJobId,
  inspection,
  history,
  onCreateJob,
  onInspectJob,
  onRetryJob,
  onRunJob,
  filters,
  onFilterChange,
}: JobsViewProps): React.ReactElement {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newJobId, setNewJobId] = useState("");
  const [newJobName, setNewJobName] = useState("");
  const [showRetryDialog, setShowRetryDialog] = useState(false);
  const [retryFixSummary, setRetryFixSummary] = useState("");
  const [retryJobId, setRetryJobId] = useState<string | null>(null);

  const handleFilterChange = useCallback((runState: Job["runState"] | "") => {
    if (!onFilterChange) return;
    onFilterChange({
      runState: runState || undefined,
    });
  }, [onFilterChange]);

  const handleCreateJob = useCallback(() => {
    if (newJobName.trim()) {
      onCreateJob({
        jobId: newJobId.trim() || crypto.randomUUID(),
        name: newJobName.trim(),
      });
      setShowCreateForm(false);
      setNewJobId("");
      setNewJobName("");
    }
  }, [newJobId, newJobName, onCreateJob]);

  const handleInspectJob = useCallback((jobId: string) => {
    onInspectJob(jobId);
  }, [onInspectJob]);

  const handleRunJob = useCallback((jobId: string) => {
    if (onRunJob) {
      onRunJob(jobId);
    }
  }, [onRunJob]);

  const openRetryDialog = useCallback((jobId: string) => {
    setRetryJobId(jobId);
    setRetryFixSummary("");
    setShowRetryDialog(true);
  }, []);

  const handleRetryConfirm = useCallback(() => {
    if (retryJobId) {
      const fixSummary = retryFixSummary.trim() || undefined;
      onRetryJob(retryJobId, fixSummary);
      setShowRetryDialog(false);
      setRetryJobId(null);
      setRetryFixSummary("");
    }
  }, [retryJobId, retryFixSummary, onRetryJob]);

  const handleRetryCancel = useCallback(() => {
    setShowRetryDialog(false);
    setRetryJobId(null);
    setRetryFixSummary("");
  }, []);

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  return (
    <div className="view-container">
      <div className="view-header">
        <h2>Jobs</h2>
        <div className="view-stats">
          <span>{jobs.length} jobs</span>
          <span className="stat-running">
            {jobs.filter((j) => j.runState === "running").length} running
          </span>
          <span className="stat-failed">
            {jobs.filter((j) => j.runState === "failed").length} failed
          </span>
        </div>
      </div>

      <div className="jobs-toolbar">
        {onFilterChange && (
          <div className="filter-bar">
            <label className="form-label" htmlFor="filter-run-state">
              Filter by State:
            </label>
            <select
              id="filter-run-state"
              className="form-select"
              value={filters?.runState ?? ""}
              onChange={(e) => handleFilterChange(e.target.value as Job["runState"] | "")}
            >
              <option value="">All States</option>
              {JOB_STATES.map((state) => (
                <option key={state.value} value={state.value}>
                  {state.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          type="button"
          className="btn-primary"
          onClick={() => setShowCreateForm(true)}
        >
          Create Job
        </button>
      </div>

      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Create New Job</h3>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowCreateForm(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label" htmlFor="new-job-id">
                  Job ID (optional)
                </label>
                <input
                  id="new-job-id"
                  type="text"
                  className="form-input"
                  value={newJobId}
                  onChange={(e) => setNewJobId(e.target.value)}
                  placeholder="Auto-generated if empty"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="new-job-name">
                  Job Name *
                </label>
                <input
                  id="new-job-name"
                  type="text"
                  className="form-input"
                  value={newJobName}
                  onChange={(e) => setNewJobName(e.target.value)}
                  placeholder="Enter job name"
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleCreateJob}
                disabled={!newJobName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showRetryDialog && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Retry Job with AI</h3>
              <button
                type="button"
                className="btn-close"
                onClick={handleRetryCancel}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="dialog-description">
                The AI will analyze the failure diagnostics and suggest fixes.
                You can optionally provide additional context below.
              </p>
              <div className="form-group">
                <label className="form-label" htmlFor="fix-summary">
                  Fix Summary (optional)
                </label>
                <textarea
                  id="fix-summary"
                  className="form-input"
                  value={retryFixSummary}
                  onChange={(e) => setRetryFixSummary(e.target.value)}
                  placeholder="Describe what might have caused the failure or what fix to try..."
                  rows={4}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleRetryCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleRetryConfirm}
              >
                Retry with AI
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="jobs-content">
        <div className={`jobs-list ${selectedJob ? "with-inspection" : ""}`}>
          <h3>Job List</h3>
          {jobs.length === 0 ? (
            <div className="empty-state">No jobs found</div>
          ) : (
            jobs.map((job) => (
              <div
                key={job.id}
                className={`job-card ${getJobStateClass(job.runState)} ${
                  selectedJobId === job.id ? "selected" : ""
                }`}
                onClick={() => handleInspectJob(job.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleInspectJob(job.id);
                  }
                }}
              >
                <div className="job-header">
                  <span className="job-state-icon">
                    {getJobStateIcon(job.runState)}
                  </span>
                  <span className="job-name">{job.name}</span>
                  <span className={`state-badge ${getJobStateClass(job.runState)}`}>
                    {job.runState}
                  </span>
                </div>
                <div className="job-meta">
                  <span className="job-id">ID: {job.id}</span>
                  <span className="retry-count">Retries: {job.retryCount}</span>
                </div>
                {job.lastRunAt && (
                  <div className="job-last-run">
                    Last run: {formatDateTime(job.lastRunAt)}
                  </div>
                )}
                {job.lastFailureReason && (
                  <div className="job-failure-reason">
                    Failed: {job.lastFailureReason}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {selectedJob && inspection && (
          <div className="job-inspection-panel">
            <div className="inspection-header">
              <h3>Job Inspection</h3>
              <div className="inspection-actions">
                {onRunJob && selectedJob.runState !== "running" && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => handleRunJob(selectedJob.id)}
                  >
                    Run Now
                  </button>
                )}
                {selectedJob.runState === "failed" && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openRetryDialog(selectedJob.id)}
                  >
                    Retry with AI
                  </button>
                )}
              </div>
            </div>

            <div className="inspection-details">
              <h4>{selectedJob.name}</h4>
              <div className="detail-grid">
                <div className="detail-row">
                  <span className="detail-label">ID:</span>
                  <span className="detail-value">{inspection.jobId}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">State:</span>
                  <span className={`detail-value state-badge ${getJobStateClass(inspection.runState)}`}>
                    {inspection.runState}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Retry Count:</span>
                  <span className="detail-value">{inspection.retryCount}</span>
                </div>
                {inspection.lastFailureReason && (
                  <div className="detail-row">
                    <span className="detail-label">Last Failure:</span>
                    <span className="detail-value error">{inspection.lastFailureReason}</span>
                  </div>
                )}
                {inspection.diagnostics && (
                  <div className="detail-row diagnostics">
                    <span className="detail-label">Diagnostics:</span>
                    <pre className="detail-value diagnostics-content">
                      {inspection.diagnostics}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            <div className="job-history">
              <h4>Run History ({history.length} runs)</h4>
              {history.length === 0 ? (
                <div className="empty-state">No run history</div>
              ) : (
                <div className="history-list">
                  {history.map((record) => (
                    <div
                      key={record.id}
                      className={`history-item history-${record.outcome}`}
                    >
                      <div className="history-header">
                        <span className={`outcome-badge outcome-${record.outcome}`}>
                          {record.outcome}
                        </span>
                        <span className="history-time">
                          {formatDateTime(record.at)}
                        </span>
                      </div>
                      <div className="history-meta">
                        <span>Retry #{record.retryCount}</span>
                        <span className="actor-badge actor-{record.actor.kind}">
                          {record.actor.kind}
                        </span>
                      </div>
                      {record.diagnostics && (
                        <div className="history-diagnostics">
                          {record.diagnostics}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

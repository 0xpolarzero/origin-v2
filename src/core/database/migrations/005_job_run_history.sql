CREATE TABLE IF NOT EXISTS job_run_history (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  diagnostics TEXT NOT NULL,
  retry_count INTEGER NOT NULL,
  actor_id TEXT NOT NULL,
  actor_kind TEXT NOT NULL,
  at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_run_history_job_id_at
ON job_run_history (job_id, at);

CREATE INDEX IF NOT EXISTS idx_job_run_history_created_at
ON job_run_history (created_at);

CREATE TRIGGER IF NOT EXISTS job_run_history_job_id_check_insert
BEFORE INSERT ON job_run_history
WHEN NOT EXISTS (
  SELECT 1 FROM job WHERE id = NEW.job_id
)
BEGIN
  SELECT RAISE(ABORT, 'invalid job_run_history.job_id');
END;

CREATE TRIGGER IF NOT EXISTS job_run_history_job_id_check_update
BEFORE UPDATE OF job_id ON job_run_history
WHEN NOT EXISTS (
  SELECT 1 FROM job WHERE id = NEW.job_id
)
BEGIN
  SELECT RAISE(ABORT, 'invalid job_run_history.job_id');
END;

CREATE TRIGGER IF NOT EXISTS job_run_history_outcome_check_insert
BEFORE INSERT ON job_run_history
WHEN NEW.outcome NOT IN ('succeeded', 'failed')
BEGIN
  SELECT RAISE(ABORT, 'invalid job_run_history.outcome');
END;

CREATE TRIGGER IF NOT EXISTS job_run_history_outcome_check_update
BEFORE UPDATE OF outcome ON job_run_history
WHEN NEW.outcome NOT IN ('succeeded', 'failed')
BEGIN
  SELECT RAISE(ABORT, 'invalid job_run_history.outcome');
END;

CREATE TRIGGER IF NOT EXISTS job_run_history_actor_kind_check_insert
BEFORE INSERT ON job_run_history
WHEN NEW.actor_kind NOT IN ('user', 'system', 'ai')
BEGIN
  SELECT RAISE(ABORT, 'invalid job_run_history.actor_kind');
END;

CREATE TRIGGER IF NOT EXISTS job_run_history_actor_kind_check_update
BEFORE UPDATE OF actor_kind ON job_run_history
WHEN NEW.actor_kind NOT IN ('user', 'system', 'ai')
BEGIN
  SELECT RAISE(ABORT, 'invalid job_run_history.actor_kind');
END;

CREATE TRIGGER IF NOT EXISTS job_delete_job_run_history_ref_check
BEFORE DELETE ON job
WHEN EXISTS (
  SELECT 1 FROM job_run_history WHERE job_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'invalid delete job.id referenced by job_run_history.job_id');
END;

INSERT INTO job_run_history (
  id,
  job_id,
  outcome,
  diagnostics,
  retry_count,
  actor_id,
  actor_kind,
  at,
  created_at
)
SELECT
  'job-run-history-backfill-' || transition.id,
  transition.entity_id,
  transition.to_state,
  COALESCE(json_extract(transition.metadata, '$.diagnostics'), transition.reason),
  (
    SELECT COUNT(*)
    FROM audit_transitions AS retry
    WHERE retry.entity_type = 'job'
      AND retry.entity_id = transition.entity_id
      AND retry.to_state = 'retrying'
      AND (
        retry.at < transition.at
        OR (retry.at = transition.at AND retry.id <= transition.id)
      )
  ),
  transition.actor_id,
  transition.actor_kind,
  transition.at,
  transition.at
FROM audit_transitions AS transition
JOIN job ON job.id = transition.entity_id
WHERE transition.entity_type = 'job'
  AND transition.to_state IN ('succeeded', 'failed')
ON CONFLICT(id) DO NOTHING;

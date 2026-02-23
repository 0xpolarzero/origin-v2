CREATE TRIGGER IF NOT EXISTS task_status_check_insert
BEFORE INSERT ON task
WHEN NEW.status NOT IN ('planned', 'completed', 'deferred')
BEGIN
  SELECT RAISE(ABORT, 'invalid task.status');
END;

CREATE TRIGGER IF NOT EXISTS task_status_check_update
BEFORE UPDATE OF status ON task
WHEN NEW.status NOT IN ('planned', 'completed', 'deferred')
BEGIN
  SELECT RAISE(ABORT, 'invalid task.status');
END;

CREATE TRIGGER IF NOT EXISTS event_sync_state_check_insert
BEFORE INSERT ON event
WHEN NEW.sync_state NOT IN ('local_only', 'pending_approval', 'synced')
BEGIN
  SELECT RAISE(ABORT, 'invalid event.sync_state');
END;

CREATE TRIGGER IF NOT EXISTS event_sync_state_check_update
BEFORE UPDATE OF sync_state ON event
WHEN NEW.sync_state NOT IN ('local_only', 'pending_approval', 'synced')
BEGIN
  SELECT RAISE(ABORT, 'invalid event.sync_state');
END;

CREATE TRIGGER IF NOT EXISTS project_lifecycle_check_insert
BEFORE INSERT ON project
WHEN NEW.lifecycle NOT IN ('active', 'paused', 'completed')
BEGIN
  SELECT RAISE(ABORT, 'invalid project.lifecycle');
END;

CREATE TRIGGER IF NOT EXISTS project_lifecycle_check_update
BEFORE UPDATE OF lifecycle ON project
WHEN NEW.lifecycle NOT IN ('active', 'paused', 'completed')
BEGIN
  SELECT RAISE(ABORT, 'invalid project.lifecycle');
END;

CREATE TRIGGER IF NOT EXISTS entry_status_check_insert
BEFORE INSERT ON entry
WHEN NEW.status NOT IN ('captured', 'suggested', 'rejected', 'accepted_as_task')
BEGIN
  SELECT RAISE(ABORT, 'invalid entry.status');
END;

CREATE TRIGGER IF NOT EXISTS entry_status_check_update
BEFORE UPDATE OF status ON entry
WHEN NEW.status NOT IN ('captured', 'suggested', 'rejected', 'accepted_as_task')
BEGIN
  SELECT RAISE(ABORT, 'invalid entry.status');
END;

CREATE TRIGGER IF NOT EXISTS signal_triage_state_check_insert
BEFORE INSERT ON signal
WHEN NEW.triage_state NOT IN ('untriaged', 'triaged', 'converted', 'rejected')
BEGIN
  SELECT RAISE(ABORT, 'invalid signal.triage_state');
END;

CREATE TRIGGER IF NOT EXISTS signal_triage_state_check_update
BEFORE UPDATE OF triage_state ON signal
WHEN NEW.triage_state NOT IN ('untriaged', 'triaged', 'converted', 'rejected')
BEGIN
  SELECT RAISE(ABORT, 'invalid signal.triage_state');
END;

CREATE TRIGGER IF NOT EXISTS job_run_state_check_insert
BEFORE INSERT ON job
WHEN NEW.run_state NOT IN ('idle', 'running', 'succeeded', 'failed', 'retrying')
BEGIN
  SELECT RAISE(ABORT, 'invalid job.run_state');
END;

CREATE TRIGGER IF NOT EXISTS job_run_state_check_update
BEFORE UPDATE OF run_state ON job
WHEN NEW.run_state NOT IN ('idle', 'running', 'succeeded', 'failed', 'retrying')
BEGIN
  SELECT RAISE(ABORT, 'invalid job.run_state');
END;

CREATE TRIGGER IF NOT EXISTS notification_status_check_insert
BEFORE INSERT ON notification
WHEN NEW.status NOT IN ('pending', 'sent', 'dismissed')
BEGIN
  SELECT RAISE(ABORT, 'invalid notification.status');
END;

CREATE TRIGGER IF NOT EXISTS notification_status_check_update
BEFORE UPDATE OF status ON notification
WHEN NEW.status NOT IN ('pending', 'sent', 'dismissed')
BEGIN
  SELECT RAISE(ABORT, 'invalid notification.status');
END;

CREATE TRIGGER IF NOT EXISTS checkpoint_status_check_insert
BEFORE INSERT ON checkpoint
WHEN NEW.status NOT IN ('created', 'kept', 'recovered')
BEGIN
  SELECT RAISE(ABORT, 'invalid checkpoint.status');
END;

CREATE TRIGGER IF NOT EXISTS checkpoint_status_check_update
BEFORE UPDATE OF status ON checkpoint
WHEN NEW.status NOT IN ('created', 'kept', 'recovered')
BEGIN
  SELECT RAISE(ABORT, 'invalid checkpoint.status');
END;

CREATE TRIGGER IF NOT EXISTS outbound_draft_status_check_insert
BEFORE INSERT ON outbound_draft
WHEN NEW.status NOT IN ('draft', 'pending_approval', 'executing', 'executed')
BEGIN
  SELECT RAISE(ABORT, 'invalid outbound_draft.status');
END;

CREATE TRIGGER IF NOT EXISTS outbound_draft_status_check_update
BEFORE UPDATE OF status ON outbound_draft
WHEN NEW.status NOT IN ('draft', 'pending_approval', 'executing', 'executed')
BEGIN
  SELECT RAISE(ABORT, 'invalid outbound_draft.status');
END;

CREATE TRIGGER IF NOT EXISTS memory_confidence_range_check_insert
BEFORE INSERT ON memory
WHEN NEW.confidence < 0 OR NEW.confidence > 1
BEGIN
  SELECT RAISE(ABORT, 'invalid memory.confidence');
END;

CREATE TRIGGER IF NOT EXISTS memory_confidence_range_check_update
BEFORE UPDATE OF confidence ON memory
WHEN NEW.confidence < 0 OR NEW.confidence > 1
BEGIN
  SELECT RAISE(ABORT, 'invalid memory.confidence');
END;

CREATE INDEX IF NOT EXISTS idx_audit_transitions_entity_at
ON audit_transitions (entity_type, entity_id, at);

CREATE INDEX IF NOT EXISTS idx_audit_transitions_entity_id_at
ON audit_transitions (entity_id, at);

CREATE INDEX IF NOT EXISTS idx_task_status
ON task (status, updated_at);

CREATE INDEX IF NOT EXISTS idx_event_sync_state
ON event (sync_state, updated_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_memory_key_index_key
ON memory_key_index (key);

CREATE INDEX IF NOT EXISTS idx_memory_key_index_memory_id
ON memory_key_index (memory_id);

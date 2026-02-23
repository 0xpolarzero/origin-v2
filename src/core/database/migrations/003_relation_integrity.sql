CREATE INDEX IF NOT EXISTS idx_task_project_id
ON task (project_id);

CREATE INDEX IF NOT EXISTS idx_task_source_entry_id
ON task (source_entry_id);

CREATE INDEX IF NOT EXISTS idx_entry_accepted_task_id
ON entry (accepted_task_id);

CREATE INDEX IF NOT EXISTS idx_signal_converted_entity
ON signal (converted_entity_type, converted_entity_id);

CREATE INDEX IF NOT EXISTS idx_notification_related_entity
ON notification (related_entity_type, related_entity_id);

CREATE INDEX IF NOT EXISTS idx_outbound_draft_source_signal_id
ON outbound_draft (source_signal_id);

CREATE INDEX IF NOT EXISTS idx_memory_key_index_memory_id
ON memory_key_index (memory_id);

CREATE INDEX IF NOT EXISTS idx_audit_transitions_entity_ref
ON audit_transitions (entity_type, entity_id);

CREATE TRIGGER IF NOT EXISTS task_project_id_check_insert
BEFORE INSERT ON task
WHEN NEW.project_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM project WHERE id = NEW.project_id
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid task.project_id');
END;

CREATE TRIGGER IF NOT EXISTS task_project_id_check_update
BEFORE UPDATE OF project_id ON task
WHEN NEW.project_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM project WHERE id = NEW.project_id
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid task.project_id');
END;

CREATE TRIGGER IF NOT EXISTS task_source_entry_id_check_insert
BEFORE INSERT ON task
WHEN NEW.source_entry_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM entry WHERE id = NEW.source_entry_id
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid task.source_entry_id');
END;

CREATE TRIGGER IF NOT EXISTS task_source_entry_id_check_update
BEFORE UPDATE OF source_entry_id ON task
WHEN NEW.source_entry_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM entry WHERE id = NEW.source_entry_id
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid task.source_entry_id');
END;

CREATE TRIGGER IF NOT EXISTS entry_accepted_task_id_check_insert
BEFORE INSERT ON entry
WHEN NEW.accepted_task_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM task WHERE id = NEW.accepted_task_id
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid entry.accepted_task_id');
END;

CREATE TRIGGER IF NOT EXISTS entry_accepted_task_id_check_update
BEFORE UPDATE OF accepted_task_id ON entry
WHEN NEW.accepted_task_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM task WHERE id = NEW.accepted_task_id
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid entry.accepted_task_id');
END;

CREATE TRIGGER IF NOT EXISTS outbound_draft_source_signal_id_check_insert
BEFORE INSERT ON outbound_draft
WHEN NOT EXISTS (
  SELECT 1 FROM signal WHERE id = NEW.source_signal_id
)
BEGIN
  SELECT RAISE(ABORT, 'invalid outbound_draft.source_signal_id');
END;

CREATE TRIGGER IF NOT EXISTS outbound_draft_source_signal_id_check_update
BEFORE UPDATE OF source_signal_id ON outbound_draft
WHEN NOT EXISTS (
  SELECT 1 FROM signal WHERE id = NEW.source_signal_id
)
BEGIN
  SELECT RAISE(ABORT, 'invalid outbound_draft.source_signal_id');
END;

CREATE TRIGGER IF NOT EXISTS memory_key_index_memory_id_check_insert
BEFORE INSERT ON memory_key_index
WHEN NOT EXISTS (
  SELECT 1 FROM memory WHERE id = NEW.memory_id
)
BEGIN
  SELECT RAISE(ABORT, 'invalid memory_key_index.memory_id');
END;

CREATE TRIGGER IF NOT EXISTS memory_key_index_memory_id_check_update
BEFORE UPDATE OF memory_id ON memory_key_index
WHEN NOT EXISTS (
  SELECT 1 FROM memory WHERE id = NEW.memory_id
)
BEGIN
  SELECT RAISE(ABORT, 'invalid memory_key_index.memory_id');
END;

CREATE TRIGGER IF NOT EXISTS signal_converted_entity_pair_check_insert
BEFORE INSERT ON signal
WHEN (NEW.converted_entity_type IS NULL AND NEW.converted_entity_id IS NOT NULL)
  OR (NEW.converted_entity_type IS NOT NULL AND NEW.converted_entity_id IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'invalid signal.converted_entity_ref');
END;

CREATE TRIGGER IF NOT EXISTS signal_converted_entity_pair_check_update
BEFORE UPDATE OF converted_entity_type, converted_entity_id ON signal
WHEN (NEW.converted_entity_type IS NULL AND NEW.converted_entity_id IS NOT NULL)
  OR (NEW.converted_entity_type IS NOT NULL AND NEW.converted_entity_id IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'invalid signal.converted_entity_ref');
END;

CREATE TRIGGER IF NOT EXISTS signal_converted_entity_type_check_insert
BEFORE INSERT ON signal
WHEN NEW.converted_entity_type IS NOT NULL
  AND NEW.converted_entity_type NOT IN ('task', 'event', 'note', 'project', 'outbound_draft')
BEGIN
  SELECT RAISE(ABORT, 'invalid signal.converted_entity_type');
END;

CREATE TRIGGER IF NOT EXISTS signal_converted_entity_type_check_update
BEFORE UPDATE OF converted_entity_type ON signal
WHEN NEW.converted_entity_type IS NOT NULL
  AND NEW.converted_entity_type NOT IN ('task', 'event', 'note', 'project', 'outbound_draft')
BEGIN
  SELECT RAISE(ABORT, 'invalid signal.converted_entity_type');
END;

CREATE TRIGGER IF NOT EXISTS signal_converted_entity_target_check_insert
BEFORE INSERT ON signal
WHEN NEW.converted_entity_type IS NOT NULL
  AND NEW.converted_entity_id IS NOT NULL
  AND (
    (NEW.converted_entity_type = 'task' AND NOT EXISTS (
      SELECT 1 FROM task WHERE id = NEW.converted_entity_id
    ))
    OR (NEW.converted_entity_type = 'event' AND NOT EXISTS (
      SELECT 1 FROM event WHERE id = NEW.converted_entity_id
    ))
    OR (NEW.converted_entity_type = 'note' AND NOT EXISTS (
      SELECT 1 FROM note WHERE id = NEW.converted_entity_id
    ))
    OR (NEW.converted_entity_type = 'project' AND NOT EXISTS (
      SELECT 1 FROM project WHERE id = NEW.converted_entity_id
    ))
    OR (NEW.converted_entity_type = 'outbound_draft' AND NOT EXISTS (
      SELECT 1 FROM outbound_draft WHERE id = NEW.converted_entity_id
    ))
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid signal.converted_entity_target');
END;

CREATE TRIGGER IF NOT EXISTS signal_converted_entity_target_check_update
BEFORE UPDATE OF converted_entity_type, converted_entity_id ON signal
WHEN NEW.converted_entity_type IS NOT NULL
  AND NEW.converted_entity_id IS NOT NULL
  AND (
    (NEW.converted_entity_type = 'task' AND NOT EXISTS (
      SELECT 1 FROM task WHERE id = NEW.converted_entity_id
    ))
    OR (NEW.converted_entity_type = 'event' AND NOT EXISTS (
      SELECT 1 FROM event WHERE id = NEW.converted_entity_id
    ))
    OR (NEW.converted_entity_type = 'note' AND NOT EXISTS (
      SELECT 1 FROM note WHERE id = NEW.converted_entity_id
    ))
    OR (NEW.converted_entity_type = 'project' AND NOT EXISTS (
      SELECT 1 FROM project WHERE id = NEW.converted_entity_id
    ))
    OR (NEW.converted_entity_type = 'outbound_draft' AND NOT EXISTS (
      SELECT 1 FROM outbound_draft WHERE id = NEW.converted_entity_id
    ))
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid signal.converted_entity_target');
END;

CREATE TRIGGER IF NOT EXISTS notification_related_entity_pair_check_insert
BEFORE INSERT ON notification
WHEN (NEW.related_entity_type IS NULL AND NEW.related_entity_id IS NOT NULL)
  OR (NEW.related_entity_type IS NOT NULL AND NEW.related_entity_id IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'invalid notification.related_entity_ref');
END;

CREATE TRIGGER IF NOT EXISTS notification_related_entity_pair_check_update
BEFORE UPDATE OF related_entity_type, related_entity_id ON notification
WHEN (NEW.related_entity_type IS NULL AND NEW.related_entity_id IS NOT NULL)
  OR (NEW.related_entity_type IS NOT NULL AND NEW.related_entity_id IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'invalid notification.related_entity_ref');
END;

CREATE TRIGGER IF NOT EXISTS notification_related_entity_type_check_insert
BEFORE INSERT ON notification
WHEN NEW.related_entity_type IS NOT NULL
  AND NEW.related_entity_type NOT IN (
    'entry',
    'task',
    'event',
    'project',
    'note',
    'signal',
    'job',
    'notification',
    'view',
    'memory',
    'checkpoint',
    'outbound_draft'
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid notification.related_entity_type');
END;

CREATE TRIGGER IF NOT EXISTS notification_related_entity_type_check_update
BEFORE UPDATE OF related_entity_type ON notification
WHEN NEW.related_entity_type IS NOT NULL
  AND NEW.related_entity_type NOT IN (
    'entry',
    'task',
    'event',
    'project',
    'note',
    'signal',
    'job',
    'notification',
    'view',
    'memory',
    'checkpoint',
    'outbound_draft'
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid notification.related_entity_type');
END;

CREATE TRIGGER IF NOT EXISTS notification_related_entity_target_check_insert
BEFORE INSERT ON notification
WHEN NEW.related_entity_type IS NOT NULL
  AND NEW.related_entity_id IS NOT NULL
  AND (
    (NEW.related_entity_type = 'entry' AND NOT EXISTS (
      SELECT 1 FROM entry WHERE id = NEW.related_entity_id
    ))
    OR (NEW.related_entity_type = 'task' AND NOT EXISTS (
      SELECT 1 FROM task WHERE id = NEW.related_entity_id
    ))
    OR (NEW.related_entity_type = 'event' AND NOT EXISTS (
      SELECT 1 FROM event WHERE id = NEW.related_entity_id
    ))
    OR (NEW.related_entity_type = 'project' AND NOT EXISTS (
      SELECT 1 FROM project WHERE id = NEW.related_entity_id
    ))
    OR (NEW.related_entity_type = 'note' AND NOT EXISTS (
      SELECT 1 FROM note WHERE id = NEW.related_entity_id
    ))
    OR (NEW.related_entity_type = 'signal' AND NOT EXISTS (
      SELECT 1 FROM signal WHERE id = NEW.related_entity_id
    ))
    OR (NEW.related_entity_type = 'job' AND NOT EXISTS (
      SELECT 1 FROM job WHERE id = NEW.related_entity_id
    ))
    OR (NEW.related_entity_type = 'notification' AND NOT EXISTS (
      SELECT 1 FROM notification WHERE id = NEW.related_entity_id
    ))
    OR (NEW.related_entity_type = 'view' AND NOT EXISTS (
      SELECT 1 FROM "view" WHERE id = NEW.related_entity_id
    ))
    OR (NEW.related_entity_type = 'memory' AND NOT EXISTS (
      SELECT 1 FROM memory WHERE id = NEW.related_entity_id
    ))
    OR (NEW.related_entity_type = 'checkpoint' AND NOT EXISTS (
      SELECT 1 FROM checkpoint WHERE id = NEW.related_entity_id
    ))
    OR (NEW.related_entity_type = 'outbound_draft' AND NOT EXISTS (
      SELECT 1 FROM outbound_draft WHERE id = NEW.related_entity_id
    ))
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid notification.related_entity_target');
END;

CREATE TRIGGER IF NOT EXISTS notification_related_entity_target_check_update
BEFORE UPDATE OF related_entity_type, related_entity_id ON notification
WHEN NEW.related_entity_type IS NOT NULL
  AND NEW.related_entity_id IS NOT NULL
  AND (
    (NEW.related_entity_type = 'entry' AND NOT EXISTS (
      SELECT 1 FROM entry WHERE id = NEW.related_entity_id
    ))
    OR (NEW.related_entity_type = 'task' AND NOT EXISTS (
      SELECT 1 FROM task WHERE id = NEW.related_entity_id
    ))
    OR (NEW.related_entity_type = 'event' AND NOT EXISTS (
      SELECT 1 FROM event WHERE id = NEW.related_entity_id
    ))
    OR (NEW.related_entity_type = 'project' AND NOT EXISTS (
      SELECT 1 FROM project WHERE id = NEW.related_entity_id
    ))
    OR (NEW.related_entity_type = 'note' AND NOT EXISTS (
      SELECT 1 FROM note WHERE id = NEW.related_entity_id
    ))
    OR (NEW.related_entity_type = 'signal' AND NOT EXISTS (
      SELECT 1 FROM signal WHERE id = NEW.related_entity_id
    ))
    OR (NEW.related_entity_type = 'job' AND NOT EXISTS (
      SELECT 1 FROM job WHERE id = NEW.related_entity_id
    ))
    OR (NEW.related_entity_type = 'notification' AND NOT EXISTS (
      SELECT 1 FROM notification WHERE id = NEW.related_entity_id
    ))
    OR (NEW.related_entity_type = 'view' AND NOT EXISTS (
      SELECT 1 FROM "view" WHERE id = NEW.related_entity_id
    ))
    OR (NEW.related_entity_type = 'memory' AND NOT EXISTS (
      SELECT 1 FROM memory WHERE id = NEW.related_entity_id
    ))
    OR (NEW.related_entity_type = 'checkpoint' AND NOT EXISTS (
      SELECT 1 FROM checkpoint WHERE id = NEW.related_entity_id
    ))
    OR (NEW.related_entity_type = 'outbound_draft' AND NOT EXISTS (
      SELECT 1 FROM outbound_draft WHERE id = NEW.related_entity_id
    ))
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid notification.related_entity_target');
END;

CREATE TRIGGER IF NOT EXISTS audit_transitions_entity_type_check_insert
BEFORE INSERT ON audit_transitions
WHEN NEW.entity_type NOT IN (
  'entry',
  'task',
  'event',
  'project',
  'note',
  'signal',
  'job',
  'notification',
  'view',
  'memory',
  'checkpoint',
  'outbound_draft'
)
BEGIN
  SELECT RAISE(ABORT, 'invalid audit_transitions.entity_type');
END;

CREATE TRIGGER IF NOT EXISTS audit_transitions_entity_ref_check_insert
BEFORE INSERT ON audit_transitions
WHEN (
  (NEW.entity_type = 'entry' AND NOT EXISTS (
    SELECT 1 FROM entry WHERE id = NEW.entity_id
  ))
  OR (NEW.entity_type = 'task' AND NOT EXISTS (
    SELECT 1 FROM task WHERE id = NEW.entity_id
  ))
  OR (NEW.entity_type = 'event' AND NOT EXISTS (
    SELECT 1 FROM event WHERE id = NEW.entity_id
  ))
  OR (NEW.entity_type = 'project' AND NOT EXISTS (
    SELECT 1 FROM project WHERE id = NEW.entity_id
  ))
  OR (NEW.entity_type = 'note' AND NOT EXISTS (
    SELECT 1 FROM note WHERE id = NEW.entity_id
  ))
  OR (NEW.entity_type = 'signal' AND NOT EXISTS (
    SELECT 1 FROM signal WHERE id = NEW.entity_id
  ))
  OR (NEW.entity_type = 'job' AND NOT EXISTS (
    SELECT 1 FROM job WHERE id = NEW.entity_id
  ))
  OR (NEW.entity_type = 'notification' AND NOT EXISTS (
    SELECT 1 FROM notification WHERE id = NEW.entity_id
  ))
  OR (NEW.entity_type = 'view' AND NOT EXISTS (
    SELECT 1 FROM "view" WHERE id = NEW.entity_id
  ))
  OR (NEW.entity_type = 'memory' AND NOT EXISTS (
    SELECT 1 FROM memory WHERE id = NEW.entity_id
  ))
  OR (NEW.entity_type = 'checkpoint' AND NOT EXISTS (
    SELECT 1 FROM checkpoint WHERE id = NEW.entity_id
  ))
  OR (NEW.entity_type = 'outbound_draft' AND NOT EXISTS (
    SELECT 1 FROM outbound_draft WHERE id = NEW.entity_id
  ))
)
BEGIN
  SELECT RAISE(ABORT, 'invalid audit_transitions.entity_ref');
END;

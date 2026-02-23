CREATE TABLE IF NOT EXISTS entry (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  suggested_task_title TEXT,
  suggestion_updated_at TEXT,
  rejection_reason TEXT,
  accepted_task_id TEXT
);

CREATE TABLE IF NOT EXISTS task (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  scheduled_for TEXT,
  due_at TEXT,
  project_id TEXT,
  source_entry_id TEXT,
  completed_at TEXT,
  deferred_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS event (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT,
  sync_state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  lifecycle TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS note (
  id TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  linked_entity_refs TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS signal (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  payload TEXT NOT NULL,
  triage_state TEXT NOT NULL,
  triage_decision TEXT,
  converted_entity_type TEXT,
  converted_entity_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  run_state TEXT NOT NULL,
  retry_count INTEGER NOT NULL,
  last_run_at TEXT,
  last_success_at TEXT,
  last_failure_at TEXT,
  last_failure_reason TEXT,
  diagnostics TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "view" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  filters TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memory (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkpoint (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  snapshot_entity_refs TEXT NOT NULL DEFAULT '[]',
  snapshot_entities TEXT NOT NULL DEFAULT '[]',
  audit_cursor INTEGER NOT NULL,
  rollback_target TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  recovered_at TEXT
);

CREATE TABLE IF NOT EXISTS outbound_draft (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  source_signal_id TEXT NOT NULL,
  status TEXT NOT NULL,
  execution_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_transitions (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_kind TEXT NOT NULL,
  reason TEXT NOT NULL,
  at TEXT NOT NULL,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS memory_key_index (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  memory_id TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

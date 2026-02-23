CREATE TABLE IF NOT EXISTS entity_versions (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  latest_version INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_versions_updated_at
ON entity_versions (updated_at);

INSERT INTO entity_versions (
  entity_type,
  entity_id,
  latest_version,
  updated_at
)
SELECT
  entity_type,
  entity_id,
  COUNT(*) AS latest_version,
  MAX(at) AS updated_at
FROM audit_transitions
GROUP BY entity_type, entity_id
ON CONFLICT(entity_type, entity_id) DO UPDATE SET
  latest_version = excluded.latest_version,
  updated_at = excluded.updated_at;

CREATE TRIGGER IF NOT EXISTS audit_transitions_entity_versions_after_insert
AFTER INSERT ON audit_transitions
BEGIN
  INSERT INTO entity_versions (
    entity_type,
    entity_id,
    latest_version,
    updated_at
  )
  VALUES (
    NEW.entity_type,
    NEW.entity_id,
    1,
    NEW.at
  )
  ON CONFLICT(entity_type, entity_id) DO UPDATE SET
    latest_version = entity_versions.latest_version + 1,
    updated_at = CASE
      WHEN NEW.at > entity_versions.updated_at THEN NEW.at
      ELSE entity_versions.updated_at
    END;
END;

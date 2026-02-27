UPDATE checkpoint
SET audit_cursor = CAST(audit_cursor AS INTEGER)
WHERE typeof(audit_cursor) != 'integer';

CREATE TRIGGER IF NOT EXISTS checkpoint_audit_cursor_integer_check_insert
BEFORE INSERT ON checkpoint
WHEN typeof(NEW.audit_cursor) != 'integer'
BEGIN
  SELECT RAISE(ABORT, 'invalid checkpoint.audit_cursor');
END;

CREATE TRIGGER IF NOT EXISTS checkpoint_audit_cursor_integer_check_update
BEFORE UPDATE OF audit_cursor ON checkpoint
WHEN typeof(NEW.audit_cursor) != 'integer'
BEGIN
  SELECT RAISE(ABORT, 'invalid checkpoint.audit_cursor');
END;

-- =============================================================================
-- Migration Rollback: 0008_down.sql
-- =============================================================================

DROP TRIGGER IF EXISTS trigger_audit_logs_no_update;
DROP TRIGGER IF EXISTS trigger_audit_logs_no_delete;

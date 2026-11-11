-- =============================================================================
-- Migration Rollback: 0007_down.sql
-- =============================================================================

DROP TABLE IF EXISTS audit_logs;
DELETE FROM admin_users WHERE id IN ('admin-dhananjay-001', 'admin-root-002');

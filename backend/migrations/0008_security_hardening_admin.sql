-- =============================================================================
-- Migration: 0008_security_hardening_admin.sql
-- Database: motionbydk-db
-- Target: Cloudflare D1 (SQLite)
-- Description: Enforce audit log immutability via triggers, add is_active to admin_users, and separate admin-root credentials
-- =============================================================================

-- 1. Add is_active column to admin_users if not present
ALTER TABLE admin_users ADD COLUMN is_active INTEGER DEFAULT 1;

-- 2. Ensure admin-root-002 has distinct salt and hash (no shared credentials)
UPDATE admin_users 
SET 
    salt = '9156025e81f85e7b9c61bf6b933c9782',
    password_hash = '563c3ed6ecf9ae8a49024be02368ce86d837af9f47fb5a2c1a0e39e70bb2a0da',
    role = 'admin',
    is_active = 1
WHERE id = 'admin-root-002';

-- 3. Enforce Immutable Append-Only Ledger on audit_logs via SQLite Triggers
CREATE TRIGGER IF NOT EXISTS trigger_audit_logs_no_update
BEFORE UPDATE ON audit_logs
BEGIN
    SELECT RAISE(ABORT, 'AUDIT_LOGS_IMMUTABLE: Updates to audit logs are prohibited.');
END;

CREATE TRIGGER IF NOT EXISTS trigger_audit_logs_no_delete
BEFORE DELETE ON audit_logs
BEGIN
    SELECT RAISE(ABORT, 'AUDIT_LOGS_IMMUTABLE: Deletions from audit logs are prohibited.');
END;

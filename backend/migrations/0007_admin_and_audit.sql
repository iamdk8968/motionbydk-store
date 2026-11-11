-- =============================================================================
-- Migration: 0007_admin_and_audit.sql
-- Database: motionbydk-db
-- Target: Cloudflare D1 (SQLite)
-- Description: Create audit_logs table and seed initial admin credentials for Dhananjay
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,                       -- UUID v4
    actor_id TEXT NOT NULL,                    -- Admin username or 'SYSTEM'
    action TEXT NOT NULL,                      -- 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'RESET_DEVICES', 'REVOKE_LICENSE', 'REINSTATE_LICENSE', 'RESEND_EMAIL'
    target_type TEXT,                          -- 'LICENSE', 'ORDER', 'EMAIL', 'CUSTOMER', 'AUTH'
    target_id TEXT,                            -- license_key, order_id, email, etc.
    details TEXT,                              -- JSON string of details or reasons
    ip_address TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);

-- Seed initial admin users if not present
INSERT OR REPLACE INTO admin_users (id, username, password_hash, salt, full_name, role, created_at)
VALUES 
('admin-dhananjay-001', 'dhananjay', '63ddd9abc72a1ee8af97d434165547af9b0260863596927055153edf2d1acba2', 'f00eb6acfc5383fc00dd7edc329ab818', 'Dhananjay K (Merchant)', 'admin', datetime('now')),
('admin-root-002', 'admin', '63ddd9abc72a1ee8af97d434165547af9b0260863596927055153edf2d1acba2', 'f00eb6acfc5383fc00dd7edc329ab818', 'Administrator', 'admin', datetime('now'));

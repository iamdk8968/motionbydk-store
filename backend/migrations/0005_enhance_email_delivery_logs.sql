-- =============================================================================
-- Migration: 0005_enhance_email_delivery_logs.sql
-- Database: motionbydk-db
-- Target: Cloudflare D1 (SQLite)
-- Description: Upgrade email_delivery_logs to support flexible statuses, attempt counts, updated timestamps, and idempotency indexing
-- =============================================================================

-- 1. Create upgraded table with extended event types, statuses, and retry tracking
CREATE TABLE IF NOT EXISTS email_delivery_logs_new (
    id TEXT PRIMARY KEY,                       -- UUID v4
    order_id TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    email_type TEXT NOT NULL,                  -- 'ORDER_RECEIPT', 'LICENSE_ISSUED', 'DOWNLOAD_DELIVERY', 'LICENSE_CLAIMED', 'STARTER_KIT'
    resend_message_id TEXT,                    -- Resend Message ID (e.g. 49a3999c-0ce1-4ea6-ab68-afcd6dc2e794)
    status TEXT NOT NULL DEFAULT 'PENDING',    -- 'SENT', 'ACCEPTED', 'FAILED', 'RETRYING', 'MOCK_SENT', 'PENDING'
    attempt_count INTEGER DEFAULT 1,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

-- 2. Migrate existing historical logs if any
INSERT INTO email_delivery_logs_new (id, order_id, recipient_email, email_type, resend_message_id, status, error_message, created_at, updated_at)
SELECT id, order_id, recipient_email, email_type, resend_message_id, status, error_message, sent_at, sent_at
FROM email_delivery_logs;

-- 3. Replace old table
DROP TABLE email_delivery_logs;
ALTER TABLE email_delivery_logs_new RENAME TO email_delivery_logs;

-- 4. Create optimized query & idempotency indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_order ON email_delivery_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_delivery_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_delivery_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_order_type ON email_delivery_logs(order_id, email_type);

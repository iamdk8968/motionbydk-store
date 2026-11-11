-- Rollback for 0005_enhance_email_delivery_logs.sql
CREATE TABLE IF NOT EXISTS email_delivery_logs_old (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    email_type TEXT NOT NULL CHECK(email_type IN ('ORDER_RECEIPT', 'LICENSE_ISSUED', 'STARTER_KIT', 'REFUND')),
    resend_message_id TEXT,
    status TEXT DEFAULT 'SENT' CHECK(status IN ('SENT', 'FAILED', 'RETRYING')),
    error_message TEXT,
    sent_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

INSERT INTO email_delivery_logs_old (id, order_id, recipient_email, email_type, resend_message_id, status, error_message, sent_at)
SELECT id, order_id, recipient_email, 
  CASE WHEN email_type IN ('ORDER_RECEIPT', 'LICENSE_ISSUED', 'STARTER_KIT', 'REFUND') THEN email_type ELSE 'ORDER_RECEIPT' END,
  resend_message_id, 
  CASE WHEN status IN ('SENT', 'FAILED', 'RETRYING') THEN status ELSE 'SENT' END,
  error_message, created_at
FROM email_delivery_logs;

DROP TABLE email_delivery_logs;
ALTER TABLE email_delivery_logs_old RENAME TO email_delivery_logs;

CREATE INDEX IF NOT EXISTS idx_email_logs_order ON email_delivery_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_delivery_logs(status);

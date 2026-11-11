-- Migration: 0006_claim_verifications.sql
-- Purpose: Store secure, single-use, time-limited OTP hashes for authenticated license claims
-- Up Migration

CREATE TABLE IF NOT EXISTS claim_verifications (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    email TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    is_consumed INTEGER DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

CREATE INDEX IF NOT EXISTS idx_claim_order ON claim_verifications(order_id);
CREATE INDEX IF NOT EXISTS idx_claim_expires ON claim_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_claim_email ON claim_verifications(email);

-- Migration Rollback: 0006_down.sql
-- Purpose: Safely teardown claim_verifications table

DROP INDEX IF EXISTS idx_claim_email;
DROP INDEX IF EXISTS idx_claim_expires;
DROP INDEX IF EXISTS idx_claim_order;
DROP TABLE IF EXISTS claim_verifications;

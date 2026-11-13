-- =============================================================================
-- Rollback Migration: 0009_rollback_final_system_expansion.sql
-- Database: motionbydk-db-staging / motionbydk-db
-- Description: Reverts changes introduced by Migration 0009.
-- =============================================================================

DROP TABLE IF EXISTS homepage_cms;
DROP TABLE IF EXISTS plugin_releases;

-- Note: SQLite does not support DROP COLUMN in older versions without table rebuilds,
-- but SQLite 3.35.0+ supports ALTER TABLE DROP COLUMN.
-- In Cloudflare D1:
ALTER TABLE coupons DROP COLUMN discount_type;
ALTER TABLE coupons DROP COLUMN discount_percentage;
ALTER TABLE coupons DROP COLUMN discount_usd;
ALTER TABLE coupons DROP COLUMN per_customer_limit;

ALTER TABLE payments DROP COLUMN payment_currency;

ALTER TABLE products DROP COLUMN category;
ALTER TABLE products DROP COLUMN is_free;
ALTER TABLE products DROP COLUMN status;
ALTER TABLE products DROP COLUMN thumbnail_url;
ALTER TABLE products DROP COLUMN screenshots;
ALTER TABLE products DROP COLUMN compatibility;
ALTER TABLE products DROP COLUMN installation_guide;
ALTER TABLE products DROP COLUMN features_list;
ALTER TABLE products DROP COLUMN update_policy;
ALTER TABLE products DROP COLUMN updated_at;

INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details)
VALUES ('audit-mig-0009-rb', 'SYSTEM', 'ROLLBACK_0009', 'SCHEMA', '0009', 'Rolled back Migration 0009');

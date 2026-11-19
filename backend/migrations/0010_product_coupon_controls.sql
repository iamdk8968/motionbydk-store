-- =============================================================================
-- Migration: 0010_product_coupon_controls.sql
-- Database: motionbydk-db-staging -> motionbydk-db
-- Target: Cloudflare D1 (SQLite)
-- Description: Add allow_coupons control column to products table
-- =============================================================================

ALTER TABLE products ADD COLUMN allow_coupons INTEGER DEFAULT 1;

UPDATE products SET allow_coupons = 1 WHERE allow_coupons IS NULL;

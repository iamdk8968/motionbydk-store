-- =============================================================================
-- Migration: 0002_seed_approved_products_and_coupons.sql
-- Database: motionbydk-db
-- Target: Cloudflare D1 (SQLite)
-- Description: Seed approved commercial products, lead magnet, legacy reference, and coupon
-- =============================================================================

-- Seed Products
INSERT OR REPLACE INTO products (id, name, description, price_inr, price_usd, r2_object_key, has_license, max_devices, is_active)
VALUES
(
    'ae-workflow-pro',
    'MotionByDk AE Workflow Pro Extension v3.6.0',
    'Professional After Effects animation suite with 3D carousel, macOS mouse dock, and bezier curves.',
    49900,
    15.00,
    'products/ae-workflow-pro/v3.6.0/MotionByDk_AE_Workflow_Pro_v3.6.0.zip',
    1,
    2,
    1
),
(
    'free-starter-kit',
    'MotionByDk Free Starter Pack',
    'Essential creator overlays, sound effects, and color grading LUTs.',
    0,
    0.00,
    'products/starter-kit/MotionByDk_Free_Starter_Kit.zip',
    0,
    0,
    1
),
(
    'studio-combo-legacy',
    'Studio Combo Pack (Legacy Reference)',
    'Discontinued bundle record preserved strictly for existing customer license validation.',
    69900,
    25.00,
    NULL,
    1,
    2,
    0
);

-- Seed Coupon FIRST100 (Applicable to AE Workflow Pro: ₹499 - ₹100 = ₹399)
INSERT OR REPLACE INTO coupons (code, discount_inr, applicable_product_id, max_uses, times_used, is_active)
VALUES
(
    'FIRST100',
    10000,
    'ae-workflow-pro',
    1000,
    0,
    1
);

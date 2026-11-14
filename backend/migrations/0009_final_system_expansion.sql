-- =============================================================================
-- Migration: 0009_final_system_expansion.sql
-- Database: motionbydk-db-staging (Staging) -> motionbydk-db (Production)
-- Target: Cloudflare D1 (SQLite)
-- Description: Multi-currency support, CMS product fields, plugin releases,
--              enhanced coupon engine, and homepage CMS configuration.
-- =============================================================================

PRAGMA foreign_keys = ON;

-- 1. ENHANCE PRODUCTS TABLE WITH CMS & COMPATIBILITY ATTRIBUTES
ALTER TABLE products ADD COLUMN category TEXT DEFAULT 'plugin';
ALTER TABLE products ADD COLUMN is_free INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'PUBLISHED';
ALTER TABLE products ADD COLUMN thumbnail_url TEXT;
ALTER TABLE products ADD COLUMN screenshots TEXT;          -- JSON string array of preview URLs
ALTER TABLE products ADD COLUMN compatibility TEXT;        -- e.g. "AE CC 2018 - 2026, Win/Mac"
ALTER TABLE products ADD COLUMN installation_guide TEXT;
ALTER TABLE products ADD COLUMN features_list TEXT;         -- JSON string array of bullet points
ALTER TABLE products ADD COLUMN update_policy TEXT;
ALTER TABLE products ADD COLUMN updated_at TEXT;

-- Update existing active products with rich catalog data
UPDATE products SET 
  name = 'MotionByDk AE Workflow Pro Extension v3.7.0',
  r2_object_key = 'products/ae-workflow-pro/v3.7.0/MotionByDk_AE_Workflow_Pro_v3.7.0.zip',
  category = 'plugin',
  is_free = 0,
  status = 'PUBLISHED',
  thumbnail_url = 'assets/ae_workflow_preview.png',
  compatibility = 'After Effects CC 2018 - 2026 (v15.0 - v25.x) • Windows 10/11 & macOS Intel/Apple Silicon (M1/M2/M3/M4)',
  features_list = '["3D Spatial Carousel Generator with 5 dynamic layout presets","macOS Interactive Dock magnification with spring physics","Professional Bezier Graph curve library with 1-click ease ramps","Full Vector Shape Modifier with Trim Paths, Dashes & Taper","Hardware-locked 2-PC Commercial License (Desktop + Laptop)"]',
  installation_guide = '1. Download and extract your extension zip archive.\n2. Open After Effects, navigate to File > Scripts > Run Script File, or place in Scripts/ScriptUI Panels.\n3. Enter your official 2-PC License Key when prompted on initial launch.\n4. Dock the panel anywhere in your After Effects workspace.',
  update_policy = 'Lifetime free updates within version 3.x series. Secure direct downloads via Cloudflare R2.',
  updated_at = datetime('now')
WHERE id = 'ae-workflow-pro';

UPDATE products SET 
  category = 'asset',
  is_free = 1,
  status = 'PUBLISHED',
  thumbnail_url = 'assets/vault_hero_mockup.png',
  compatibility = 'Universal • Compatible with After Effects, Premiere Pro, DaVinci Resolve, Final Cut Pro',
  features_list = '["10+ High-definition Foley & Motion SFX (Whooshes, Pops, Clicks)","5 Cinematic Lens Flares & Grain Overlays","3 Dhananjay Custom Creator LUTs for Rec.709 footage","Royalty-free commercial use permitted across YouTube, Social & Client projects"]',
  installation_guide = '1. Download the ZIP package.\n2. Extract contents to your assets drive.\n3. Drag and drop audio and overlays directly into your editing timeline.',
  update_policy = 'Free lifetime community pack.',
  updated_at = datetime('now')
WHERE id = 'free-starter-kit';


-- 2. ENHANCE COUPONS TABLE FOR PERCENTAGE & USD DISCOUNTS
ALTER TABLE coupons ADD COLUMN discount_type TEXT DEFAULT 'FIXED'; -- 'FIXED' or 'PERCENTAGE'
ALTER TABLE coupons ADD COLUMN discount_percentage REAL DEFAULT 0;  -- e.g. 20.0 for 20%
ALTER TABLE coupons ADD COLUMN discount_usd REAL DEFAULT 0.00;      -- Fixed USD discount amount
ALTER TABLE coupons ADD COLUMN per_customer_limit INTEGER DEFAULT 1;

-- Add USD discount for existing FIRST100 coupon
UPDATE coupons SET discount_usd = 3.00 WHERE code = 'FIRST100';


-- 3. ENHANCE PAYMENTS TABLE FOR MULTI-CURRENCY
ALTER TABLE payments ADD COLUMN payment_currency TEXT DEFAULT 'INR';


-- 4. PLUGIN RELEASES MANAGEMENT TABLE
CREATE TABLE IF NOT EXISTS plugin_releases (
    id TEXT PRIMARY KEY,                                   -- UUID v4
    product_id TEXT NOT NULL,                              -- Foreign key to products(id)
    version TEXT NOT NULL,                                 -- Semantic version, e.g. '3.6.0'
    title TEXT NOT NULL,                                   -- e.g. 'AE Workflow Pro v3.6.0'
    release_notes TEXT,                                    -- Markdown or text changelog
    release_date TEXT NOT NULL,                            -- YYYY-MM-DD
    min_ae_version TEXT DEFAULT '15.0',                    -- Minimum supported AE version
    r2_object_key TEXT NOT NULL,                           -- Key in Cloudflare R2 bucket
    file_size_bytes INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    is_published INTEGER DEFAULT 1,                        -- 1 = Published, 0 = Draft/Unpublished
    is_latest INTEGER DEFAULT 0,                           -- 1 = Current active latest release
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE INDEX IF NOT EXISTS idx_releases_product ON plugin_releases(product_id, is_published);
CREATE INDEX IF NOT EXISTS idx_releases_latest ON plugin_releases(is_latest);

-- Seed initial release for v3.7.0
INSERT OR IGNORE INTO plugin_releases (
    id, product_id, version, title, release_notes, release_date, min_ae_version,
    r2_object_key, file_size_bytes, download_count, is_published, is_latest
) VALUES (
    'rel-00000000-0000-4000-8000-000000000002',
    'ae-workflow-pro',
    '3.7.0',
    'MotionByDk AE Workflow Pro v3.7.0 Suite',
    '• Added Liquid Glass native plugin (ToolsForMotion) with 1-click installer support\n• Integrated 7-Day Free Trial Engine with persistent local tamper protection\n• Instant Cashfree & D1 Cloud License Key device activation\n• High-performance 3D Carousel Suite & macOS Mouse Dock spring physics\n• Universal Adobe After Effects 2020-2026 compatibility',
    '2026-11-14',
    '15.0',
    'products/ae-workflow-pro/v3.7.0/MotionByDk_AE_Workflow_Pro_v3.7.0.zip',
    1093344,
    0,
    1,
    1
);


-- 5. HOMEPAGE CMS MANAGEMENT TABLE
CREATE TABLE IF NOT EXISTS homepage_cms (
    key TEXT PRIMARY KEY,                                  -- e.g. 'top_banner', 'hero_cta', 'promo_deal'
    title TEXT,
    content TEXT,                                          -- Text, markdown, or JSON payload
    cta_text TEXT,
    cta_url TEXT,
    badge_text TEXT,
    start_date TEXT,
    end_date TEXT,
    is_active INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Seed initial CMS blocks
INSERT OR IGNORE INTO homepage_cms (key, title, content, cta_text, cta_url, badge_text, is_active)
VALUES 
(
    'top_banner',
    '⚡ Special Launch Offer',
    'Use coupon code FIRST100 for instant discount on AE Workflow Pro!',
    'Claim Discount',
    '#checkout',
    'LIMITED TIME',
    1
),
(
    'hero_cta',
    'Supercharge Your After Effects Workflow',
    'Create stunning 3D carousels, macOS dock physics & smooth easing curves in seconds.',
    'Get AE Workflow Pro',
    '#checkout',
    'v3.7.0 STABLE',
    1
),
(
    'announcement',
    'Motion By DK Store Now Live',
    'Direct automated instant delivery with 2-PC Commercial License and Cloudflare R2 downloads.',
    'Browse Tools',
    '#plugin',
    'NEW',
    1
);


-- 6. AUDIT RECORD
INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details)
VALUES ('audit-mig-0009', 'SYSTEM', 'MIGRATION_0009', 'SCHEMA', '0009', 'Applied Migration 0009: Products CMS, Releases, Multi-currency, and Homepage CMS');

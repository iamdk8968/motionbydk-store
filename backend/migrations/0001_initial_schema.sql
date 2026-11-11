-- =============================================================================
-- Migration: 0001_initial_schema.sql
-- Database: motionbydk-db
-- Target: Cloudflare D1 (SQLite)
-- Description: Core schema for orders, payments, licenses, R2 delivery, and admin
-- =============================================================================

PRAGMA foreign_keys = ON;

-- 1. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,                       -- e.g. 'ae-workflow-pro', 'free-starter-kit'
    name TEXT NOT NULL,
    description TEXT,
    price_inr INTEGER NOT NULL,               -- Price in paise (e.g. 49900 = ₹499.00)
    price_usd REAL DEFAULT 15.00,             -- Baseline USD price for international display
    r2_object_key TEXT,                       -- Object key in R2 bucket 'motionbydk-products'
    has_license INTEGER DEFAULT 0,            -- 1 = Software requiring license, 0 = Digital asset
    max_devices INTEGER DEFAULT 2,            -- Default device activation allowance
    is_active INTEGER DEFAULT 1,              -- 1 = Available for purchase, 0 = Discontinued/Inactive
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- 2. COUPONS TABLE
CREATE TABLE IF NOT EXISTS coupons (
    code TEXT PRIMARY KEY,                     -- e.g. 'FIRST100'
    discount_inr INTEGER NOT NULL,            -- Discount in paise (e.g. 10000 = ₹100.00)
    applicable_product_id TEXT,               -- Foreign key or NULL for all products
    max_uses INTEGER DEFAULT 1000,
    times_used INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (applicable_product_id) REFERENCES products(id)
);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);

-- 3. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,                       -- UUID v4
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    full_name TEXT NOT NULL,
    phone TEXT,                                -- Phone number for WhatsApp / UPI confirmation
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

-- 4. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,                       -- UUID v4
    order_id TEXT NOT NULL UNIQUE,             -- Cashfree Order ID (e.g. MDK_ORD_1700000000_A1B2C3)
    customer_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    coupon_code TEXT,
    base_amount_inr INTEGER NOT NULL,          -- In paise
    discount_inr INTEGER DEFAULT 0,            -- In paise
    final_amount_inr INTEGER NOT NULL,         -- In paise
    currency TEXT DEFAULT 'INR',
    status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED')),
    cf_payment_session_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    paid_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (coupon_code) REFERENCES coupons(code)
);
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- 5. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,                       -- UUID v4
    order_id TEXT NOT NULL,
    cf_payment_id TEXT NOT NULL UNIQUE,        -- Cashfree Payment Reference ID
    payment_method TEXT,                       -- 'upi', 'card', 'netbanking', 'app'
    payment_amount_inr INTEGER NOT NULL,       -- In paise
    payment_status TEXT NOT NULL CHECK(payment_status IN ('SUCCESS', 'FAILED', 'PENDING', 'USER_DROPPED')),
    payment_time TEXT,
    bank_reference TEXT,                       -- UTR / Bank Reference Number
    raw_response TEXT,                         -- Sanitized JSON string of gateway response
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);
CREATE INDEX IF NOT EXISTS idx_payments_cf_id ON payments(cf_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

-- 6. PAYMENT EVENTS TABLE (Webhook Audit Log & Idempotency)
CREATE TABLE IF NOT EXISTS payment_events (
    id TEXT PRIMARY KEY,                       -- UUID v4
    event_id TEXT UNIQUE,                      -- Cashfree event/signature hash
    order_id TEXT NOT NULL,
    event_type TEXT NOT NULL,                  -- 'PAYMENT_SUCCESS_WEBHOOK', 'PAYMENT_FAILED_WEBHOOK'
    signature_verified INTEGER DEFAULT 0,      -- 1 = Valid HMAC-SHA256, 0 = Failed
    payload TEXT NOT NULL,                     -- Raw webhook payload
    processed_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payment_events_order ON payment_events(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_event_id ON payment_events(event_id);

-- 7. LICENSES TABLE
CREATE TABLE IF NOT EXISTS licenses (
    id TEXT PRIMARY KEY,                       -- UUID v4
    license_key TEXT NOT NULL UNIQUE,          -- Format: MDK-PRO-2026-XXXXXX or legacy
    license_hash TEXT,                         -- Optional SHA-256 hash for secure lookups
    order_id TEXT,                             -- NULL for legacy imported licenses
    customer_id TEXT,                          -- NULL for legacy unassigned keys
    product_id TEXT NOT NULL,
    max_devices INTEGER DEFAULT 2,             -- Strict 2-PC limit (or 999 for master key)
    is_active INTEGER DEFAULT 1,               -- 1 = Active, 0 = Revoked
    revocation_reason TEXT,
    is_legacy INTEGER DEFAULT 0,               -- 1 = Imported from api/licenses.json, 0 = Generated online
    note TEXT,                                 -- e.g. 'Master Studio Key for DK'
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_order ON licenses(order_id);
CREATE INDEX IF NOT EXISTS idx_licenses_customer ON licenses(customer_id);

-- 8. LICENSE ACTIVATIONS TABLE (Hardware Device Locker)
CREATE TABLE IF NOT EXISTS license_activations (
    id TEXT PRIMARY KEY,                       -- UUID v4
    license_key TEXT NOT NULL,
    machine_id TEXT NOT NULL,                  -- Unique hardware identifier hash from AE
    machine_name TEXT,                         -- Hostname or user-friendly device label
    os TEXT,                                   -- 'macOS', 'Windows 10/11'
    app_version TEXT,                          -- 'After Effects 2026'
    is_active INTEGER DEFAULT 1,               -- 1 = Active on this machine, 0 = Deactivated
    activated_at TEXT DEFAULT (datetime('now')),
    deactivated_at TEXT,
    FOREIGN KEY (license_key) REFERENCES licenses(license_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_device ON license_activations(license_key, machine_id) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_activations_license ON license_activations(license_key);
CREATE INDEX IF NOT EXISTS idx_activations_machine ON license_activations(machine_id);

-- 9. DOWNLOAD TOKENS TABLE
CREATE TABLE IF NOT EXISTS download_tokens (
    token TEXT PRIMARY KEY,                    -- Cryptographically random 64-character hex string
    order_id TEXT NOT NULL,
    r2_object_key TEXT NOT NULL,               -- Target ZIP file in R2
    download_count INTEGER DEFAULT 0,
    max_downloads INTEGER DEFAULT 10,
    expires_at TEXT NOT NULL,                  -- UTC expiry timestamp (e.g. now + 48h)
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);
CREATE INDEX IF NOT EXISTS idx_download_tokens_order ON download_tokens(order_id);
CREATE INDEX IF NOT EXISTS idx_download_tokens_expires ON download_tokens(expires_at);

-- 10. DOWNLOAD LOGS TABLE
CREATE TABLE IF NOT EXISTS download_logs (
    id TEXT PRIMARY KEY,                       -- UUID v4
    token TEXT NOT NULL,
    bytes_sent INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    status_code INTEGER,                       -- 200, 206, 403, 410
    downloaded_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (token) REFERENCES download_tokens(token)
);
CREATE INDEX IF NOT EXISTS idx_download_logs_token ON download_logs(token);

-- 11. ADMIN USERS TABLE
CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,                       -- UUID v4
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,               -- PBKDF2 with SHA-256
    salt TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'admin' CHECK(role IN ('admin', 'support')),
    last_login_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_username ON admin_users(username);

-- 12. EMAIL DELIVERY LOGS TABLE
CREATE TABLE IF NOT EXISTS email_delivery_logs (
    id TEXT PRIMARY KEY,                       -- UUID v4
    order_id TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    email_type TEXT NOT NULL CHECK(email_type IN ('ORDER_RECEIPT', 'LICENSE_ISSUED', 'STARTER_KIT', 'REFUND')),
    resend_message_id TEXT,                    -- Resend Message ID for tracking
    status TEXT DEFAULT 'SENT' CHECK(status IN ('SENT', 'FAILED', 'RETRYING')),
    error_message TEXT,
    sent_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);
CREATE INDEX IF NOT EXISTS idx_email_logs_order ON email_delivery_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_delivery_logs(status);

-- =============================================================================
-- Migration: 0004_security_hardening.sql
-- Database: motionbydk-db
-- Target: Cloudflare D1 (SQLite)
-- Description: Enforce atomic hardware device limits via SQLite triggers and add missing live legacy keys
-- =============================================================================

-- 1. Create Atomic Trigger to prevent active devices exceeding max_devices on INSERT
CREATE TRIGGER IF NOT EXISTS trigger_enforce_max_devices_insert
BEFORE INSERT ON license_activations
FOR EACH ROW
WHEN NEW.is_active = 1
BEGIN
    SELECT CASE
        WHEN (
            SELECT count(*) 
            FROM license_activations 
            WHERE license_key = NEW.license_key AND is_active = 1
        ) >= (
            SELECT max_devices 
            FROM licenses 
            WHERE license_key = NEW.license_key
        )
        THEN RAISE(ABORT, 'DEVICE_LIMIT_REACHED')
    END;
END;

-- 2. Create Atomic Trigger to prevent active devices exceeding max_devices on UPDATE
CREATE TRIGGER IF NOT EXISTS trigger_enforce_max_devices_update
BEFORE UPDATE OF is_active ON license_activations
FOR EACH ROW
WHEN NEW.is_active = 1 AND OLD.is_active = 0
BEGIN
    SELECT CASE
        WHEN (
            SELECT count(*) 
            FROM license_activations 
            WHERE license_key = NEW.license_key AND is_active = 1
        ) >= (
            SELECT max_devices 
            FROM licenses 
            WHERE license_key = NEW.license_key
        )
        THEN RAISE(ABORT, 'DEVICE_LIMIT_REACHED')
    END;
END;

-- 3. Add missing live legacy customer records (BOBY and DEEKSHITH)
INSERT OR IGNORE INTO customers (id, email, full_name, phone) VALUES 
('c0000000-0000-4000-8000-000000000004', 'motionbydk+boby@gmail.com', 'Boby', NULL),
('c0000000-0000-4000-8000-000000000005', 'motionbydk+deekshith@gmail.com', 'Deekshith', NULL);

-- 4. Add missing live legacy licenses (BOBY and DEEKSHITH)
INSERT OR REPLACE INTO licenses (id, license_key, customer_id, product_id, max_devices, is_active, is_legacy, note) VALUES 
('7a1b2c3d-4e5f-4a01-8b02-1a2b3c4d5e6f', 'MDK-BOBY-PC', 'c0000000-0000-4000-8000-000000000004', 'ae-workflow-pro', 2, 1, 1, 'PLUGIN Pro Key for BOBY'),
('8b2c3d4e-5f6a-4b02-9c03-2b3c4d5e6f7a', 'MDK-DEEKSHITH-PC', 'c0000000-0000-4000-8000-000000000005', 'ae-workflow-pro', 2, 1, 1, 'PLUGIN Pro Key for Deekshith');

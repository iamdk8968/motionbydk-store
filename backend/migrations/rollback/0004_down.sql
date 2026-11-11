-- Rollback for 0004_security_hardening.sql
DROP TRIGGER IF EXISTS trigger_enforce_max_devices_insert;
DROP TRIGGER IF EXISTS trigger_enforce_max_devices_update;
DELETE FROM licenses WHERE license_key IN ('MDK-BOBY-PC', 'MDK-DEEKSHITH-PC');
DELETE FROM customers WHERE id IN ('c0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000005');

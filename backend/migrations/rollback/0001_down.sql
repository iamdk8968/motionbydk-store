-- Rollback for 0001_initial_schema.sql
DROP TABLE IF EXISTS email_delivery_logs;
DROP TABLE IF EXISTS admin_users;
DROP TABLE IF EXISTS coupons;
DROP TABLE IF EXISTS download_logs;
DROP TABLE IF EXISTS download_tokens;
DROP TABLE IF EXISTS license_activations;
DROP TABLE IF EXISTS licenses;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS payment_events;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;

-- Rollback for 0002_seed_approved_products_and_coupons.sql
DELETE FROM coupons WHERE code = 'FIRST100';
DELETE FROM products WHERE id IN ('ae-workflow-pro', 'free-starter-kit', 'studio-combo-legacy');

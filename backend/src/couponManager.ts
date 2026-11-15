/**
 * Coupon & Offers Management Engine
 * Handles coupon administration, fixed and percentage calculations, expiry limits, and usage reporting.
 */

import { CouponRecord } from './types';

export async function listAdminCoupons(db: D1Database): Promise<CouponRecord[]> {
  const result = await db
    .prepare('SELECT * FROM coupons ORDER BY created_at DESC')
    .all<CouponRecord>();

  return result.results || [];
}

export async function createCoupon(
  db: D1Database,
  data: any
): Promise<CouponRecord> {
  const cleanCode = (data.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (!cleanCode) throw new Error('Invalid coupon code format.');

  const existing = await db.prepare('SELECT code FROM coupons WHERE code = ?').bind(cleanCode).first();
  if (existing) throw new Error(`Coupon '${cleanCode}' already exists.`);

  const discountType = (data.discount_type || data.discountType || 'FIXED').toUpperCase();
  const discountInr = Number(data.discount_inr ?? data.discount_amount_inr ?? data.discountInr ?? 0);
  const discountUsd = Number(data.discount_usd ?? data.discountUsd ?? 0);
  const discountPercentage = Number(data.discount_percentage ?? data.discountPct ?? data.discountPercentage ?? 0);
  const applicableProductId = data.applicable_product_id ?? data.applicableProductId ?? null;
  const maxUses = data.max_uses !== undefined ? Number(data.max_uses) : data.maxUses !== undefined ? Number(data.maxUses) : 1000;
  const perCustomerLimit = data.per_customer_limit !== undefined ? Number(data.per_customer_limit) : data.perCustomerLimit !== undefined ? Number(data.perCustomerLimit) : 1;
  const expiresAt = data.expires_at || data.expiresAt || null;

  await db
    .prepare(
      `INSERT INTO coupons (
        code, discount_inr, discount_usd, discount_type, discount_percentage,
        applicable_product_id, max_uses, times_used, per_customer_limit,
        is_active, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 1, ?, datetime('now'))`
    )
    .bind(
      cleanCode,
      discountInr,
      discountUsd,
      discountType,
      discountPercentage,
      applicableProductId,
      maxUses,
      perCustomerLimit,
      expiresAt
    )
    .run();

  const coupon = await db.prepare('SELECT * FROM coupons WHERE code = ?').bind(cleanCode).first<CouponRecord>();
  if (!coupon) throw new Error('Failed to retrieve newly created coupon.');
  return coupon;
}

export async function updateCoupon(
  db: D1Database,
  code: string,
  data: any
): Promise<CouponRecord> {
  const cleanCode = code.trim().toUpperCase();
  const existing = await db.prepare('SELECT * FROM coupons WHERE code = ?').bind(cleanCode).first<CouponRecord>();
  if (!existing) throw new Error('Coupon not found.');

  const discountInr = data.discount_inr !== undefined ? Number(data.discount_inr) : data.discount_amount_inr !== undefined ? Number(data.discount_amount_inr) : data.discountInr !== undefined ? Number(data.discountInr) : null;
  const discountUsd = data.discount_usd !== undefined ? Number(data.discount_usd) : data.discountUsd !== undefined ? Number(data.discountUsd) : null;
  const discountType = data.discount_type !== undefined ? String(data.discount_type).toUpperCase() : data.discountType !== undefined ? String(data.discountType).toUpperCase() : null;
  const discountPercentage = data.discount_percentage !== undefined ? Number(data.discount_percentage) : data.discountPct !== undefined ? Number(data.discountPct) : data.discountPercentage !== undefined ? Number(data.discountPercentage) : null;
  const applicableProductId = data.applicable_product_id !== undefined ? data.applicable_product_id : data.applicableProductId !== undefined ? data.applicableProductId : null;
  const maxUses = data.max_uses !== undefined ? Number(data.max_uses) : data.maxUses !== undefined ? Number(data.maxUses) : null;
  const perCustomerLimit = data.per_customer_limit !== undefined ? Number(data.per_customer_limit) : data.perCustomerLimit !== undefined ? Number(data.perCustomerLimit) : null;
  const isActive = data.is_active !== undefined ? (data.is_active ? 1 : 0) : data.isActive !== undefined ? (data.isActive ? 1 : 0) : null;
  const expiresAt = data.expires_at !== undefined ? data.expires_at : data.expiresAt !== undefined ? data.expiresAt : null;

  await db
    .prepare(
      `UPDATE coupons SET
        discount_inr = COALESCE(?, discount_inr),
        discount_usd = COALESCE(?, discount_usd),
        discount_type = COALESCE(?, discount_type),
        discount_percentage = COALESCE(?, discount_percentage),
        applicable_product_id = COALESCE(?, applicable_product_id),
        max_uses = COALESCE(?, max_uses),
        per_customer_limit = COALESCE(?, per_customer_limit),
        is_active = COALESCE(?, is_active),
        expires_at = COALESCE(?, expires_at)
      WHERE code = ?`
    )
    .bind(
      discountInr,
      discountUsd,
      discountType,
      discountPercentage,
      applicableProductId,
      maxUses,
      perCustomerLimit,
      isActive,
      expiresAt,
      cleanCode
    )
    .run();

  const updated = await db.prepare('SELECT * FROM coupons WHERE code = ?').bind(cleanCode).first<CouponRecord>();
  if (!updated) throw new Error('Failed to retrieve updated coupon.');
  return updated;
}

export async function toggleCouponActive(
  db: D1Database,
  code: string,
  isActive: boolean
): Promise<boolean> {
  const cleanCode = code.trim().toUpperCase();
  const result = await db
    .prepare('UPDATE coupons SET is_active = ? WHERE code = ?')
    .bind(isActive ? 1 : 0, cleanCode)
    .run();

  return (result.meta.changes || 0) > 0;
}

export async function getCouponUsageReport(db: D1Database): Promise<{
  totalCoupons: number;
  activeCoupons: number;
  totalTimesRedeemed: number;
  couponStats: Array<{
    code: string;
    discountType: string;
    discountInr: number;
    discountUsd: number;
    timesUsed: number;
    maxUses: number;
    isActive: boolean;
    expiresAt: string | null;
    totalSavingsInr: number;
  }>;
}> {
  const coupons = await db
    .prepare('SELECT * FROM coupons ORDER BY times_used DESC')
    .all<CouponRecord>();

  const list = coupons.results || [];
  let totalTimesRedeemed = 0;

  const stats = list.map(c => {
    totalTimesRedeemed += c.times_used;
    return {
      code: c.code,
      discountType: c.discount_type || 'FIXED',
      discountInr: c.discount_inr,
      discountUsd: c.discount_usd || 0,
      timesUsed: c.times_used,
      maxUses: c.max_uses,
      isActive: c.is_active === 1,
      expiresAt: c.expires_at,
      totalSavingsInr: Number(((c.times_used * c.discount_inr) / 100).toFixed(2)),
    };
  });

  return {
    totalCoupons: list.length,
    activeCoupons: list.filter(c => c.is_active === 1).length,
    totalTimesRedeemed,
    couponStats: stats,
  };
}

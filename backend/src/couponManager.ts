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
  data: {
    code: string;
    discountInr: number;
    discountUsd?: number;
    discountType?: string;          // 'FIXED' | 'PERCENTAGE'
    discountPercentage?: number;
    applicableProductId?: string;
    maxUses?: number;
    perCustomerLimit?: number;
    expiresAt?: string;
  }
): Promise<CouponRecord> {
  const cleanCode = data.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (!cleanCode) throw new Error('Invalid coupon code format.');

  const existing = await db.prepare('SELECT code FROM coupons WHERE code = ?').bind(cleanCode).first();
  if (existing) throw new Error(`Coupon '${cleanCode}' already exists.`);

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
      data.discountInr || 0,
      data.discountUsd || 0,
      data.discountType || 'FIXED',
      data.discountPercentage || 0,
      data.applicableProductId || null,
      data.maxUses !== undefined ? data.maxUses : 1000,
      data.perCustomerLimit !== undefined ? data.perCustomerLimit : 1,
      data.expiresAt || null
    )
    .run();

  const coupon = await db.prepare('SELECT * FROM coupons WHERE code = ?').bind(cleanCode).first<CouponRecord>();
  if (!coupon) throw new Error('Failed to retrieve newly created coupon.');
  return coupon;
}

export async function updateCoupon(
  db: D1Database,
  code: string,
  data: Partial<CouponRecord>
): Promise<CouponRecord> {
  const cleanCode = code.trim().toUpperCase();
  const existing = await db.prepare('SELECT * FROM coupons WHERE code = ?').bind(cleanCode).first<CouponRecord>();
  if (!existing) throw new Error('Coupon not found.');

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
      data.discount_inr !== undefined ? data.discount_inr : null,
      data.discount_usd !== undefined ? data.discount_usd : null,
      data.discount_type !== undefined ? data.discount_type : null,
      data.discount_percentage !== undefined ? data.discount_percentage : null,
      data.applicable_product_id !== undefined ? data.applicable_product_id : null,
      data.max_uses !== undefined ? data.max_uses : null,
      data.per_customer_limit !== undefined ? data.per_customer_limit : null,
      data.is_active !== undefined ? data.is_active : null,
      data.expires_at !== undefined ? data.expires_at : null,
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

/**
 * D1 Database Access Layer
 */

import { ProductRecord, CouponRecord, CustomerRecord, OrderRecord, LicenseRecord, DownloadTokenRecord } from './types';
import { generateLicenseKey, generateDownloadToken, hashString } from './license';

export async function getProduct(db: D1Database, productId: string): Promise<ProductRecord | null> {
  return await db
    .prepare('SELECT * FROM products WHERE id = ? AND is_active = 1')
    .bind(productId)
    .first<ProductRecord>();
}

export async function getCoupon(db: D1Database, code: string): Promise<CouponRecord | null> {
  return await db
    .prepare('SELECT * FROM coupons WHERE code = ? AND is_active = 1')
    .bind(code.toUpperCase().trim())
    .first<CouponRecord>();
}

export async function incrementCouponUsage(db: D1Database, code: string): Promise<void> {
  await db
    .prepare('UPDATE coupons SET times_used = times_used + 1 WHERE code = ?')
    .bind(code)
    .run();
}

export async function upsertCustomer(
  db: D1Database,
  email: string,
  fullName: string,
  phone: string | null
): Promise<CustomerRecord> {
  const existing = await db
    .prepare('SELECT * FROM customers WHERE email = ? COLLATE NOCASE')
    .bind(email.trim().toLowerCase())
    .first<CustomerRecord>();

  if (existing) {
    await db
      .prepare('UPDATE customers SET full_name = ?, phone = COALESCE(?, phone), updated_at = datetime(\'now\') WHERE id = ?')
      .bind(fullName.trim(), phone ? phone.trim() : null, existing.id)
      .run();
    return {
      ...existing,
      full_name: fullName.trim(),
      phone: phone ? phone.trim() : existing.phone,
    };
  }

  const newId = crypto.randomUUID();
  await db
    .prepare('INSERT INTO customers (id, email, full_name, phone) VALUES (?, ?, ?, ?)')
    .bind(newId, email.trim().toLowerCase(), fullName.trim(), phone ? phone.trim() : null)
    .run();

  return {
    id: newId,
    email: email.trim().toLowerCase(),
    full_name: fullName.trim(),
    phone: phone ? phone.trim() : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function createPendingOrder(
  db: D1Database,
  params: {
    orderId: string;
    customerId: string;
    productId: string;
    couponCode: string | null;
    baseAmountInr: number;
    discountInr: number;
    finalAmountInr: number;
    currency?: string;
    cfPaymentSessionId: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }
): Promise<OrderRecord> {
  const id = crypto.randomUUID();
  const orderCurrency = (params.currency || 'INR').toUpperCase();
  await db
    .prepare(
      `INSERT INTO orders (
        id, order_id, customer_id, product_id, coupon_code,
        base_amount_inr, discount_inr, final_amount_inr, currency,
        status, cf_payment_session_id, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`
    )
    .bind(
      id,
      params.orderId,
      params.customerId,
      params.productId,
      params.couponCode,
      params.baseAmountInr,
      params.discountInr,
      params.finalAmountInr,
      orderCurrency,
      params.cfPaymentSessionId,
      params.ipAddress || null,
      params.userAgent || null
    )
    .run();

  return {
    id,
    order_id: params.orderId,
    customer_id: params.customerId,
    product_id: params.productId,
    coupon_code: params.couponCode,
    base_amount_inr: params.baseAmountInr,
    discount_inr: params.discountInr,
    final_amount_inr: params.finalAmountInr,
    currency: 'INR',
    status: 'PENDING',
    cf_payment_session_id: params.cfPaymentSessionId,
    ip_address: params.ipAddress || null,
    user_agent: params.userAgent || null,
    paid_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function getOrder(db: D1Database, orderId: string): Promise<OrderRecord | null> {
  return await db
    .prepare('SELECT * FROM orders WHERE order_id = ?')
    .bind(orderId)
    .first<OrderRecord>();
}

export async function updateOrderStatus(
  db: D1Database,
  orderId: string,
  status: 'PAID' | 'FAILED' | 'CANCELLED',
  paidAt: string | null = null
): Promise<void> {
  await db
    .prepare('UPDATE orders SET status = ?, paid_at = COALESCE(?, paid_at), updated_at = datetime(\'now\') WHERE order_id = ?')
    .bind(status, paidAt, orderId)
    .run();
}

/**
 * Atomically transition a non-PAID order to PAID using SQLite single-statement CAS semantics
 * so concurrent webhook deliveries (e.g. 2023-08-01 and 2021-09-21) cannot double-issue fulfillment.
 */
export async function claimPendingOrderAsPaid(
  db: D1Database,
  orderId: string,
  paidAt: string
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE orders
       SET status = 'PAID', paid_at = COALESCE(paid_at, ?), updated_at = datetime('now')
       WHERE order_id = ? AND status != 'PAID'`
    )
    .bind(paidAt, orderId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function recordPayment(
  db: D1Database,
  params: {
    orderId: string;
    cfPaymentId: string;
    paymentMethod: string;
    paymentAmountInr: number;
    paymentStatus: string;
    paymentCurrency?: string;
    paymentTime: string | null;
    bankReference: string | null;
    rawResponse: string;
  }
): Promise<void> {
  const id = crypto.randomUUID();
  const currency = (params.paymentCurrency || 'INR').toUpperCase();
  await db
    .prepare(
      `INSERT OR REPLACE INTO payments (
        id, order_id, cf_payment_id, payment_method,
        payment_amount_inr, payment_currency, payment_status, payment_time,
        bank_reference, raw_response
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      params.orderId,
      params.cfPaymentId,
      params.paymentMethod,
      params.paymentAmountInr,
      currency,
      params.paymentStatus,
      params.paymentTime || new Date().toISOString(),
      params.bankReference,
      params.rawResponse
    )
    .run();
}

export async function isEventProcessed(db: D1Database, eventId: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT id FROM payment_events WHERE event_id = ?')
    .bind(eventId)
    .first();
  return !!row;
}

export async function recordPaymentEvent(
  db: D1Database,
  params: {
    eventId: string;
    orderId: string;
    eventType: string;
    signatureVerified: boolean;
    payload: string;
  }
): Promise<void> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT OR IGNORE INTO payment_events (
        id, event_id, order_id, event_type, signature_verified, payload
      ) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      params.eventId,
      params.orderId,
      params.eventType,
      params.signatureVerified ? 1 : 0,
      params.payload
    )
    .run();
}

export async function issueLicenseForOrder(
  db: D1Database,
  orderId: string,
  customerId: string,
  productId: string
): Promise<LicenseRecord> {
  // Check if a license was already issued for this order (Idempotency)
  const existing = await db
    .prepare('SELECT * FROM licenses WHERE order_id = ?')
    .bind(orderId)
    .first<LicenseRecord>();

  if (existing) {
    return existing;
  }

  const licenseKey = generateLicenseKey('MDK-PRO-2026-');
  const licenseHash = await hashString(licenseKey);
  const id = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO licenses (
        id, license_key, license_hash, order_id, customer_id,
        product_id, max_devices, is_active, is_legacy, note
      ) VALUES (?, ?, ?, ?, ?, ?, 2, 1, 0, ?)`
    )
    .bind(id, licenseKey, licenseHash, orderId, customerId, productId, `Issued online for order ${orderId}`)
    .run();

  return {
    id,
    license_key: licenseKey,
    license_hash: licenseHash,
    order_id: orderId,
    customer_id: customerId,
    product_id: productId,
    max_devices: 2,
    is_active: 1,
    revocation_reason: null,
    is_legacy: 0,
    note: `Issued online for order ${orderId}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function getLicenseByOrder(db: D1Database, orderId: string): Promise<LicenseRecord | null> {
  return await db
    .prepare('SELECT * FROM licenses WHERE order_id = ? AND is_active = 1')
    .bind(orderId)
    .first<LicenseRecord>();
}

export async function createDownloadTokenForOrder(
  db: D1Database,
  orderId: string,
  r2ObjectKey: string
): Promise<DownloadTokenRecord> {
  // Check if active download token already exists for this order
  const existing = await db
    .prepare('SELECT * FROM download_tokens WHERE order_id = ? AND expires_at > datetime(\'now\')')
    .bind(orderId)
    .first<DownloadTokenRecord>();

  if (existing) {
    if (existing.r2_object_key === r2ObjectKey) {
      return existing;
    }
    // Update existing token to point to the new requested asset release key and refresh expiry
    const newExpiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    await db
      .prepare('UPDATE download_tokens SET r2_object_key = ?, download_count = 0, expires_at = ? WHERE token = ?')
      .bind(r2ObjectKey, newExpiresAt, existing.token)
      .run();
    return {
      ...existing,
      r2_object_key: r2ObjectKey,
      download_count: 0,
      expires_at: newExpiresAt,
    };
  }

  const token = generateDownloadToken();
  // Valid for 48 hours
  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

  await db
    .prepare(
      `INSERT INTO download_tokens (
        token, order_id, r2_object_key, download_count, max_downloads, expires_at
      ) VALUES (?, ?, ?, 0, 10, ?)`
    )
    .bind(token, orderId, r2ObjectKey, expiresAt)
    .run();

  return {
    token,
    order_id: orderId,
    r2_object_key: r2ObjectKey,
    download_count: 0,
    max_downloads: 10,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  };
}

export async function getDownloadTokenByOrder(db: D1Database, orderId: string): Promise<DownloadTokenRecord | null> {
  return await db
    .prepare('SELECT * FROM download_tokens WHERE order_id = ? AND expires_at > datetime(\'now\')')
    .bind(orderId)
    .first<DownloadTokenRecord>();
}

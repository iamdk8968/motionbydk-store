/**
 * License Management Engine (Security Hardened)
 * Handles verification, hardware device activation/deactivation, and order-verified key claiming.
 * Features:
 *  - Strict response data sanitation (no customer PII or internal DB keys leaked)
 *  - Atomic conditional device activation preventing race conditions
 *  - SQLite trigger integration for hardware lock enforcement
 *  - Range-aware atomic token download enforcement
 */

import { Env, LicenseRecord } from './types';
import { issueLicenseForOrder, createDownloadTokenForOrder, upsertCustomer, updateOrderStatus } from './db';
import { hashString } from './license';
import { dispatchClaimOtpEmail, dispatchLicenseClaimedEmail } from './email';
import { getCashfreeOrder } from './cashfree';

function maskEmail(email: string): string {
  const parts = email.trim().split('@');
  if (parts.length !== 2) return email;
  const user = parts[0];
  const domain = parts[1];
  if (user.length <= 2) {
    return user[0] + '*@' + domain;
  }
  return user[0] + '***' + user.slice(-1) + '@' + domain;
}

export async function verifyLicenseKey(
  db: D1Database,
  licenseKey: string
): Promise<{
  valid: boolean;
  active: boolean;
  message?: string;
  licenseKey?: string;
  productName?: string;
  activeDevices?: number;
  maxDevices?: number;
}> {
  if (!licenseKey || typeof licenseKey !== 'string') {
    return { valid: false, active: false, message: 'Invalid license key format.' };
  }

  const cleanKey = licenseKey.trim().toUpperCase();
  const license = await db
    .prepare(
      `SELECT l.license_key, l.max_devices, l.is_active, l.revocation_reason, p.name as product_name
       FROM licenses l
       LEFT JOIN products p ON l.product_id = p.id
       WHERE l.license_key = ?`
    )
    .bind(cleanKey)
    .first<{
      license_key: string;
      max_devices: number;
      is_active: number;
      revocation_reason: string | null;
      product_name: string | null;
    }>();

  if (!license) {
    return { valid: false, active: false, message: 'License key does not exist.' };
  }

  if (!license.is_active) {
    return {
      valid: true,
      active: false,
      message: license.revocation_reason || 'License key has been revoked.',
    };
  }

  // Count active devices
  const activeCountRow = await db
    .prepare('SELECT count(*) as count FROM license_activations WHERE license_key = ? AND is_active = 1')
    .bind(cleanKey)
    .first<{ count: number }>();

  const activeDevices = activeCountRow ? activeCountRow.count : 0;

  // Return strictly sanitized public fields (Zero PII or internal UUIDs exposed)
  return {
    valid: true,
    active: true,
    licenseKey: license.license_key,
    productName: license.product_name || 'MotionByDk AE Workflow Pro',
    activeDevices,
    maxDevices: license.max_devices,
  };
}

export async function activateDevice(
  db: D1Database,
  params: {
    licenseKey: string;
    machineId: string;
    machineName?: string;
    os?: string;
    appVersion?: string;
  }
): Promise<{
  success: boolean;
  code?: string;
  message: string;
  activeDevices?: number;
  maxDevices?: number;
  activatedAt?: string;
}> {
  const { licenseKey, machineId, machineName, os, appVersion } = params;

  if (!licenseKey || !machineId) {
    return {
      success: false,
      code: 'MISSING_PARAMS',
      message: 'Both licenseKey and machineId are required for device activation.',
    };
  }

  const cleanKey = licenseKey.trim().toUpperCase();
  const cleanMachineId = machineId.trim();

  // Verify license existence and active state
  const verification = await verifyLicenseKey(db, cleanKey);
  if (!verification.valid || !verification.active) {
    return {
      success: false,
      code: 'INVALID_LICENSE',
      message: verification.message || 'License key is invalid or inactive.',
    };
  }

  const maxDevices = verification.maxDevices || 2;

  // Check if this machine is ALREADY active on this key (idempotency check)
  const existingActivation = await db
    .prepare('SELECT id, is_active FROM license_activations WHERE license_key = ? AND machine_id = ? AND is_active = 1')
    .bind(cleanKey, cleanMachineId)
    .first<{ id: string; is_active: number }>();

  if (existingActivation) {
    await db
      .prepare('UPDATE license_activations SET activated_at = datetime(\'now\') WHERE id = ?')
      .bind(existingActivation.id)
      .run();

    return {
      success: true,
      code: 'ALREADY_ACTIVE',
      message: 'Device is already activated on this license.',
      activeDevices: verification.activeDevices,
      maxDevices,
      activatedAt: new Date().toISOString(),
    };
  }

  // Check if limit is reached prior to insert
  const currentCount = verification.activeDevices || 0;
  if (currentCount >= maxDevices) {
    return {
      success: false,
      code: 'DEVICE_LIMIT_REACHED',
      message: `Maximum allowed devices (${maxDevices} PC commercial limit) already active. Please deactivate an old machine first or contact support.`,
      activeDevices: currentCount,
      maxDevices,
    };
  }

  // ATOMIC INSERT WITH CONCURRENCY GUARD:
  // Uses conditional WHERE clause + SQLite trigger to guarantee no race condition
  // can ever insert more than max_devices under parallel execution
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    const insertResult = await db
      .prepare(
        `INSERT INTO license_activations (
          id, license_key, machine_id, machine_name, os, app_version, is_active, activated_at
        )
        SELECT ?, ?, ?, ?, ?, ?, 1, ?
        WHERE (
          SELECT count(*) FROM license_activations WHERE license_key = ? AND is_active = 1
        ) < (
          SELECT max_devices FROM licenses WHERE license_key = ?
        )`
      )
      .bind(
        id,
        cleanKey,
        cleanMachineId,
        machineName || 'PC / Workstation',
        os || 'Desktop',
        appVersion || 'After Effects',
        now,
        cleanKey,
        cleanKey
      )
      .run();

    if (insertResult.meta.changes === 0) {
      // Another concurrent thread inserted first
      return {
        success: false,
        code: 'DEVICE_LIMIT_REACHED',
        message: `Maximum allowed devices (${maxDevices} PC commercial limit) already active. Please deactivate an old machine first or contact support.`,
        activeDevices: maxDevices,
        maxDevices,
      };
    }
  } catch (err: any) {
    if (err.message && err.message.includes('DEVICE_LIMIT_REACHED')) {
      return {
        success: false,
        code: 'DEVICE_LIMIT_REACHED',
        message: `Maximum allowed devices (${maxDevices} PC commercial limit) already active. Please deactivate an old machine first or contact support.`,
        activeDevices: maxDevices,
        maxDevices,
      };
    }
    throw err;
  }

  // Fetch updated count
  const updatedCountRow = await db
    .prepare('SELECT count(*) as count FROM license_activations WHERE license_key = ? AND is_active = 1')
    .bind(cleanKey)
    .first<{ count: number }>();

  const newActiveDevices = updatedCountRow ? updatedCountRow.count : currentCount + 1;

  return {
    success: true,
    code: 'ACTIVATED',
    message: `Machine successfully activated (${newActiveDevices}/${maxDevices} devices active).`,
    activeDevices: newActiveDevices,
    maxDevices,
    activatedAt: now,
  };
}

export async function deactivateDevice(
  db: D1Database,
  params: {
    licenseKey: string;
    machineId: string;
    email?: string;
  }
): Promise<{
  success: boolean;
  code?: string;
  message: string;
  remainingActiveDevices?: number;
  maxDevices?: number;
}> {
  const { licenseKey, machineId, email } = params;

  if (!licenseKey || !machineId) {
    return {
      success: false,
      code: 'MISSING_PARAMS',
      message: 'Both licenseKey and machineId are required for deactivation.',
    };
  }

  const cleanKey = licenseKey.trim().toUpperCase();
  const cleanMachineId = machineId.trim();

  // If email is provided, verify ownership authorization
  if (email && typeof email === 'string' && email.trim()) {
    const lic = await db
      .prepare(
        `SELECT l.id, c.email 
         FROM licenses l 
         LEFT JOIN customers c ON l.customer_id = c.id 
         WHERE l.license_key = ?`
      )
      .bind(cleanKey)
      .first<{ id: string; email: string | null }>();

    if (lic && lic.email && lic.email.toLowerCase() !== email.trim().toLowerCase()) {
      return {
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Provided email does not match the registered license owner.',
      };
    }
  }

  // Check if device is active
  const activation = await db
    .prepare('SELECT id FROM license_activations WHERE license_key = ? AND machine_id = ? AND is_active = 1')
    .bind(cleanKey, cleanMachineId)
    .first<{ id: string }>();

  if (!activation) {
    return {
      success: false,
      code: 'NOT_FOUND',
      message: 'Device is not currently active on this license.',
    };
  }

  // Deactivate atomically
  await db
    .prepare('UPDATE license_activations SET is_active = 0, deactivated_at = datetime(\'now\') WHERE id = ? AND is_active = 1')
    .bind(activation.id)
    .run();

  // Count remaining active devices
  const remainingRow = await db
    .prepare('SELECT count(*) as count FROM license_activations WHERE license_key = ? AND is_active = 1')
    .bind(cleanKey)
    .first<{ count: number }>();

  return {
    success: true,
    code: 'DEACTIVATED',
    message: 'Device deactivated successfully. Activation slot freed for a new machine.',
    remainingActiveDevices: remainingRow ? remainingRow.count : 0,
    maxDevices: 2,
  };
}

export async function claimLicenseByOrder(
  db: D1Database,
  host: string,
  params: {
    orderId: string;
    email: string;
  }
): Promise<{
  success: boolean;
  code?: string;
  message: string;
  orderId?: string;
  licenseKey?: string;
  productName?: string;
  customerName?: string;
  maxDevices?: number;
  downloadUrl?: string;
}> {
  const { orderId, email } = params;

  if (!orderId || !email) {
    return {
      success: false,
      code: 'MISSING_PARAMS',
      message: 'Both Order ID and Buyer Email are required.',
    };
  }

  const cleanOrderId = orderId.trim();
  const cleanEmail = email.trim().toLowerCase();

  // Query order joined with customer and product
  const record = await db
    .prepare(
      `SELECT 
        o.id as order_uuid, o.order_id, o.status as order_status, o.customer_id, o.product_id,
        c.email as customer_email, c.full_name as customer_name,
        p.name as product_name, p.r2_object_key, p.has_license, p.max_devices
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       JOIN products p ON o.product_id = p.id
       WHERE o.order_id = ?`
    )
    .bind(cleanOrderId)
    .first<{
      order_uuid: string;
      order_id: string;
      order_status: string;
      customer_id: string;
      product_id: string;
      customer_email: string;
      customer_name: string;
      product_name: string;
      r2_object_key: string | null;
      has_license: number;
      max_devices: number;
    }>();

  if (!record) {
    return {
      success: false,
      code: 'ORDER_NOT_FOUND',
      message: 'No order found matching this Order ID. Please check your receipt or contact support.',
    };
  }

  if (record.order_status !== 'PAID') {
    return {
      success: false,
      code: 'PAYMENT_PENDING',
      message: `Order status is ${record.order_status}. A verified paid order is required to claim a license.`,
    };
  }

  if (record.customer_email.toLowerCase() !== cleanEmail) {
    return {
      success: false,
      code: 'EMAIL_MISMATCH',
      message: 'The email provided does not match the billing email registered for this order.',
    };
  }

  // Retrieve or issue license
  let licenseKey = 'N/A';
  if (record.has_license) {
    const lic = await issueLicenseForOrder(db, record.order_id, record.customer_id, record.product_id);
    licenseKey = lic.license_key;
  }

  // Retrieve or create download token (always prioritize latest active release package)
  let downloadUrl = `https://${host}/updates.html`;
  let deliverKey = record.r2_object_key;
  try {
    const rel = await db
      .prepare('SELECT r2_object_key FROM plugin_releases WHERE product_id = ? AND is_published = 1 ORDER BY is_latest DESC, release_date DESC LIMIT 1')
      .bind(record.product_id)
      .first<{ r2_object_key: string }>();
    if (rel && rel.r2_object_key) deliverKey = rel.r2_object_key;
  } catch (e) {}

  if (deliverKey) {
    const tok = await createDownloadTokenForOrder(db, record.order_id, deliverKey);
    downloadUrl = `https://${host}/api/download/${tok.token}`;
  }

  return {
    success: true,
    code: 'CLAIMED',
    message: 'Order verified successfully. License key issued.',
    orderId: record.order_id,
    licenseKey,
    productName: record.product_name,
    customerName: record.customer_name,
    maxDevices: record.max_devices || 2,
    downloadUrl,
  };
}

/**
 * Step 1: Request Claim Verification OTP
 * Verifies that the order exists, is PAID, and matches the billing email.
 * Generates an OTP, stores the SHA-256 hash in D1 with 15m expiration, and dispatches an email via Resend.
 */
export async function requestClaimVerification(
  db: D1Database,
  env: Env,
  params: {
    orderId: string;
    email: string;
  }
): Promise<{
  success: boolean;
  code?: string;
  message: string;
  orderId?: string;
  maskedEmail?: string;
  expiresInMinutes?: number;
}> {
  const { orderId, email } = params;

  if (!orderId || !email) {
    return {
      success: false,
      code: 'MISSING_PARAMS',
      message: 'Both Order ID and Billing Email are required.',
    };
  }

  const cleanOrderId = orderId.trim();
  const cleanEmail = email.trim().toLowerCase();

  // Query order joined with customer and product
  const record = await db
    .prepare(
      `SELECT 
        o.id as order_uuid, o.order_id, o.status as order_status, o.customer_id, o.product_id,
        o.final_amount_inr, o.currency,
        c.email as customer_email, c.full_name as customer_name,
        p.name as product_name
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       JOIN products p ON o.product_id = p.id
       WHERE o.order_id = ?`
    )
    .bind(cleanOrderId)
    .first<{
      order_uuid: string;
      order_id: string;
      order_status: string;
      customer_id: string;
      product_id: string;
      final_amount_inr: number;
      currency: string;
      customer_email: string;
      customer_name: string;
      product_name: string;
    }>();

  if (!record) {
    return {
      success: false,
      code: 'ORDER_NOT_FOUND',
      message: 'No order found matching this Order ID. Please check your receipt or contact support.',
    };
  }

  // If order status is PENDING, attempt real-time reconciliation with Cashfree
  if (record.order_status === 'PENDING') {
    try {
      const cfOrder = await getCashfreeOrder(env, cleanOrderId);
      if (cfOrder && cfOrder.order_status === 'PAID') {
        const expectedAmountPaise = record.final_amount_inr;
        const receivedAmountPaise = Math.round((cfOrder.order_amount || 0) * 100);
        const orderCurrency = cfOrder.order_currency || 'INR';

        if (orderCurrency === 'INR' && receivedAmountPaise >= expectedAmountPaise) {
          await updateOrderStatus(db, cleanOrderId, 'PAID', new Date().toISOString());
          record.order_status = 'PAID';
        } else {
          console.error(`[Claim Verification] Cashfree amount/currency mismatch for ${cleanOrderId}: expected ${expectedAmountPaise} paise INR, got ${receivedAmountPaise} paise ${orderCurrency}`);
        }
      }
    } catch (e) {
      console.error('[Claim Verification] Cashfree status check error:', e);
    }
  }

  if (record.order_status !== 'PAID') {
    return {
      success: false,
      code: 'PAYMENT_PENDING',
      message: `Order status is ${record.order_status}. A verified paid order is required to claim a license.`,
    };
  }

  if (record.customer_email.toLowerCase() !== cleanEmail) {
    return {
      success: false,
      code: 'EMAIL_MISMATCH',
      message: 'The email provided does not match the billing email registered for this order.',
    };
  }

  // Invalidate any existing unconsumed claim verifications for this order
  await db
    .prepare('UPDATE claim_verifications SET is_consumed = 1 WHERE order_id = ? AND is_consumed = 0')
    .bind(cleanOrderId)
    .run();

  // Generate 6-digit numeric OTP (cryptographically unbiased CSPRNG rejection sampling)
  const limit = Math.floor(0xFFFFFFFF / 900000) * 900000; // 4,294,800,000
  const array = new Uint32Array(1);
  do {
    crypto.getRandomValues(array);
  } while (array[0] >= limit);
  const otp = String(100000 + (array[0] % 900000));
  const otpHash = await hashString(otp);

  const verificationId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await db
    .prepare(
      `INSERT INTO claim_verifications (
        id, order_id, email, otp_hash, attempt_count, max_attempts, is_consumed, expires_at
      ) VALUES (?, ?, ?, ?, 0, 5, 0, ?)`
    )
    .bind(verificationId, cleanOrderId, record.customer_email.toLowerCase(), otpHash, expiresAt)
    .run();

  // Dispatch OTP email via Resend
  try {
    await dispatchClaimOtpEmail(db, env, {
      orderId: cleanOrderId,
      customerEmail: record.customer_email,
      customerName: record.customer_name || 'Customer',
      otp,
      expiresMinutes: 15,
    });
  } catch (err: any) {
    console.error('[Claim OTP Email Dispatch Error]:', err);
  }

  const masked = maskEmail(record.customer_email);

  return {
    success: true,
    code: 'OTP_SENT',
    message: `Verification code sent to ${masked}. Please enter the 6-digit code to claim your license.`,
    orderId: cleanOrderId,
    maskedEmail: masked,
    expiresInMinutes: 15,
  };
}

/**
 * Step 2: Confirm Claim Verification OTP & Issue License
 * Verifies the 6-digit OTP against the stored SHA-256 hash.
 * Checks expiration (15m) and attempts (max 5).
 * Atomically marks is_consumed = 1, retrieves/issues license, and generates 48h R2 token.
 */
export async function confirmClaimVerification(
  db: D1Database,
  env: Env,
  host: string,
  params: {
    orderId: string;
    email: string;
    otp: string;
  }
): Promise<{
  success: boolean;
  code?: string;
  message: string;
  orderId?: string;
  licenseKey?: string;
  productName?: string;
  customerName?: string;
  maxDevices?: number;
  downloadUrl?: string;
  remainingAttempts?: number;
}> {
  const { orderId, email, otp } = params;

  if (!orderId || !email || !otp) {
    return {
      success: false,
      code: 'MISSING_PARAMS',
      message: 'Order ID, Billing Email, and 6-digit Verification Code are all required.',
    };
  }

  const cleanOrderId = orderId.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = String(otp).trim();

  if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
    return {
      success: false,
      code: 'INVALID_FORMAT',
      message: 'Verification code must be exactly 6 digits.',
    };
  }

  // Find the active unconsumed verification for this order and email
  const verification = await db
    .prepare(
      `SELECT * FROM claim_verifications 
       WHERE order_id = ? AND email = ? AND is_consumed = 0 
       ORDER BY created_at DESC LIMIT 1`
    )
    .bind(cleanOrderId, cleanEmail)
    .first<{
      id: string;
      order_id: string;
      email: string;
      otp_hash: string;
      attempt_count: number;
      max_attempts: number;
      is_consumed: number;
      expires_at: string;
      created_at: string;
    }>();

  if (!verification) {
    // Check if an OTP was previously consumed or if no OTP was requested
    const anyRecord = await db
      .prepare('SELECT id, is_consumed FROM claim_verifications WHERE order_id = ? ORDER BY created_at DESC LIMIT 1')
      .bind(cleanOrderId)
      .first<{ id: string; is_consumed: number }>();

    if (anyRecord && anyRecord.is_consumed === 1) {
      return {
        success: false,
        code: 'TOKEN_ALREADY_USED',
        message: 'This verification code has already been used or has expired. Please request a new code.',
      };
    }

    return {
      success: false,
      code: 'NO_PENDING_CLAIM',
      message: 'No pending verification request found. Please enter your email to receive a verification code.',
    };
  }

  // Check Expiration
  if (new Date(verification.expires_at).getTime() < Date.now()) {
    await db.prepare('UPDATE claim_verifications SET is_consumed = 1 WHERE id = ?').bind(verification.id).run();
    return {
      success: false,
      code: 'OTP_EXPIRED',
      message: 'Verification code has expired (15-minute validity). Please request a new code.',
    };
  }

  // Check Attempt Limits
  if (verification.attempt_count >= verification.max_attempts) {
    await db.prepare('UPDATE claim_verifications SET is_consumed = 1 WHERE id = ?').bind(verification.id).run();
    return {
      success: false,
      code: 'MAX_ATTEMPTS_EXCEEDED',
      message: 'Too many incorrect attempts. For security, this code has been invalidated. Please request a new code.',
    };
  }

  // Hash user-provided OTP and compare
  const incomingHash = await hashString(cleanOtp);
  if (incomingHash !== verification.otp_hash) {
    const newCount = verification.attempt_count + 1;
    await db
      .prepare('UPDATE claim_verifications SET attempt_count = ? WHERE id = ?')
      .bind(newCount, verification.id)
      .run();

    const remaining = Math.max(0, verification.max_attempts - newCount);
    if (remaining === 0) {
      await db.prepare('UPDATE claim_verifications SET is_consumed = 1 WHERE id = ?').bind(verification.id).run();
      return {
        success: false,
        code: 'MAX_ATTEMPTS_EXCEEDED',
        message: 'Too many incorrect attempts. For security, this code has been invalidated. Please request a new code.',
        remainingAttempts: 0,
      };
    }

    return {
      success: false,
      code: 'INVALID_OTP',
      message: `Invalid verification code. Please check your email and try again (${remaining} attempts remaining).`,
      remainingAttempts: remaining,
    };
  }

  // ATOMIC CONSUMPTION: mark is_consumed = 1
  const updateRes = await db
    .prepare('UPDATE claim_verifications SET is_consumed = 1 WHERE id = ? AND is_consumed = 0')
    .bind(verification.id)
    .run();

  if (updateRes.meta.changes === 0) {
    return {
      success: false,
      code: 'TOKEN_ALREADY_USED',
      message: 'Verification code was already consumed.',
    };
  }

  // Query order details
  const record = await db
    .prepare(
      `SELECT 
        o.id as order_uuid, o.order_id, o.status as order_status, o.customer_id, o.product_id,
        c.email as customer_email, c.full_name as customer_name,
        p.name as product_name, p.r2_object_key, p.has_license, p.max_devices
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       JOIN products p ON o.product_id = p.id
       WHERE o.order_id = ?`
    )
    .bind(cleanOrderId)
    .first<{
      order_uuid: string;
      order_id: string;
      order_status: string;
      customer_id: string;
      product_id: string;
      customer_email: string;
      customer_name: string;
      product_name: string;
      r2_object_key: string | null;
      has_license: number;
      max_devices: number;
    }>();

  if (!record) {
    return {
      success: false,
      code: 'ORDER_NOT_FOUND',
      message: 'Associated order could not be located.',
    };
  }

  // Retrieve or issue license
  let licenseKey = 'N/A';
  if (record.has_license) {
    const lic = await issueLicenseForOrder(db, record.order_id, record.customer_id, record.product_id);
    licenseKey = lic.license_key;
  }

  // Retrieve or create download token (always prioritize latest active release package)
  let downloadUrl = `https://${host}/updates.html`;
  let deliverKey = record.r2_object_key;
  try {
    const rel = await db
      .prepare('SELECT r2_object_key FROM plugin_releases WHERE product_id = ? AND is_published = 1 ORDER BY is_latest DESC, release_date DESC LIMIT 1')
      .bind(record.product_id)
      .first<{ r2_object_key: string }>();
    if (rel && rel.r2_object_key) deliverKey = rel.r2_object_key;
  } catch (e) {}

  if (deliverKey) {
    const tok = await createDownloadTokenForOrder(db, record.order_id, deliverKey);
    downloadUrl = `https://${host}/api/download/${tok.token}`;
  }

  // Dispatch Confirmation Email (Non-blocking)
  if (licenseKey !== 'N/A') {
    try {
      await dispatchLicenseClaimedEmail(db, env, {
        orderId: record.order_id,
        customerEmail: record.customer_email,
        customerName: record.customer_name || 'Customer',
        productName: record.product_name,
        licenseKey,
        maxDevices: record.max_devices || 2,
      });
    } catch (err: any) {
      console.error('[Claim Confirmation Email Dispatch Error]:', err);
    }
  }

  return {
    success: true,
    code: 'CLAIMED',
    message: 'Order verified successfully. License key issued.',
    orderId: record.order_id,
    licenseKey,
    productName: record.product_name,
    customerName: record.customer_name,
    maxDevices: record.max_devices || 2,
    downloadUrl,
  };
}

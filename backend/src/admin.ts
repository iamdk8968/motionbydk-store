/**
 * Motion By DK — Merchant Admin Dashboard & Observability Backend
 * Module: backend/src/admin.ts
 */

import { Env, AdminUserRecord, AdminJwtPayload, EmailType } from './types';
import {
  dispatchOrderReceiptEmail,
  dispatchLicenseClaimedEmail,
  dispatchDownloadDeliveryEmail,
} from './email';
import { createDownloadTokenForOrder, getLicenseByOrder, getDownloadTokenByOrder } from './db';

const STAGING_ADMIN_SECRET = 'mdk_admin_secret_staging_2026_motionbydk_vault';

export function getAdminJwtSecret(env: Env): string {
  return env.ADMIN_JWT_SECRET || STAGING_ADMIN_SECRET;
}

// =============================================================================
// CRYPTOGRAPHY & TOKEN UTILITIES (Pure Web Crypto API)
// =============================================================================

function base64UrlEncode(data: Uint8Array | string): string {
  const str = typeof data === 'string' ? data : String.fromCharCode(...data);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return atob(s);
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Verify PBKDF2 with SHA-256 password hash against stored salt & hash
 */
export async function verifyPbkdf2Password(
  password: string,
  saltHex: string,
  expectedHashHex: string
): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const saltMatches = saltHex.match(/.{1,2}/g);
    if (!saltMatches) return false;
    const salt = new Uint8Array(saltMatches.map((b) => parseInt(b, 16)));

    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      key,
      256
    );

    const derivedHex = Array.from(new Uint8Array(bits))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return derivedHex.toLowerCase() === expectedHashHex.toLowerCase();
  } catch (err) {
    console.error('PBKDF2 verification error:', err);
    return false;
  }
}

/**
 * Sign Admin JWT using HMAC-SHA256
 */
export async function signAdminJwt(payload: AdminJwtPayload, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${headerB64}.${payloadB64}`;
  const key = await getHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(dataToSign));
  const sigB64 = base64UrlEncode(new Uint8Array(sig));
  return `${dataToSign}.${sigB64}`;
}

/**
 * Verify and decode Admin JWT
 */
export async function verifyAdminJwt(token: string, secret: string): Promise<AdminJwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const dataToSign = `${headerB64}.${payloadB64}`;
    const enc = new TextEncoder();
    const key = await getHmacKey(secret);

    const rawSig = base64UrlDecode(sigB64);
    const sigBytes = new Uint8Array(rawSig.length);
    for (let i = 0; i < rawSig.length; i++) {
      sigBytes[i] = rawSig.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(dataToSign));
    if (!isValid) return null;

    const payload: AdminJwtPayload = JSON.parse(base64UrlDecode(payloadB64));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Audit Log Helper
 */
export async function logAuditEvent(
  db: D1Database,
  actorId: string,
  action: string,
  targetType: string | null,
  targetId: string | null,
  details: Record<string, any> | string | null,
  ipAddress: string | null
): Promise<void> {
  try {
    const id = crypto.randomUUID();
    const detailsStr = details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null;
    await db
      .prepare(
        `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .bind(id, actorId, action, targetType, targetId, detailsStr, ipAddress)
      .run();
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
}

/**
 * Middleware: Verify Admin Authorization
 */
export async function authenticateAdmin(
  request: Request,
  env: Env
): Promise<{ valid: boolean; user?: AdminJwtPayload; error?: string }> {
  const authHeader = request.headers.get('Authorization') || request.headers.get('x-admin-token');
  if (!authHeader) {
    return { valid: false, error: 'Authorization header missing' };
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  if (!token) {
    return { valid: false, error: 'Empty bearer token' };
  }

  const secret = getAdminJwtSecret(env);
  const payload = await verifyAdminJwt(token, secret);

  if (!payload) {
    return { valid: false, error: 'Invalid or expired admin session token' };
  }

  return { valid: true, user: payload };
}

// Helper for standard JSON responses
function adminJsonResponse(data: unknown, status = 200, corsHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      ...corsHeaders,
    },
  });
}

// =============================================================================
// ADMIN CONTROLLERS
// =============================================================================

/**
 * POST /api/admin/login
 */
export async function handleAdminLogin(
  request: Request,
  env: Env,
  clientIp: string,
  corsHeaders: HeadersInit
): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      username?: string;
      password?: string;
    };

    const username = (body.username || '').trim().toLowerCase();
    const password = body.password || '';

    if (!username || !password) {
      return adminJsonResponse(
        { success: false, error: 'Username and password are required.' },
        400,
        corsHeaders
      );
    }

    const admin = await env.DB.prepare(
      `SELECT id, username, password_hash, salt, full_name, role 
       FROM admin_users 
       WHERE LOWER(username) = ?`
    )
      .bind(username)
      .first<AdminUserRecord>();

    if (!admin) {
      await logAuditEvent(env.DB, username || 'UNKNOWN', 'LOGIN_FAILED', 'AUTH', username, { reason: 'USER_NOT_FOUND' }, clientIp);
      return adminJsonResponse(
        { success: false, error: 'Invalid username or password.' },
        401,
        corsHeaders
      );
    }

    const isMatch = await verifyPbkdf2Password(password, admin.salt, admin.password_hash);
    if (!isMatch) {
      await logAuditEvent(env.DB, admin.username, 'LOGIN_FAILED', 'AUTH', admin.username, { reason: 'PASSWORD_MISMATCH' }, clientIp);
      return adminJsonResponse(
        { success: false, error: 'Invalid username or password.' },
        401,
        corsHeaders
      );
    }

    // Update last login
    await env.DB.prepare(`UPDATE admin_users SET last_login_at = datetime('now') WHERE id = ?`)
      .bind(admin.id)
      .run();

    const secret = getAdminJwtSecret(env);
    const now = Math.floor(Date.now() / 1000);
    const token = await signAdminJwt(
      {
        sub: admin.username,
        name: admin.full_name,
        role: admin.role,
        iat: now,
        exp: now + 86400 * 7, // 7-day token
      },
      secret
    );

    await logAuditEvent(env.DB, admin.username, 'LOGIN_SUCCESS', 'AUTH', admin.username, { role: admin.role }, clientIp);

    return adminJsonResponse(
      {
        success: true,
        message: 'Authentication successful.',
        token,
        admin: {
          username: admin.username,
          full_name: admin.full_name,
          role: admin.role,
        },
      },
      200,
      corsHeaders
    );
  } catch (err: any) {
    console.error('Admin login error:', err);
    return adminJsonResponse({ success: false, error: err.message || 'Login failed.' }, 500, corsHeaders);
  }
}

/**
 * GET /api/admin/me
 */
export async function handleAdminMe(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const auth = await authenticateAdmin(request, env);
  if (!auth.valid || !auth.user) {
    return adminJsonResponse({ success: false, error: auth.error || 'Unauthorized' }, 401, corsHeaders);
  }

  return adminJsonResponse(
    {
      success: true,
      admin: auth.user,
    },
    200,
    corsHeaders
  );
}

/**
 * GET /api/admin/metrics
 * Observability, revenue KPIs, license and email statistics
 */
export async function handleAdminMetrics(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const auth = await authenticateAdmin(request, env);
  if (!auth.valid) {
    return adminJsonResponse({ success: false, error: auth.error || 'Unauthorized' }, 401, corsHeaders);
  }

  try {
    // 1. Revenue & Order Status Breakdown
    const revenueRes = await env.DB.prepare(
      `SELECT 
         COALESCE(SUM(CASE WHEN status = 'PAID' THEN final_amount_inr ELSE 0 END), 0) AS total_revenue_paise,
         COALESCE(SUM(CASE WHEN status = 'PAID' AND datetime(paid_at) >= datetime('now', '-24 hours') THEN final_amount_inr ELSE 0 END), 0) AS revenue_24h_paise,
         COALESCE(SUM(CASE WHEN status = 'PAID' AND datetime(paid_at) >= datetime('now', '-7 days') THEN final_amount_inr ELSE 0 END), 0) AS revenue_7d_paise,
         COALESCE(SUM(CASE WHEN status = 'PAID' AND datetime(paid_at) >= datetime('now', '-30 days') THEN final_amount_inr ELSE 0 END), 0) AS revenue_30d_paise,
         COUNT(*) AS total_orders,
         SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) AS paid_orders,
         SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending_orders,
         SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed_orders
       FROM orders`
    ).first<any>();

    // 2. Licenses & Hardware Activations
    const licenseRes = await env.DB.prepare(
      `SELECT 
         COUNT(*) AS total_licenses,
         SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_licenses,
         SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS revoked_licenses,
         SUM(CASE WHEN is_legacy = 1 THEN 1 ELSE 0 END) AS legacy_licenses,
         SUM(CASE WHEN is_legacy = 0 THEN 1 ELSE 0 END) AS commercial_licenses
       FROM licenses`
    ).first<any>();

    const devicesRes = await env.DB.prepare(
      `SELECT 
         COUNT(*) AS active_devices,
         COUNT(DISTINCT license_key) AS licenses_with_devices
       FROM license_activations 
       WHERE is_active = 1`
    ).first<any>();

    // 3. Email Observability
    const emailRes = await env.DB.prepare(
      `SELECT 
         COUNT(*) AS total_dispatched,
         SUM(CASE WHEN status IN ('SENT', 'ACCEPTED', 'MOCK_SENT') THEN 1 ELSE 0 END) AS successful_emails,
         SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed_emails,
         SUM(CASE WHEN status = 'MOCK_SENT' THEN 1 ELSE 0 END) AS mock_sent_emails
       FROM email_delivery_logs`
    ).first<any>();

    // 4. Product Sales Breakdown
    const productStats = await env.DB.prepare(
      `SELECT 
         p.id, 
         p.name, 
         COUNT(o.id) AS sales_count,
         COALESCE(SUM(o.final_amount_inr), 0) AS revenue_paise
       FROM products p
       LEFT JOIN orders o ON p.id = o.product_id AND o.status = 'PAID'
       GROUP BY p.id
       ORDER BY revenue_paise DESC`
    ).all<any>();

    // 5. Recent 5 Orders Activity
    const recentOrders = await env.DB.prepare(
      `SELECT 
         o.order_id, 
         o.status, 
         o.final_amount_inr, 
         o.created_at, 
         o.paid_at, 
         c.email AS customer_email, 
         c.full_name AS customer_name, 
         p.name AS product_name
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       JOIN products p ON o.product_id = p.id
       ORDER BY o.created_at DESC
       LIMIT 5`
    ).all<any>();

    // 6. Recent 5 Hardware Device Activations
    const recentActivations = await env.DB.prepare(
      `SELECT 
         la.license_key, 
         la.machine_id, 
         la.machine_name, 
         la.os, 
         la.is_active, 
         la.activated_at
       FROM license_activations la
       ORDER BY la.activated_at DESC
       LIMIT 5`
    ).all<any>();

    const totalOrders = Number(revenueRes?.total_orders || 0);
    const paidOrders = Number(revenueRes?.paid_orders || 0);
    const conversionRate = totalOrders > 0 ? ((paidOrders / totalOrders) * 100).toFixed(1) : '0.0';

    const totalEmails = Number(emailRes?.total_dispatched || 0);
    const successEmails = Number(emailRes?.successful_emails || 0);
    const emailSuccessRate = totalEmails > 0 ? ((successEmails / totalEmails) * 100).toFixed(1) : '100.0';

    return adminJsonResponse(
      {
        success: true,
        metrics: {
          revenue: {
            totalPaise: Number(revenueRes?.total_revenue_paise || 0),
            totalInrFormatted: `₹${(Number(revenueRes?.total_revenue_paise || 0) / 100).toFixed(2)}`,
            revenue24hInr: `₹${(Number(revenueRes?.revenue_24h_paise || 0) / 100).toFixed(2)}`,
            revenue7dInr: `₹${(Number(revenueRes?.revenue_7d_paise || 0) / 100).toFixed(2)}`,
            revenue30dInr: `₹${(Number(revenueRes?.revenue_30d_paise || 0) / 100).toFixed(2)}`,
          },
          orders: {
            total: totalOrders,
            paid: paidOrders,
            pending: Number(revenueRes?.pending_orders || 0),
            failed: Number(revenueRes?.failed_orders || 0),
            conversionRatePercent: conversionRate,
          },
          licenses: {
            total: Number(licenseRes?.total_licenses || 0),
            active: Number(licenseRes?.active_licenses || 0),
            revoked: Number(licenseRes?.revoked_licenses || 0),
            legacy: Number(licenseRes?.legacy_licenses || 0),
            commercial: Number(licenseRes?.commercial_licenses || 0),
          },
          devices: {
            activeHardwareSlots: Number(devicesRes?.active_devices || 0),
            licensesWithDevices: Number(devicesRes?.licenses_with_devices || 0),
          },
          emails: {
            totalDispatched: totalEmails,
            successful: successEmails,
            failed: Number(emailRes?.failed_emails || 0),
            mockSent: Number(emailRes?.mock_sent_emails || 0),
            deliveryRatePercent: emailSuccessRate,
          },
          productsBreakdown: (productStats.results || []).map((p) => ({
            id: p.id,
            name: p.name,
            salesCount: Number(p.sales_count || 0),
            revenueInr: `₹${(Number(p.revenue_paise || 0) / 100).toFixed(2)}`,
          })),
          recentOrders: recentOrders.results || [],
          recentActivations: recentActivations.results || [],
        },
      },
      200,
      corsHeaders
    );
  } catch (err: any) {
    console.error('Admin metrics aggregation error:', err);
    return adminJsonResponse({ success: false, error: err.message }, 500, corsHeaders);
  }
}

/**
 * GET /api/admin/orders
 * Paginated order directory with status filter and search
 */
export async function handleAdminOrders(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const auth = await authenticateAdmin(request, env);
  if (!auth.valid) {
    return adminJsonResponse({ success: false, error: auth.error || 'Unauthorized' }, 401, corsHeaders);
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25', 10)));
  const offset = (page - 1) * limit;
  const statusFilter = (url.searchParams.get('status') || 'ALL').toUpperCase();
  const search = (url.searchParams.get('search') || '').trim();

  let whereClauses: string[] = ['1=1'];
  let bindings: any[] = [];

  if (statusFilter !== 'ALL') {
    whereClauses.push('o.status = ?');
    bindings.push(statusFilter);
  }

  if (search) {
    whereClauses.push('(o.order_id LIKE ? OR c.email LIKE ? OR c.full_name LIKE ? OR c.phone LIKE ?)');
    const term = `%${search}%`;
    bindings.push(term, term, term, term);
  }

  const whereSql = whereClauses.join(' AND ');

  try {
    // Total count
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      JOIN products p ON o.product_id = p.id
      WHERE ${whereSql}
    `;
    const countRes = await env.DB.prepare(countQuery).bind(...bindings).first<{ total: number }>();
    const total = Number(countRes?.total || 0);

    // Data query
    const dataQuery = `
      SELECT 
        o.id,
        o.order_id,
        o.customer_id,
        o.product_id,
        o.coupon_code,
        o.base_amount_inr,
        o.discount_inr,
        o.final_amount_inr,
        o.currency,
        o.status,
        o.cf_payment_session_id,
        o.paid_at,
        o.created_at,
        c.email AS customer_email,
        c.full_name AS customer_name,
        c.phone AS customer_phone,
        p.name AS product_name,
        (SELECT COUNT(*) FROM payments WHERE order_id = o.order_id AND payment_status = 'SUCCESS') AS successful_payments_count,
        (SELECT license_key FROM licenses WHERE order_id = o.order_id LIMIT 1) AS license_key
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      JOIN products p ON o.product_id = p.id
      WHERE ${whereSql}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const dataRes = await env.DB.prepare(dataQuery)
      .bind(...bindings, limit, offset)
      .all<any>();

    const orders = (dataRes.results || []).map((o) => ({
      ...o,
      finalAmountInrFormatted: `₹${(o.final_amount_inr / 100).toFixed(2)}`,
      baseAmountInrFormatted: `₹${(o.base_amount_inr / 100).toFixed(2)}`,
      discountInrFormatted: `₹${(o.discount_inr / 100).toFixed(2)}`,
    }));

    return adminJsonResponse(
      {
        success: true,
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      200,
      corsHeaders
    );
  } catch (err: any) {
    console.error('Admin orders query error:', err);
    return adminJsonResponse({ success: false, error: err.message }, 500, corsHeaders);
  }
}

/**
 * GET /api/admin/orders/:order_id
 * Full Order Dossier
 */
export async function handleAdminOrderDetail(
  request: Request,
  env: Env,
  orderId: string,
  corsHeaders: HeadersInit
): Promise<Response> {
  const auth = await authenticateAdmin(request, env);
  if (!auth.valid) {
    return adminJsonResponse({ success: false, error: auth.error || 'Unauthorized' }, 401, corsHeaders);
  }

  try {
    const order = await env.DB.prepare(
      `SELECT 
         o.*, 
         c.email AS customer_email, 
         c.full_name AS customer_name, 
         c.phone AS customer_phone, 
         p.name AS product_name,
         p.has_license,
         p.max_devices
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       JOIN products p ON o.product_id = p.id
       WHERE o.order_id = ?`
    )
      .bind(orderId)
      .first<any>();

    if (!order) {
      return adminJsonResponse({ success: false, error: 'Order not found.' }, 404, corsHeaders);
    }

    const payments = await env.DB.prepare(
      `SELECT id, cf_payment_id, payment_method, payment_amount_inr, payment_status, payment_time, bank_reference, created_at 
       FROM payments 
       WHERE order_id = ? 
       ORDER BY created_at DESC`
    )
      .bind(orderId)
      .all<any>();

    const license = await env.DB.prepare(
      `SELECT * FROM licenses WHERE order_id = ?`
    )
      .bind(orderId)
      .first<any>();

    let licenseActivations: any[] = [];
    if (license) {
      const actRes = await env.DB.prepare(
        `SELECT * FROM license_activations WHERE license_key = ? ORDER BY activated_at DESC`
      )
        .bind(license.license_key)
        .all<any>();
      licenseActivations = actRes.results || [];
    }

    const downloadTokens = await env.DB.prepare(
      `SELECT * FROM download_tokens WHERE order_id = ? ORDER BY created_at DESC`
    )
      .bind(orderId)
      .all<any>();

    const emailLogs = await env.DB.prepare(
      `SELECT * FROM email_delivery_logs WHERE order_id = ? ORDER BY created_at DESC`
    )
      .bind(orderId)
      .all<any>();

    const paymentEvents = await env.DB.prepare(
      `SELECT id, event_id, event_type, signature_verified, processed_at FROM payment_events WHERE order_id = ? ORDER BY processed_at DESC`
    )
      .bind(orderId)
      .all<any>();

    return adminJsonResponse(
      {
        success: true,
        order: {
          ...order,
          finalAmountInrFormatted: `₹${(order.final_amount_inr / 100).toFixed(2)}`,
        },
        payments: payments.results || [],
        license: license
          ? {
              ...license,
              activations: licenseActivations,
              activeDevicesCount: licenseActivations.filter((a) => a.is_active === 1).length,
            }
          : null,
        downloadTokens: downloadTokens.results || [],
        emailLogs: emailLogs.results || [],
        paymentEvents: paymentEvents.results || [],
      },
      200,
      corsHeaders
    );
  } catch (err: any) {
    console.error('Admin order detail error:', err);
    return adminJsonResponse({ success: false, error: err.message }, 500, corsHeaders);
  }
}

/**
 * GET /api/admin/licenses
 * Searchable licenses directory with active machine status
 */
export async function handleAdminLicenses(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const auth = await authenticateAdmin(request, env);
  if (!auth.valid) {
    return adminJsonResponse({ success: false, error: auth.error || 'Unauthorized' }, 401, corsHeaders);
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25', 10)));
  const offset = (page - 1) * limit;
  const typeFilter = (url.searchParams.get('type') || 'ALL').toUpperCase();
  const search = (url.searchParams.get('search') || '').trim();

  let whereClauses: string[] = ['1=1'];
  let bindings: any[] = [];

  if (typeFilter === 'COMMERCIAL') {
    whereClauses.push('l.is_legacy = 0');
  } else if (typeFilter === 'LEGACY') {
    whereClauses.push('l.is_legacy = 1');
  } else if (typeFilter === 'REVOKED') {
    whereClauses.push('l.is_active = 0');
  }

  if (search) {
    whereClauses.push('(l.license_key LIKE ? OR c.email LIKE ? OR c.full_name LIKE ? OR l.order_id LIKE ?)');
    const term = `%${search}%`;
    bindings.push(term, term, term, term);
  }

  const whereSql = whereClauses.join(' AND ');

  try {
    const countRes = await env.DB.prepare(
      `SELECT COUNT(*) AS total
       FROM licenses l
       LEFT JOIN customers c ON l.customer_id = c.id
       WHERE ${whereSql}`
    )
      .bind(...bindings)
      .first<{ total: number }>();
    const total = Number(countRes?.total || 0);

    const licensesRes = await env.DB.prepare(
      `SELECT 
         l.id,
         l.license_key,
         l.order_id,
         l.customer_id,
         l.product_id,
         l.max_devices,
         l.is_active,
         l.revocation_reason,
         l.is_legacy,
         l.note,
         l.created_at,
         l.updated_at,
         c.email AS customer_email,
         c.full_name AS customer_name,
         p.name AS product_name,
         (SELECT COUNT(*) FROM license_activations WHERE license_key = l.license_key AND is_active = 1) AS active_devices_count
       FROM licenses l
       LEFT JOIN customers c ON l.customer_id = c.id
       LEFT JOIN products p ON l.product_id = p.id
       WHERE ${whereSql}
       ORDER BY l.created_at DESC
       LIMIT ? OFFSET ?`
    )
      .bind(...bindings, limit, offset)
      .all<any>();

    return adminJsonResponse(
      {
        success: true,
        licenses: licensesRes.results || [],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      200,
      corsHeaders
    );
  } catch (err: any) {
    console.error('Admin licenses query error:', err);
    return adminJsonResponse({ success: false, error: err.message }, 500, corsHeaders);
  }
}

/**
 * GET /api/admin/licenses/:license_key
 * License Detail & Hardware Activations
 */
export async function handleAdminLicenseDetail(
  request: Request,
  env: Env,
  licenseKey: string,
  corsHeaders: HeadersInit
): Promise<Response> {
  const auth = await authenticateAdmin(request, env);
  if (!auth.valid) {
    return adminJsonResponse({ success: false, error: auth.error || 'Unauthorized' }, 401, corsHeaders);
  }

  try {
    const license = await env.DB.prepare(
      `SELECT 
         l.*, 
         c.email AS customer_email, 
         c.full_name AS customer_name, 
         p.name AS product_name
       FROM licenses l
       LEFT JOIN customers c ON l.customer_id = c.id
       LEFT JOIN products p ON l.product_id = p.id
       WHERE l.license_key = ?`
    )
      .bind(licenseKey)
      .first<any>();

    if (!license) {
      return adminJsonResponse({ success: false, error: 'License not found.' }, 404, corsHeaders);
    }

    const activations = await env.DB.prepare(
      `SELECT * FROM license_activations WHERE license_key = ? ORDER BY activated_at DESC`
    )
      .bind(licenseKey)
      .all<any>();

    return adminJsonResponse(
      {
        success: true,
        license: {
          ...license,
          activations: activations.results || [],
          activeDevicesCount: (activations.results || []).filter((a) => a.is_active === 1).length,
        },
      },
      200,
      corsHeaders
    );
  } catch (err: any) {
    console.error('Admin license detail error:', err);
    return adminJsonResponse({ success: false, error: err.message }, 500, corsHeaders);
  }
}

/**
 * POST /api/admin/licenses/reset-devices
 * Frees 2-PC hardware activation locks for a customer
 */
export async function handleAdminResetDevices(
  request: Request,
  env: Env,
  adminUser: string,
  clientIp: string,
  corsHeaders: HeadersInit
): Promise<Response> {
  const auth = await authenticateAdmin(request, env);
  if (!auth.valid) {
    return adminJsonResponse({ success: false, error: auth.error || 'Unauthorized' }, 401, corsHeaders);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      license_key?: string;
      reason?: string;
    };

    const licenseKey = (body.license_key || '').trim();
    const reason = (body.reason || 'Admin hardware reset').trim();

    if (!licenseKey) {
      return adminJsonResponse({ success: false, error: 'License key is required.' }, 400, corsHeaders);
    }

    // Verify license exists
    const license = await env.DB.prepare(`SELECT id, license_key, max_devices FROM licenses WHERE license_key = ?`)
      .bind(licenseKey)
      .first<any>();

    if (!license) {
      return adminJsonResponse({ success: false, error: 'License not found.' }, 404, corsHeaders);
    }

    // Deactivate all currently active activations
    const updateRes = await env.DB.prepare(
      `UPDATE license_activations 
       SET is_active = 0, deactivated_at = datetime('now') 
       WHERE license_key = ? AND is_active = 1`
    )
      .bind(licenseKey)
      .run();

    await logAuditEvent(
      env.DB,
      adminUser,
      'RESET_DEVICES',
      'LICENSE',
      licenseKey,
      { reason, resetRows: updateRes.meta.changes },
      clientIp
    );

    return adminJsonResponse(
      {
        success: true,
        message: `Device hardware lock reset successfully. All ${updateRes.meta.changes} active device slots freed.`,
        resetCount: updateRes.meta.changes,
      },
      200,
      corsHeaders
    );
  } catch (err: any) {
    console.error('Reset devices error:', err);
    return adminJsonResponse({ success: false, error: err.message }, 500, corsHeaders);
  }
}

/**
 * POST /api/admin/licenses/revoke
 * Revokes a license key with mandatory reason and deactivates active machines
 */
export async function handleAdminRevokeLicense(
  request: Request,
  env: Env,
  adminUser: string,
  clientIp: string,
  corsHeaders: HeadersInit
): Promise<Response> {
  const auth = await authenticateAdmin(request, env);
  if (!auth.valid) {
    return adminJsonResponse({ success: false, error: auth.error || 'Unauthorized' }, 401, corsHeaders);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      license_key?: string;
      reason?: string;
    };

    const licenseKey = (body.license_key || '').trim();
    const reason = (body.reason || '').trim();

    if (!licenseKey || !reason) {
      return adminJsonResponse(
        { success: false, error: 'License key and a specific revocation reason are required.' },
        400,
        corsHeaders
      );
    }

    const license = await env.DB.prepare(`SELECT id, license_key, is_active FROM licenses WHERE license_key = ?`)
      .bind(licenseKey)
      .first<any>();

    if (!license) {
      return adminJsonResponse({ success: false, error: 'License not found.' }, 404, corsHeaders);
    }

    // 1. Mark license as revoked
    await env.DB.prepare(
      `UPDATE licenses 
       SET is_active = 0, revocation_reason = ?, updated_at = datetime('now') 
       WHERE license_key = ?`
    )
      .bind(reason, licenseKey)
      .run();

    // 2. Deactivate active devices
    await env.DB.prepare(
      `UPDATE license_activations 
       SET is_active = 0, deactivated_at = datetime('now') 
       WHERE license_key = ? AND is_active = 1`
    )
      .bind(licenseKey)
      .run();

    await logAuditEvent(
      env.DB,
      adminUser,
      'REVOKE_LICENSE',
      'LICENSE',
      licenseKey,
      { reason },
      clientIp
    );

    return adminJsonResponse(
      {
        success: true,
        message: `License ${licenseKey} has been revoked successfully.`,
      },
      200,
      corsHeaders
    );
  } catch (err: any) {
    console.error('Revoke license error:', err);
    return adminJsonResponse({ success: false, error: err.message }, 500, corsHeaders);
  }
}

/**
 * POST /api/admin/licenses/reinstate
 * Reinstates a previously revoked license key
 */
export async function handleAdminReinstateLicense(
  request: Request,
  env: Env,
  adminUser: string,
  clientIp: string,
  corsHeaders: HeadersInit
): Promise<Response> {
  const auth = await authenticateAdmin(request, env);
  if (!auth.valid) {
    return adminJsonResponse({ success: false, error: auth.error || 'Unauthorized' }, 401, corsHeaders);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      license_key?: string;
      reason?: string;
    };

    const licenseKey = (body.license_key || '').trim();
    const reason = (body.reason || 'Admin reinstatement').trim();

    if (!licenseKey) {
      return adminJsonResponse({ success: false, error: 'License key is required.' }, 400, corsHeaders);
    }

    await env.DB.prepare(
      `UPDATE licenses 
       SET is_active = 1, revocation_reason = NULL, updated_at = datetime('now') 
       WHERE license_key = ?`
    )
      .bind(licenseKey)
      .run();

    await logAuditEvent(
      env.DB,
      adminUser,
      'REINSTATE_LICENSE',
      'LICENSE',
      licenseKey,
      { reason },
      clientIp
    );

    return adminJsonResponse(
      {
        success: true,
        message: `License ${licenseKey} reinstated successfully.`,
      },
      200,
      corsHeaders
    );
  } catch (err: any) {
    console.error('Reinstate license error:', err);
    return adminJsonResponse({ success: false, error: err.message }, 500, corsHeaders);
  }
}

/**
 * GET /api/admin/emails
 * Paginated email delivery logs
 */
export async function handleAdminEmails(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const auth = await authenticateAdmin(request, env);
  if (!auth.valid) {
    return adminJsonResponse({ success: false, error: auth.error || 'Unauthorized' }, 401, corsHeaders);
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25', 10)));
  const offset = (page - 1) * limit;
  const statusFilter = (url.searchParams.get('status') || 'ALL').toUpperCase();
  const typeFilter = (url.searchParams.get('type') || 'ALL').toUpperCase();
  const search = (url.searchParams.get('search') || '').trim();

  let whereClauses: string[] = ['1=1'];
  let bindings: any[] = [];

  if (statusFilter !== 'ALL') {
    whereClauses.push('status = ?');
    bindings.push(statusFilter);
  }

  if (typeFilter !== 'ALL') {
    whereClauses.push('email_type = ?');
    bindings.push(typeFilter);
  }

  if (search) {
    whereClauses.push('(order_id LIKE ? OR recipient_email LIKE ? OR resend_message_id LIKE ?)');
    const term = `%${search}%`;
    bindings.push(term, term, term);
  }

  const whereSql = whereClauses.join(' AND ');

  try {
    const countRes = await env.DB.prepare(`SELECT COUNT(*) AS total FROM email_delivery_logs WHERE ${whereSql}`)
      .bind(...bindings)
      .first<{ total: number }>();
    const total = Number(countRes?.total || 0);

    const logsRes = await env.DB.prepare(
      `SELECT * FROM email_delivery_logs WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
      .bind(...bindings, limit, offset)
      .all<any>();

    return adminJsonResponse(
      {
        success: true,
        emails: logsRes.results || [],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      200,
      corsHeaders
    );
  } catch (err: any) {
    console.error('Admin emails query error:', err);
    return adminJsonResponse({ success: false, error: err.message }, 500, corsHeaders);
  }
}

/**
 * POST /api/admin/emails/resend
 * Operational trigger to resend receipt or license email
 */
export async function handleAdminResendEmail(
  request: Request,
  env: Env,
  adminUser: string,
  clientIp: string,
  corsHeaders: HeadersInit
): Promise<Response> {
  const auth = await authenticateAdmin(request, env);
  if (!auth.valid) {
    return adminJsonResponse({ success: false, error: auth.error || 'Unauthorized' }, 401, corsHeaders);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      order_id?: string;
      email_type?: EmailType;
      custom_recipient?: string;
    };

    const orderId = (body.order_id || '').trim();
    const emailType = (body.email_type || 'ORDER_RECEIPT') as EmailType;
    const customRecipient = (body.custom_recipient || '').trim().toLowerCase();

    if (!orderId) {
      return adminJsonResponse({ success: false, error: 'Order ID is required.' }, 400, corsHeaders);
    }

    const order = await env.DB.prepare(
      `SELECT 
         o.*, 
         c.email AS customer_email, 
         c.full_name AS customer_name, 
         p.name AS product_name,
         p.r2_object_key,
         p.has_license,
         p.max_devices
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       JOIN products p ON o.product_id = p.id
       WHERE o.order_id = ?`
    )
      .bind(orderId)
      .first<any>();

    if (!order) {
      return adminJsonResponse({ success: false, error: 'Order not found.' }, 404, corsHeaders);
    }

    const recipient = customRecipient || order.customer_email;

    // Safety check for staging allowlist
    const isProd = env.ENVIRONMENT === 'production';
    if (!isProd && env.EMAIL_TEST_RECIPIENT_ALLOWLIST) {
      const allowed = env.EMAIL_TEST_RECIPIENT_ALLOWLIST.split(',').map((e) => e.trim().toLowerCase());
      if (!allowed.includes(recipient)) {
        return adminJsonResponse(
          {
            success: false,
            error: `Staging Safety: Recipient "${recipient}" is not in EMAIL_TEST_RECIPIENT_ALLOWLIST. Add it or test with an allowed email.`,
          },
          400,
          corsHeaders
        );
      }
    }

    // Retrieve license
    const license = await getLicenseByOrder(env.DB, orderId);

    // Retrieve or create fresh download token
    let downloadUrl: string | null = null;
    if (order.r2_object_key) {
      let dt = await getDownloadTokenByOrder(env.DB, orderId);
      if (!dt || new Date(dt.expires_at).getTime() < Date.now()) {
        dt = await createDownloadTokenForOrder(env.DB, orderId, order.r2_object_key, 48);
      }
      downloadUrl = `https://motionbydk-api-staging.motionbydk-api.workers.dev/api/download/${dt.token}`;
    }

    let sendResult: any = null;

    if (emailType === 'ORDER_RECEIPT') {
      // Find successful payment
      const payment = await env.DB.prepare(
        `SELECT cf_payment_id FROM payments WHERE order_id = ? AND payment_status = 'SUCCESS' ORDER BY created_at DESC LIMIT 1`
      )
        .bind(orderId)
        .first<{ cf_payment_id: string }>();

      sendResult = await dispatchOrderReceiptEmail(env.DB, env, {
        orderId,
        customerEmail: recipient,
        customerName: order.customer_name,
        productName: order.product_name,
        amountInrPaise: order.final_amount_inr,
        paymentId: payment?.cf_payment_id || 'VERIFIED_GATEWAY',
        licenseKey: license?.license_key || null,
        downloadUrl,
        forceResend: true,
      });
    } else if (emailType === 'LICENSE_CLAIMED') {
      if (!license) {
        return adminJsonResponse({ success: false, error: 'No license exists for this order.' }, 400, corsHeaders);
      }
      sendResult = await dispatchLicenseClaimedEmail(env.DB, env, {
        orderId,
        customerEmail: recipient,
        customerName: order.customer_name,
        productName: order.product_name,
        licenseKey: license.license_key,
        maxDevices: license.max_devices,
      });
    } else if (emailType === 'DOWNLOAD_DELIVERY') {
      if (!downloadUrl) {
        return adminJsonResponse({ success: false, error: 'No downloadable asset associated with this product.' }, 400, corsHeaders);
      }
      sendResult = await dispatchDownloadDeliveryEmail(env.DB, env, {
        orderId,
        customerEmail: recipient,
        customerName: order.customer_name,
        productName: order.product_name,
        downloadUrl,
      });
    } else {
      return adminJsonResponse({ success: false, error: `Unsupported email type: ${emailType}` }, 400, corsHeaders);
    }

    await logAuditEvent(
      env.DB,
      adminUser,
      'RESEND_EMAIL',
      'EMAIL',
      orderId,
      { emailType, recipient, resendStatus: sendResult.status },
      clientIp
    );

    return adminJsonResponse(
      {
        success: sendResult.success,
        message: `Email [${emailType}] dispatched to ${recipient}.`,
        result: sendResult,
      },
      200,
      corsHeaders
    );
  } catch (err: any) {
    console.error('Admin resend email error:', err);
    return adminJsonResponse({ success: false, error: err.message }, 500, corsHeaders);
  }
}

/**
 * GET /api/admin/audit-logs
 * Security & operational audit trail
 */
export async function handleAdminAuditLogs(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const auth = await authenticateAdmin(request, env);
  if (!auth.valid) {
    return adminJsonResponse({ success: false, error: auth.error || 'Unauthorized' }, 401, corsHeaders);
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
  const offset = (page - 1) * limit;

  try {
    const countRes = await env.DB.prepare(`SELECT COUNT(*) AS total FROM audit_logs`).first<{ total: number }>();
    const total = Number(countRes?.total || 0);

    const logs = await env.DB.prepare(
      `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
      .bind(limit, offset)
      .all<any>();

    return adminJsonResponse(
      {
        success: true,
        auditLogs: logs.results || [],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      200,
      corsHeaders
    );
  } catch (err: any) {
    console.error('Admin audit logs query error:', err);
    return adminJsonResponse({ success: false, error: err.message }, 500, corsHeaders);
  }
}

/**
 * GET /api/admin/payment-events
 * Raw Cashfree webhook events audit
 */
export async function handleAdminPaymentEvents(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const auth = await authenticateAdmin(request, env);
  if (!auth.valid) {
    return adminJsonResponse({ success: false, error: auth.error || 'Unauthorized' }, 401, corsHeaders);
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
  const offset = (page - 1) * limit;

  try {
    const countRes = await env.DB.prepare(`SELECT COUNT(*) AS total FROM payment_events`).first<{ total: number }>();
    const total = Number(countRes?.total || 0);

    const events = await env.DB.prepare(
      `SELECT id, event_id, order_id, event_type, signature_verified, processed_at 
       FROM payment_events 
       ORDER BY processed_at DESC 
       LIMIT ? OFFSET ?`
    )
      .bind(limit, offset)
      .all<any>();

    return adminJsonResponse(
      {
        success: true,
        paymentEvents: events.results || [],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      200,
      corsHeaders
    );
  } catch (err: any) {
    console.error('Admin payment events query error:', err);
    return adminJsonResponse({ success: false, error: err.message }, 500, corsHeaders);
  }
}

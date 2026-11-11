/**
 * Motion By DK — Cloudflare Worker API
 * Worker Name: motionbydk-api
 */

import { Env } from './types';
import {
  getProduct,
  getCoupon,
  upsertCustomer,
  createPendingOrder,
  getOrder,
  updateOrderStatus,
  recordPayment,
  isEventProcessed,
  recordPaymentEvent,
  issueLicenseForOrder,
  createDownloadTokenForOrder,
  getLicenseByOrder,
  getDownloadTokenByOrder,
  incrementCouponUsage,
} from './db';
import { createCashfreeOrder, getCashfreeOrder, verifyCashfreeWebhookSignature } from './cashfree';
import { handleDownloadRequest } from './download';
import { verifyLicenseKey, activateDevice, deactivateDevice, claimLicenseByOrder } from './licenseManager';
import { hashString } from './license';
import {
  dispatchOrderReceiptEmail,
  dispatchLicenseClaimedEmail,
  dispatchDownloadDeliveryEmail,
  hasEmailBeenSent,
} from './email';

const ALLOWED_ORIGINS = [
  'https://www.motionbydk.in',
  'https://motionbydk.in',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
  'http://localhost:8787',
];

function getCorsHeaders(request: Request, envCorsOrigin?: string): HeadersInit {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) || (envCorsOrigin && envCorsOrigin.split(',').includes(origin));

  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://www.motionbydk.in',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-webhook-signature, x-webhook-timestamp',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data: unknown, status = 200, corsHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

// In-Memory IP Rate Limiter for sensitive endpoints
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, limit = 20, windowMs = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    if (rateLimitMap.size > 1000) {
      for (const [k, v] of rateLimitMap.entries()) {
        if (now > v.resetAt) rateLimitMap.delete(k);
      }
    }
    return true;
  }
  if (record.count >= limit) {
    return false;
  }
  record.count += 1;
  return true;
}

function generateOrderId(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const randHex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return `MDK_ORD_${Math.floor(Date.now() / 1000)}_${randHex}`;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const corsHeaders = getCorsHeaders(request, env.CORS_ORIGIN);
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      // =======================================================================
      // 1. HEALTH CHECK & CONNECTIVITY
      // =======================================================================
      if (pathname === '/' || pathname === '/health' || pathname === '/api/health') {
        let d1Status = 'checking';
        let r2Status = 'checking';

        try {
          if (env.DB) {
            const result = await env.DB.prepare('SELECT count(*) as total FROM products').first<{ total: number }>();
            d1Status = result ? `connected (products: ${result.total})` : 'connected';
          } else {
            d1Status = 'unbound';
          }
        } catch (err: any) {
          d1Status = `error: ${err.message || 'unknown'}`;
        }

        try {
          if (env.PRODUCTS_BUCKET) {
            await env.PRODUCTS_BUCKET.list({ limit: 1 });
            r2Status = 'connected';
          } else {
            r2Status = 'unbound';
          }
        } catch (err: any) {
          r2Status = `error: ${err.message || 'unknown'}`;
        }

        return jsonResponse(
          {
            service: 'MotionByDk API',
            status: 'operational',
            environment: env.ENVIRONMENT || 'development',
            timestamp: new Date().toISOString(),
            infrastructure: {
              database: { name: 'motionbydk-db', status: d1Status },
              storage: { bucket: 'motionbydk-products', status: r2Status },
            },
            cashfree: {
              mode: (env.CASHFREE_ENV || 'SANDBOX').toLowerCase(),
              configured: !!(env.CASHFREE_APP_ID && env.CASHFREE_SECRET_KEY),
            },
          },
          200,
          corsHeaders
        );
      }

      // =======================================================================
      // 2. CHECKOUT: CREATE ORDER (POST /api/checkout/create-order)
      // =======================================================================
      if (pathname === '/api/checkout/create-order' && request.method === 'POST') {
        let body: any;
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: 'INVALID_JSON', message: 'Request body must be valid JSON.' }, 400, corsHeaders);
        }

        const { productId, customerName, customerEmail, customerPhone, couponCode } = body;

        // Validation
        if (!productId || typeof productId !== 'string') {
          return jsonResponse({ error: 'MISSING_PRODUCT_ID', message: 'productId is required.' }, 400, corsHeaders);
        }
        if (!customerName || typeof customerName !== 'string' || customerName.trim().length < 2) {
          return jsonResponse({ error: 'INVALID_NAME', message: 'Please provide a valid full name.' }, 400, corsHeaders);
        }
        if (!customerEmail || typeof customerEmail !== 'string' || !customerEmail.includes('@')) {
          return jsonResponse({ error: 'INVALID_EMAIL', message: 'Please provide a valid email address.' }, 400, corsHeaders);
        }

        // Clean phone number (Indian 10-digit or E.164)
        const cleanPhone = customerPhone ? String(customerPhone).replace(/[^0-9]/g, '').slice(-10) : '9999999999';
        if (cleanPhone.length < 10) {
          return jsonResponse({ error: 'INVALID_PHONE', message: 'Please provide a valid 10-digit phone number.' }, 400, corsHeaders);
        }

        // Fetch authoritative product from D1
        const product = await getProduct(env.DB, productId);
        if (!product) {
          return jsonResponse({ error: 'PRODUCT_NOT_FOUND', message: 'The requested product is inactive or does not exist.' }, 404, corsHeaders);
        }

        const baseAmountInr = product.price_inr; // in paise
        let discountInr = 0;
        let appliedCouponCode: string | null = null;

        // Validate Coupon if provided
        if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
          const coupon = await getCoupon(env.DB, couponCode.trim());
          if (coupon) {
            const notExpired = !coupon.expires_at || new Date(coupon.expires_at).getTime() > Date.now();
            const notExhausted = coupon.times_used < coupon.max_uses;
            const productMatches = !coupon.applicable_product_id || coupon.applicable_product_id === productId;

            if (notExpired && notExhausted && productMatches) {
              discountInr = coupon.discount_inr;
              appliedCouponCode = coupon.code;
            }
          }
        }

        // Calculate final payable amount in paise (minimum 100 paise = ₹1.00)
        const finalAmountInr = Math.max(baseAmountInr - discountInr, 100);
        const finalAmountRupees = Number((finalAmountInr / 100).toFixed(2));

        // Generate Unique Order ID
        const orderId = generateOrderId();

        // Upsert Customer
        const customer = await upsertCustomer(env.DB, customerEmail, customerName, cleanPhone);

        // Client metadata
        const ipAddress = request.headers.get('CF-Connecting-IP') || request.headers.get('x-real-ip');
        const userAgent = request.headers.get('User-Agent');

        // Create Order via Cashfree PG
        const returnUrl = `https://www.motionbydk.in/?order_id=${orderId}&status=return`;
        const notifyUrl = `https://${url.host}/api/webhooks/cashfree`;

        const cfOrder = await createCashfreeOrder(env, {
          orderId,
          orderAmount: finalAmountRupees,
          customerDetails: {
            customerId: customer.id,
            customerName: customer.full_name,
            customerEmail: customer.email,
            customerPhone: cleanPhone,
          },
          returnUrl,
          notifyUrl,
        });

        // Insert Pending Order in D1
        await createPendingOrder(env.DB, {
          orderId,
          customerId: customer.id,
          productId: product.id,
          couponCode: appliedCouponCode,
          baseAmountInr,
          discountInr,
          finalAmountInr,
          cfPaymentSessionId: cfOrder.payment_session_id || null,
          ipAddress,
          userAgent,
        });

        return jsonResponse(
          {
            success: true,
            orderId,
            paymentSessionId: cfOrder.payment_session_id,
            amountInr: finalAmountRupees,
            baseAmountInr: Number((baseAmountInr / 100).toFixed(2)),
            discountInr: Number((discountInr / 100).toFixed(2)),
            currency: 'INR',
            customer: {
              name: customer.full_name,
              email: customer.email,
              phone: cleanPhone,
            },
            mode: (env.CASHFREE_ENV || 'SANDBOX').toLowerCase(),
          },
          200,
          corsHeaders
        );
      }

      // =======================================================================
      // 3. CHECKOUT: ORDER STATUS (GET /api/checkout/status/:orderId)
      // =======================================================================
      if (pathname.startsWith('/api/checkout/status/') && request.method === 'GET') {
        const orderId = decodeURIComponent(pathname.replace('/api/checkout/status/', '')).trim();
        if (!orderId) {
          return jsonResponse({ error: 'MISSING_ORDER_ID', message: 'Order ID is required.' }, 400, corsHeaders);
        }

        const order = await getOrder(env.DB, orderId);
        if (!order) {
          return jsonResponse({ error: 'ORDER_NOT_FOUND', message: 'Order could not be found.' }, 404, corsHeaders);
        }

        // If order is still PENDING and Cashfree is configured, reconcile status directly with Cashfree
        if (order.status === 'PENDING') {
          const cfOrder = await getCashfreeOrder(env, orderId);
          if (cfOrder && cfOrder.order_status === 'PAID') {
            await updateOrderStatus(env.DB, orderId, 'PAID', new Date().toISOString());
            order.status = 'PAID';

            // Auto-issue license and download token if product warrants
            const product = await getProduct(env.DB, order.product_id);
            if (product && product.has_license) {
              await issueLicenseForOrder(env.DB, order.order_id, order.customer_id, product.id);
            }
            if (product && product.r2_object_key) {
              await createDownloadTokenForOrder(env.DB, order.order_id, product.r2_object_key);
            }
            if (order.coupon_code) {
              await incrementCouponUsage(env.DB, order.coupon_code);
            }
          }
        }

        // Fetch associated customer, license, and download token if PAID
        let licenseKey: string | null = null;
        let downloadToken: string | null = null;
        let downloadUrl: string | null = null;

        if (order.status === 'PAID') {
          const lic = await getLicenseByOrder(env.DB, order.order_id);
          if (lic) licenseKey = lic.license_key;

          const tok = await getDownloadTokenByOrder(env.DB, order.order_id);
          if (tok) {
            downloadToken = tok.token;
            downloadUrl = `https://${url.host}/api/download/${tok.token}`;
          }
        }

        const product = await getProduct(env.DB, order.product_id);

        return jsonResponse(
          {
            success: true,
            status: order.status,
            orderId: order.order_id,
            productId: order.product_id,
            productName: product ? product.name : 'AE Workflow Pro',
            amountInr: Number((order.final_amount_inr / 100).toFixed(2)),
            currency: order.currency,
            paidAt: order.paid_at,
            licenseKey,
            downloadToken,
            downloadUrl,
          },
          200,
          corsHeaders
        );
      }

      // =======================================================================
      // 4. CASHFREE SIGNED WEBHOOK RECEIVER (POST /api/webhooks/cashfree)
      // =======================================================================
      if (pathname === '/api/webhooks/cashfree' && request.method === 'POST') {
        const signature = request.headers.get('x-webhook-signature') || '';
        const timestamp = request.headers.get('x-webhook-timestamp') || '';

        // Read RAW body text before parsing JSON
        const rawBody = await request.text();

        // In production/configured environment, verify HMAC-SHA256 signature
        if (env.CASHFREE_SECRET_KEY) {
          const isValid = await verifyCashfreeWebhookSignature(env.CASHFREE_SECRET_KEY, rawBody, signature, timestamp);
          if (!isValid) {
            console.error('[Webhook] Invalid Cashfree signature rejection.');
            return jsonResponse({ error: 'INVALID_SIGNATURE', message: 'Signature verification failed.' }, 401, corsHeaders);
          }
        } else {
          console.warn('[Webhook] CASHFREE_SECRET_KEY not set. Skipping signature verification in mock test mode.');
        }

        let payload: any;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return jsonResponse({ error: 'INVALID_PAYLOAD', message: 'Invalid JSON body.' }, 400, corsHeaders);
        }

        // Extract order and payment data from standard Cashfree webhook payload
        const data = payload.data || {};
        const cfOrder = data.order || payload.order || {};
        const cfPayment = data.payment || payload.payment || {};

        const orderId = cfOrder.order_id || payload.order_id;
        const cfPaymentId = String(cfPayment.cf_payment_id || cfOrder.cf_order_id || Date.now());
        const orderStatus = cfOrder.order_status || payload.order_status;
        const paymentStatus = cfPayment.payment_status || (orderStatus === 'PAID' ? 'SUCCESS' : 'PENDING');
        const paymentMethod = cfPayment.payment_group || cfPayment.payment_method || 'online';
        const paymentAmount = cfPayment.payment_amount || cfOrder.order_amount || 0;
        const bankRef = cfPayment.bank_reference || null;

        if (!orderId) {
          return jsonResponse({ error: 'MISSING_ORDER_ID', message: 'No order_id in webhook payload.' }, 400, corsHeaders);
        }

        // Idempotency check: check if event already recorded
        const eventId = signature ? await hashString(signature) : `event_${orderId}_${cfPaymentId}`;
        const alreadyProcessed = await isEventProcessed(env.DB, eventId);
        if (alreadyProcessed) {
          return jsonResponse({ received: true, idempotent: true }, 200, corsHeaders);
        }

        // Lookup Order in D1
        const order = await getOrder(env.DB, orderId);
        if (!order) {
          console.warn(`[Webhook] Order ${orderId} not found in database.`);
          return jsonResponse({ received: true, note: 'Order not found in DB' }, 200, corsHeaders);
        }

        // Record webhook event in audit table
        await recordPaymentEvent(env.DB, {
          eventId,
          orderId,
          eventType: payload.type || 'PAYMENT_WEBHOOK',
          signatureVerified: !!env.CASHFREE_SECRET_KEY,
          payload: rawBody,
        });

        // If order is already PAID, return 200 immediately (prevent duplicate emails/licenses)
        if (order.status === 'PAID') {
          return jsonResponse({ received: true, already_paid: true }, 200, corsHeaders);
        }

        // Handle SUCCESSFUL Payment
        if (orderStatus === 'PAID' || paymentStatus === 'SUCCESS') {
          const paidAt = new Date().toISOString();
          await updateOrderStatus(env.DB, orderId, 'PAID', paidAt);

          // Record payment record
          await recordPayment(env.DB, {
            orderId,
            cfPaymentId,
            paymentMethod,
            paymentAmountInr: Math.round(paymentAmount * 100),
            paymentStatus: 'SUCCESS',
            paymentTime: paidAt,
            bankReference: bankRef,
            rawResponse: JSON.stringify(cfPayment),
          });

          // Fetch product details
          const product = await getProduct(env.DB, order.product_id);

          // Issue License Key (if product requires it)
          let licenseKey: string | null = null;
          if (product && product.has_license) {
            const lic = await issueLicenseForOrder(env.DB, order.order_id, order.customer_id, product.id);
            licenseKey = lic.license_key;
          }

          // Create Secure Download Token
          let downloadToken: string | null = null;
          if (product && product.r2_object_key) {
            const tok = await createDownloadTokenForOrder(env.DB, order.order_id, product.r2_object_key);
            downloadToken = tok.token;
          }

          // Increment coupon usage
          if (order.coupon_code) {
            await incrementCouponUsage(env.DB, order.coupon_code);
          }

          // Dispatch Transactional Email (Idempotent & Non-blocking)
          try {
            const customer = await env.DB
              .prepare('SELECT email, full_name FROM customers WHERE id = ?')
              .bind(order.customer_id)
              .first<{ email: string; full_name: string }>();

            if (customer) {
              const downloadUrl = downloadToken ? `https://${url.host}/api/download/${downloadToken}` : null;
              await dispatchOrderReceiptEmail(env.DB, env, {
                orderId: order.order_id,
                customerEmail: customer.email,
                customerName: customer.full_name,
                productName: product ? product.name : 'AE Workflow Pro',
                amountInrPaise: Math.round(paymentAmount * 100) || order.final_amount_inr,
                paymentId: cfPaymentId,
                licenseKey,
                downloadUrl,
              });
            }
          } catch (emailErr: any) {
            console.error('[Email Dispatch Error]:', emailErr);
            // Email failure NEVER invalidates confirmed payment
          }

          console.log(`[Webhook] Order ${orderId} marked PAID. License: ${licenseKey || 'N/A'}, Token: ${downloadToken || 'N/A'}`);
        } else if (paymentStatus === 'FAILED' || orderStatus === 'EXPIRED') {
          await updateOrderStatus(env.DB, orderId, 'FAILED');
          await recordPayment(env.DB, {
            orderId,
            cfPaymentId,
            paymentMethod,
            paymentAmountInr: Math.round(paymentAmount * 100),
            paymentStatus: 'FAILED',
            paymentTime: new Date().toISOString(),
            bankReference: bankRef,
            rawResponse: JSON.stringify(cfPayment),
          });
          console.log(`[Webhook] Order ${orderId} marked FAILED.`);
        }

        return jsonResponse({ received: true }, 200, corsHeaders);
      }

      // =======================================================================
      // 5. SECURE DIGITAL ASSET STREAMING (GET & POST /api/download/:token)
      // =======================================================================
      if (pathname.startsWith('/api/download/')) {
        const token = pathname.replace('/api/download/', '').trim();
        return await handleDownloadRequest(request, env, token, corsHeaders);
      }

      // =======================================================================
      // 6. LICENSE MANAGEMENT & ACTIVATION ENGINE (SECURITY HARDENED)
      // =======================================================================
      const clientIp = request.headers.get('CF-Connecting-IP') || request.headers.get('x-real-ip') || 'unknown';

      if (pathname === '/api/license/verify' && request.method === 'POST') {
        if (!checkRateLimit(clientIp, 20, 60000)) {
          return jsonResponse({ error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please wait a minute.' }, 429, corsHeaders);
        }
        let body: any = {};
        try { body = await request.json(); } catch {}
        const result = await verifyLicenseKey(env.DB, body.licenseKey || body.key);
        return jsonResponse(result, result.valid ? 200 : 404, corsHeaders);
      }

      if (pathname === '/api/license/activate' && request.method === 'POST') {
        if (!checkRateLimit(clientIp, 20, 60000)) {
          return jsonResponse({ error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please wait a minute.' }, 429, corsHeaders);
        }
        let body: any = {};
        try { body = await request.json(); } catch {}
        const result = await activateDevice(env.DB, {
          licenseKey: body.licenseKey || body.key,
          machineId: body.machineId || body.hardwareId || body.uuid,
          machineName: body.machineName || body.hostname,
          os: body.os,
          appVersion: body.appVersion,
        });
        const status = result.success ? 200 : (result.code === 'DEVICE_LIMIT_REACHED' ? 409 : 403);
        return jsonResponse(result, status, corsHeaders);
      }

      if (pathname === '/api/license/deactivate' && request.method === 'POST') {
        if (!checkRateLimit(clientIp, 20, 60000)) {
          return jsonResponse({ error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please wait a minute.' }, 429, corsHeaders);
        }
        let body: any = {};
        try { body = await request.json(); } catch {}
        const result = await deactivateDevice(env.DB, {
          licenseKey: body.licenseKey || body.key,
          machineId: body.machineId || body.hardwareId || body.uuid,
          email: body.email,
        });
        const status = result.success ? 200 : (result.code === 'UNAUTHORIZED' ? 403 : 404);
        return jsonResponse(result, status, corsHeaders);
      }

      if (pathname === '/api/license/claim' && request.method === 'POST') {
        if (!checkRateLimit(clientIp, 15, 60000)) {
          return jsonResponse({ error: 'RATE_LIMIT_EXCEEDED', message: 'Too many claim attempts. Please wait a minute.' }, 429, corsHeaders);
        }
        let body: any = {};
        try { body = await request.json(); } catch {}
        const result = await claimLicenseByOrder(env.DB, url.host, {
          orderId: body.orderId,
          email: body.email,
        });

        // Dispatch License Claimed Confirmation Email (Non-blocking)
        if (result.success && result.licenseKey && result.licenseKey !== 'N/A') {
          try {
            await dispatchLicenseClaimedEmail(env.DB, env, {
              orderId: body.orderId,
              customerEmail: body.email,
              customerName: result.customerName || 'Customer',
              productName: result.productName || 'MotionByDk AE Workflow Pro',
              licenseKey: result.licenseKey,
              maxDevices: result.maxDevices || 2,
            });
          } catch (emailErr: any) {
            console.error('[Email Claim Dispatch Error]:', emailErr);
          }
        }

        const status = result.success ? 200 : (result.code === 'ORDER_NOT_FOUND' ? 404 : 403);
        return jsonResponse(result, status, corsHeaders);
      }

      // =======================================================================
      // 7. TRANSACTIONAL EMAIL TEST & LOG ENDPOINTS (STAGING / INTERNAL)
      // =======================================================================
      if (pathname === '/api/email/test' && request.method === 'POST') {
        let body: any = {};
        try { body = await request.json(); } catch {}
        const { type, recipient, orderId } = body;
        const targetEmail = recipient || 'iamdk8968@gmail.com';
        const targetOrderId = orderId || 'MDK_ORD_1794382847_38C93F';

        let result: any;
        if (type === 'LICENSE_CLAIMED') {
          result = await dispatchLicenseClaimedEmail(env.DB, env, {
            orderId: targetOrderId,
            customerEmail: targetEmail,
            customerName: 'Dhananjay Kumar',
            productName: 'MotionByDk AE Workflow Pro',
            licenseKey: 'MDK-PRO-2026-TEST-KEY1',
            maxDevices: 2,
          });
        } else if (type === 'DOWNLOAD_DELIVERY') {
          result = await dispatchDownloadDeliveryEmail(env.DB, env, {
            orderId: targetOrderId,
            customerEmail: targetEmail,
            customerName: 'Dhananjay Kumar',
            productName: 'MotionByDk AE Workflow Pro',
            downloadUrl: `https://${url.host}/api/download/test_token_48h`,
          });
        } else {
          // Default: ORDER_RECEIPT
          result = await dispatchOrderReceiptEmail(env.DB, env, {
            orderId: targetOrderId,
            customerEmail: targetEmail,
            customerName: 'Dhananjay Kumar',
            productName: 'MotionByDk AE Workflow Pro',
            amountInrPaise: 49900,
            paymentId: 'cf_pay_test_123',
            licenseKey: 'MDK-PRO-2026-TEST-KEY1',
            downloadUrl: `https://${url.host}/api/download/test_token_48h`,
          });
        }

        // Fetch recent email log for this order
        const recentLogs = await env.DB
          .prepare('SELECT * FROM email_delivery_logs WHERE order_id = ? ORDER BY created_at DESC LIMIT 5')
          .bind(targetOrderId)
          .all();

        return jsonResponse(
          {
            testResult: result,
            environment: env.ENVIRONMENT,
            targetEmail,
            targetOrderId,
            recentLogs: recentLogs.results,
          },
          result.success ? 200 : 500,
          corsHeaders
        );
      }

      if (pathname.startsWith('/api/email/logs/') && request.method === 'GET') {
        const orderId = pathname.replace('/api/email/logs/', '').trim();
        const logs = await env.DB
          .prepare('SELECT * FROM email_delivery_logs WHERE order_id = ? ORDER BY created_at DESC')
          .bind(orderId)
          .all();

        return jsonResponse({ orderId, logs: logs.results || [] }, 200, corsHeaders);
      }

      // Backward-compatibility endpoint for legacy AE extensions querying /api/licenses.json
      if (pathname === '/api/licenses.json' && request.method === 'GET') {
        // Return all 105 legacy keys from D1 without exposing customer email addresses
        const legacyKeys = await env.DB
          .prepare('SELECT license_key, max_devices, is_active FROM licenses WHERE is_legacy = 1')
          .all<{ license_key: string; max_devices: number; is_active: number }>();

        const legacyMap: Record<string, any> = {};
        for (const r of legacyKeys.results || []) {
          legacyMap[r.license_key] = {
            type: r.license_key.includes('BUNDLE') ? 'Studio Bundle (2-PC Commercial)' : 'AE Workflow Pro (2-PC Commercial)',
            maxDevices: r.max_devices,
            devices: [],
            active: r.is_active === 1,
          };
        }
        return jsonResponse(legacyMap, 200, corsHeaders);
      }

      // 404 Route Not Found
      return jsonResponse(
        { error: 'NOT_FOUND', message: `Endpoint ${pathname} does not exist on MotionByDk API.` },
        404,
        corsHeaders
      );
    } catch (err: any) {
      console.error('[API Error]:', err);
      return jsonResponse(
        { error: 'INTERNAL_SERVER_ERROR', message: err.message || 'An unexpected error occurred.' },
        500,
        corsHeaders
      );
    }
  },
};

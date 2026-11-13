/**
 * Cashfree Payments Gateway Integration
 * API Version: 2023-08-01
 */

import { Env, CashfreeOrderResponse } from './types';

export function getCashfreeBaseUrl(env: Env): string {
  const defaultMode = (env.ENVIRONMENT || '').toLowerCase() === 'production' ? 'PRODUCTION' : 'SANDBOX';
  const mode = (env.CASHFREE_ENV || defaultMode).toUpperCase();
  return mode === 'PRODUCTION' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
}

export async function createCashfreeOrder(
  env: Env,
  params: {
    orderId: string;
    orderAmount: number;             // Floating number (e.g. 399.00 or 15.00)
    currency?: string;               // 'INR' | 'USD' (default 'INR')
    customerDetails: {
      customerId: string;
      customerName: string;
      customerEmail: string;
      customerPhone: string;
    };
    returnUrl: string;
    notifyUrl: string;
  }
): Promise<CashfreeOrderResponse> {
  const orderCurrency = (params.currency || 'INR').toUpperCase();

  // Never allow mock fallback in production environment (fail closed)
  if (!env.CASHFREE_APP_ID || !env.CASHFREE_SECRET_KEY) {
    if ((env.ENVIRONMENT || '').toLowerCase() === 'production') {
      throw new Error('CONFIGURATION_ERROR: Cashfree API credentials are not configured for production.');
    }
    console.warn('[Cashfree] CASHFREE_APP_ID or CASHFREE_SECRET_KEY not set. Running in MOCK SANDBOX mode.');
    return {
      order_id: params.orderId,
      order_amount: params.orderAmount,
      order_currency: orderCurrency,
      order_status: 'ACTIVE',
      payment_session_id: `mock_session_${Date.now()}_${params.orderId}`,
    };
  }

  const baseUrl = getCashfreeBaseUrl(env);
  const response = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: {
      'x-client-id': env.CASHFREE_APP_ID,
      'x-client-secret': env.CASHFREE_SECRET_KEY,
      'x-api-version': '2023-08-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      order_id: params.orderId,
      order_amount: params.orderAmount,
      order_currency: orderCurrency,
      customer_details: {
        customer_id: params.customerDetails.customerId,
        customer_name: params.customerDetails.customerName,
        customer_email: params.customerDetails.customerEmail,
        customer_phone: params.customerDetails.customerPhone,
      },
      order_meta: {
        return_url: params.returnUrl,
        notify_url: params.notifyUrl,
      },
    }),
  });

  const data = (await response.json()) as CashfreeOrderResponse;

  if (!response.ok) {
    throw new Error(`Cashfree Error (${response.status}): ${data.message || data.code || 'Order creation failed'}`);
  }

  return data;
}

export async function getCashfreeOrder(env: Env, orderId: string): Promise<CashfreeOrderResponse | null> {
  if (!env.CASHFREE_APP_ID || !env.CASHFREE_SECRET_KEY) {
    return null;
  }

  const baseUrl = getCashfreeBaseUrl(env);
  const response = await fetch(`${baseUrl}/orders/${orderId}`, {
    method: 'GET',
    headers: {
      'x-client-id': env.CASHFREE_APP_ID,
      'x-client-secret': env.CASHFREE_SECRET_KEY,
      'x-api-version': '2023-08-01',
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Cashfree order lookup failed with status ${response.status}`);
  }

  return (await response.json()) as CashfreeOrderResponse;
}

/**
 * Verifies the Cashfree Webhook Signature using HMAC-SHA256
 * Cashfree computes: Base64(HMAC-SHA256(timestamp + rawBody, secretKey))
 */
export async function verifyCashfreeWebhookSignature(
  secretKey: string,
  rawBody: string,
  signature: string,
  timestamp: string
): Promise<boolean> {
  try {
    if (!secretKey || !rawBody || !signature || !timestamp) {
      return false;
    }

    // Reject missing/non-numeric timestamps or webhooks older than 5 minutes (prevent replay attacks).
    // Cashfree sends x-webhook-timestamp in Unix milliseconds (13 digits), while synthetic/legacy callers may send seconds (10 digits).
    const parsedTime = Number(timestamp);
    if (!Number.isFinite(parsedTime) || parsedTime <= 0) {
      console.warn('[Webhook] Invalid webhook timestamp format');
      return false;
    }
    const webhookSeconds = parsedTime >= 1e12 ? Math.floor(parsedTime / 1000) : Math.floor(parsedTime);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - webhookSeconds) > 300) {
      console.warn('[Webhook] Webhook timestamp expired or clock skewed > 300s');
      return false;
    }

    const signatureData = `${timestamp}${rawBody}`;
    const enc = new TextEncoder();

    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(signatureData));
    const computedSignature = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));

    return computedSignature === signature;
  } catch (err: any) {
    console.error('[Webhook] Signature verification error:', err);
    return false;
  }
}

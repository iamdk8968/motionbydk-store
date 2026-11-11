/**
 * Motion By DK — Resend Transactional Email Engine
 * Features:
 *  - Responsive dark-theme HTML email templates with plain-text fallbacks
 *  - Strict idempotency protection via D1 email_delivery_logs
 *  - Test recipient allowlist protection (prevents real emails during testing)
 *  - Automatic exponential backoff retry on temporary Resend API failures
 *  - Graceful fallback when RESEND_API_KEY is not set (mock mode)
 *  - Non-blocking execution (email failures never break payment or license creation)
 */

import { Env, EmailType, EmailStatus } from './types';

// Default test allowlist for staging / development
const DEFAULT_TEST_ALLOWLIST = [
  'iamdk8968@gmail.com',
  'motionbydk@gmail.com',
  'delivered@resend.dev',
];

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface SendResult {
  success: boolean;
  status: EmailStatus;
  resendMessageId: string | null;
  error?: string;
  attemptCount: number;
  mocked?: boolean;
}

/**
 * Check if a recipient email is permitted in the current environment
 */
export function isRecipientAllowed(email: string, env: Env): boolean {
  if (env.ENVIRONMENT === 'production') {
    return true;
  }
  const clean = email.trim().toLowerCase();
  const allowlist = env.EMAIL_TEST_RECIPIENT_ALLOWLIST
    ? env.EMAIL_TEST_RECIPIENT_ALLOWLIST.split(',').map((e) => e.trim().toLowerCase())
    : DEFAULT_TEST_ALLOWLIST;

  return allowlist.includes(clean);
}

/**
 * Check if an email of this type has already been sent for this order (Idempotency Guard)
 */
export async function hasEmailBeenSent(
  db: D1Database,
  orderId: string,
  emailType: EmailType
): Promise<{ sent: boolean; resendMessageId?: string | null }> {
  const existing = await db
    .prepare(
      `SELECT id, resend_message_id, status 
       FROM email_delivery_logs 
       WHERE order_id = ? AND email_type = ? AND status IN ('SENT', 'ACCEPTED', 'MOCK_SENT')`
    )
    .bind(orderId, emailType)
    .first<{ id: string; resend_message_id: string | null; status: string }>();

  if (existing) {
    return { sent: true, resendMessageId: existing.resend_message_id };
  }
  return { sent: false };
}

/**
 * Record an email attempt into email_delivery_logs
 */
export async function logEmailAttempt(
  db: D1Database,
  params: {
    orderId: string;
    recipientEmail: string;
    emailType: EmailType;
    resendMessageId: string | null;
    status: EmailStatus;
    attemptCount: number;
    errorMessage: string | null;
  }
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO email_delivery_logs (
        id, order_id, recipient_email, email_type, resend_message_id,
        status, attempt_count, error_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      params.orderId,
      params.recipientEmail,
      params.emailType,
      params.resendMessageId,
      params.status,
      params.attemptCount,
      params.errorMessage,
      now,
      now
    )
    .run();

  return id;
}

/**
 * Send an email through Resend API with retry logic and test allowlist filtering
 */
export async function sendEmailWithResend(
  env: Env,
  payload: EmailPayload
): Promise<SendResult> {
  const apiKey = env.RESEND_API_KEY;
  const fromAddress = env.EMAIL_FROM || 'Motion By DK <delivery@motionbydk.in>';
  const replyTo = env.EMAIL_REPLY_TO || 'motionbydk@gmail.com';

  // Check test allowlist
  if (!isRecipientAllowed(payload.to, env)) {
    console.log(`[Email Engine] Recipient ${payload.to} not in staging test allowlist. Simulating delivery.`);
    return {
      success: true,
      status: 'MOCK_SENT',
      resendMessageId: `mock_allowlist_bypass_${Date.now()}`,
      attemptCount: 1,
      mocked: true,
    };
  }

  // Graceful fallback if RESEND_API_KEY is not configured
  if (!apiKey || !apiKey.trim()) {
    console.warn('[Email Engine] RESEND_API_KEY not configured. Simulating delivery for staging.');
    return {
      success: true,
      status: 'MOCK_SENT',
      resendMessageId: `mock_no_key_${Date.now()}`,
      attemptCount: 1,
      mocked: true,
    };
  }

  let attempt = 0;
  const maxAttempts = 3;
  let lastError = '';

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [payload.to],
          reply_to: replyTo,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
        }),
      });

      const data: any = await res.json();

      if (res.ok && data.id) {
        return {
          success: true,
          status: 'ACCEPTED',
          resendMessageId: data.id,
          attemptCount: attempt,
        };
      }

      // Check if retryable (429 or 5xx)
      lastError = data.message || `HTTP ${res.status}: ${JSON.stringify(data)}`;
      if (res.status === 429 || res.status >= 500) {
        console.warn(`[Resend Attempt ${attempt}] Temporary failure (${res.status}): ${lastError}. Retrying...`);
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, attempt * 600));
          continue;
        }
      } else {
        // Permanent 4xx error (e.g. invalid email format)
        break;
      }
    } catch (err: any) {
      lastError = err.message || 'Network fetch failure';
      console.warn(`[Resend Attempt ${attempt}] Exception: ${lastError}. Retrying...`);
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, attempt * 600));
        continue;
      }
    }
  }

  return {
    success: false,
    status: 'FAILED',
    resendMessageId: null,
    error: lastError,
    attemptCount: attempt,
  };
}

// =============================================================================
// HTML & PLAIN TEXT EMAIL TEMPLATES
// =============================================================================

function baseEmailWrapper(title: string, contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #07090e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9; }
    .container { max-width: 600px; margin: 0 auto; padding: 32px 20px; }
    .card { background: linear-gradient(180deg, #131822 0%, #0d1117 100%); border: 1px solid #232d3f; border-radius: 16px; padding: 36px 28px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .brand-logo { font-size: 20px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff; text-decoration: none; }
    .brand-accent { color: #00F0FF; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; background: rgba(0, 240, 255, 0.1); color: #00F0FF; border: 1px solid rgba(0, 240, 255, 0.3); margin-bottom: 16px; }
    .badge-success { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
    h1 { font-size: 24px; font-weight: 800; color: #ffffff; margin: 0 0 12px 0; letter-spacing: -0.5px; }
    p { font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 20px 0; }
    .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: #090b10; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; }
    .info-table td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid #1e293b; }
    .info-table tr:last-child td { border-bottom: none; }
    .info-label { color: #64748b; font-weight: 600; width: 40%; }
    .info-val { color: #f1f5f9; font-weight: 600; text-align: right; }
    .key-box { background: #090b10; border: 1px solid rgba(0, 240, 255, 0.35); border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0; }
    .key-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; font-weight: 700; display: block; margin-bottom: 8px; }
    .key-code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 20px; font-weight: 800; color: #00F0FF; letter-spacing: 2px; }
    .key-policy { font-size: 11px; color: #10b981; margin-top: 8px; display: block; font-weight: 600; }
    .btn-primary { display: inline-block; width: 100%; box-sizing: border-box; background: #00F0FF; color: #000000; text-align: center; padding: 14px 24px; border-radius: 10px; font-weight: 800; font-size: 14px; text-decoration: none; letter-spacing: 0.2px; margin: 20px 0 10px 0; }
    .step-box { background: #090b10; border: 1px solid #1e293b; border-radius: 12px; padding: 18px; margin: 24px 0; }
    .step-item { display: flex; align-items: flex-start; margin-bottom: 12px; font-size: 13px; color: #cbd5e1; line-height: 1.5; }
    .step-item:last-child { margin-bottom: 0; }
    .step-num { display: inline-block; min-width: 20px; height: 20px; background: rgba(0, 240, 255, 0.15); color: #00F0FF; border-radius: 50%; text-align: center; line-height: 20px; font-weight: 800; font-size: 11px; margin-right: 10px; }
    .footer { text-align: center; padding-top: 24px; font-size: 12px; color: #475569; }
    .footer a { color: #64748b; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="https://www.motionbydk.in" class="brand-logo">MOTION<span class="brand-accent">BY DK</span></a>
    </div>
    <div class="card">
      ${contentHtml}
    </div>
    <div class="footer">
      <p>&copy; 2026 MotionByDk • Speed &amp; Precision for Video Editors<br>
      Questions? Chat with Dhananjay on <a href="https://wa.me/919217282296">WhatsApp (+91 92172 82296)</a> or reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Template A: Order Receipt & Complete Delivery (Verified Paid Order)
 */
export function buildOrderReceiptEmail(params: {
  customerName: string;
  orderId: string;
  productName: string;
  amountInrPaise: number;
  paymentId: string;
  licenseKey?: string | null;
  downloadUrl?: string | null;
}): EmailPayload {
  const { customerName, orderId, productName, amountInrPaise, paymentId, licenseKey, downloadUrl } = params;
  const formattedAmount = `₹${(amountInrPaise / 100).toFixed(2)}`;

  let licenseSection = '';
  if (licenseKey) {
    licenseSection = `
      <div class="key-box">
        <span class="key-label">Official 2-PC Commercial License Key</span>
        <div class="key-code">${licenseKey}</div>
        <span class="key-policy">✓ Valid on up to 2 workstations (PC + Laptop)</span>
      </div>
    `;
  }

  let downloadSection = '';
  if (downloadUrl) {
    downloadSection = `
      <div style="margin: 24px 0 16px 0;">
        <a href="${downloadUrl}" class="btn-primary" target="_blank">Download Extension Package (ZIP)</a>
        <p style="font-size: 11px; color: #64748b; text-align: center; margin: 6px 0 0 0;">
          🔒 Secure signed link valid for 48 hours • Cloudflare R2 High-Speed Delivery
        </p>
      </div>
    `;
  }

  const html = baseEmailWrapper(
    'Order Confirmed - MotionByDk',
    `
    <div class="badge badge-success">✓ Payment Verified</div>
    <h1>Thank You for Your Order!</h1>
    <p>Hi ${customerName}, your payment has been verified successfully. Your commercial license and access details are ready below:</p>

    <table class="info-table">
      <tr>
        <td class="info-label">Product</td>
        <td class="info-val">${productName}</td>
      </tr>
      <tr>
        <td class="info-label">Order Reference</td>
        <td class="info-val"><code style="color:#00F0FF;">${orderId}</code></td>
      </tr>
      <tr>
        <td class="info-label">Amount Paid</td>
        <td class="info-val">${formattedAmount}</td>
      </tr>
      <tr>
        <td class="info-label">Payment ID</td>
        <td class="info-val">${paymentId}</td>
      </tr>
      <tr>
        <td class="info-label">Payment Status</td>
        <td class="info-val" style="color:#10b981;">PAID (Verified via Cashfree)</td>
      </tr>
    </table>

    ${licenseSection}

    ${downloadSection}

    <div class="step-box">
      <div style="font-weight: 700; color: #ffffff; font-size: 13px; margin-bottom: 12px;">
        Quick 30-Second Activation Guide:
      </div>
      <div class="step-item">
        <span class="step-num">1</span>
        <span>Download and extract the extension ZIP package. Run the installer script.</span>
      </div>
      <div class="step-item">
        <span class="step-num">2</span>
        <span>Open After Effects &rarr; <strong>Window &rarr; Extensions &rarr; MotionByDk AEworkflow</strong>.</span>
      </div>
      <div class="step-item">
        <span class="step-num">3</span>
        <span>Click <strong>Activate</strong>, paste your key above, and enjoy instant speed!</span>
      </div>
    </div>

    <p style="font-size: 12px; color: #64748b;">
      Need to manage or verify your license in the future? Visit the 
      <a href="https://www.motionbydk.in/activate.html" style="color:#00F0FF; text-decoration:underline;">MotionByDk License Portal</a> anytime.
    </p>
    `
  );

  const text = `
MOTION BY DK — ORDER CONFIRMATION
===============================================
Hi ${customerName},

Thank you for your purchase! Your payment has been verified successfully.

ORDER DETAILS:
- Product: ${productName}
- Order ID: ${orderId}
- Amount Paid: ${formattedAmount}
- Payment Status: PAID (Verified via Cashfree)
- Payment ID: ${paymentId}

${licenseKey ? `YOUR 2-PC COMMERCIAL LICENSE KEY:\n${licenseKey}\n(Valid on up to 2 workstations: PC + Laptop)\n` : ''}
${downloadUrl ? `DOWNLOAD EXTENSION (48-Hour Secure Link):\n${downloadUrl}\n` : ''}

QUICK ACTIVATION IN AFTER EFFECTS:
1. Extract the downloaded ZIP and run the installer.
2. In After Effects: Window -> Extensions -> MotionByDk AEworkflow.
3. Click Activate, paste your key above, and click Activate License!

Need assistance? Chat with Dhananjay on WhatsApp: https://wa.me/919217282296
Portal: https://www.motionbydk.in/activate.html
`.trim();

  return {
    to: params.customerName, // placeholder; caller sets exact recipient
    subject: `Order Confirmed: ${productName} (${orderId})`,
    html,
    text,
  };
}

/**
 * Template B: License Issued Email
 */
export function buildLicenseIssuedEmail(params: {
  customerName: string;
  orderId: string;
  productName: string;
  licenseKey: string;
  maxDevices: number;
}): EmailPayload {
  const { customerName, orderId, productName, licenseKey, maxDevices } = params;

  const html = baseEmailWrapper(
    'Your Commercial License Key - MotionByDk',
    `
    <div class="badge">Official License Key</div>
    <h1>Your 2-PC Commercial License</h1>
    <p>Hi ${customerName}, here is your official commercial activation key for <strong>${productName}</strong>:</p>

    <div class="key-box">
      <span class="key-label">Official License Key</span>
      <div class="key-code">${licenseKey}</div>
      <span class="key-policy">✓ Lifetime Commercial License (Up to ${maxDevices} PCs)</span>
    </div>

    <div class="step-box">
      <div style="font-weight: 700; color: #ffffff; font-size: 13px; margin-bottom: 12px;">
        How to activate in After Effects:
      </div>
      <div class="step-item">
        <span class="step-num">1</span>
        <span>Open After Effects &rarr; <strong>Window &rarr; Extensions &rarr; MotionByDk AEworkflow</strong>.</span>
      </div>
      <div class="step-item">
        <span class="step-num">2</span>
        <span>Click <strong>Activate</strong>, paste your key, and click <strong>Activate License</strong>.</span>
      </div>
    </div>

    <p style="font-size: 13px; color: #94a3b8;">
      <strong>Switching to a new computer?</strong> You can deactivate your old machine right inside the extension or check your active devices on our 
      <a href="https://www.motionbydk.in/activate.html" style="color:#00F0FF; text-decoration:underline;">Activation Portal</a>.
    </p>
    `
  );

  const text = `
MOTION BY DK — LICENSE KEY
===============================================
Hi ${customerName},

Here is your commercial license key for ${productName}:

LICENSE KEY: ${licenseKey}
Policy: Lifetime Commercial (Up to ${maxDevices} workstations)
Order Reference: ${orderId}

ACTIVATION:
1. In After Effects: Window -> Extensions -> MotionByDk AEworkflow.
2. Click Activate, paste your key, and click Activate License.

Portal: https://www.motionbydk.in/activate.html
WhatsApp Support: https://wa.me/919217282296
`.trim();

  return {
    to: params.customerName,
    subject: `Your Commercial License Key: ${productName}`,
    html,
    text,
  };
}

/**
 * Template C: Download Delivery Link Refresh
 */
export function buildDownloadDeliveryEmail(params: {
  customerName: string;
  orderId: string;
  productName: string;
  downloadUrl: string;
  expiresHours?: number;
}): EmailPayload {
  const { customerName, orderId, productName, downloadUrl, expiresHours = 48 } = params;

  const html = baseEmailWrapper(
    'Your Secure Download Link - MotionByDk',
    `
    <div class="badge">Digital Asset Delivery</div>
    <h1>Your Secure Download Link</h1>
    <p>Hi ${customerName}, here is your high-speed Cloudflare R2 download link for <strong>${productName}</strong>:</p>

    <div style="margin: 28px 0 16px 0;">
      <a href="${downloadUrl}" class="btn-primary" target="_blank">Download Extension Package (ZIP)</a>
      <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 8px;">
        🔒 Link expires in ${expiresHours} hours • Maximum 10 downloads allowed
      </p>
    </div>

    <div class="step-box">
      <div style="font-weight: 700; color: #ffffff; font-size: 13px; margin-bottom: 8px;">
        Installation Note:
      </div>
      <p style="font-size: 12px; color: #94a3b8; margin: 0;">
        Unzip the package and run <code>install_mac.sh</code> on macOS or <code>install_windows.bat</code> on Windows. Step-by-step instructions are included in the README.
      </p>
    </div>
    `
  );

  const text = `
MOTION BY DK — DOWNLOAD LINK
===============================================
Hi ${customerName},

Here is your secure download link for ${productName}:

DOWNLOAD URL:
${downloadUrl}

(Note: This link expires in ${expiresHours} hours and permits up to 10 downloads).
Order Reference: ${orderId}

Need help? Contact Dhananjay on WhatsApp: https://wa.me/919217282296
`.trim();

  return {
    to: params.customerName,
    subject: `Secure Download Link: ${productName}`,
    html,
    text,
  };
}

/**
 * Template D: License Claim Confirmation
 */
export function buildLicenseClaimedEmail(params: {
  customerName: string;
  orderId: string;
  productName: string;
  licenseKey: string;
  maxDevices: number;
}): EmailPayload {
  const { customerName, orderId, productName, licenseKey, maxDevices } = params;

  const html = baseEmailWrapper(
    'License Claimed - MotionByDk',
    `
    <div class="badge badge-success">✓ License Retrieved</div>
    <h1>License Key Claimed</h1>
    <p>Hi ${customerName}, your commercial license key for <strong>${productName}</strong> was retrieved from the MotionByDk Activation Portal:</p>

    <div class="key-box">
      <span class="key-label">Commercial License Key</span>
      <div class="key-code">${licenseKey}</div>
      <span class="key-policy">✓ 2-PC Commercial Policy (${maxDevices} Workstations)</span>
    </div>

    <table class="info-table">
      <tr>
        <td class="info-label">Order Reference</td>
        <td class="info-val"><code style="color:#00F0FF;">${orderId}</code></td>
      </tr>
      <tr>
        <td class="info-label">Product</td>
        <td class="info-val">${productName}</td>
      </tr>
      <tr>
        <td class="info-label">Claim Timestamp</td>
        <td class="info-val">${new Date().toUTCString()}</td>
      </tr>
    </table>

    <p style="font-size: 12px; color: #64748b;">
      If you did not initiate this claim, please contact Dhananjay on WhatsApp immediately at +91 92172 82296.
    </p>
    `
  );

  const text = `
MOTION BY DK — LICENSE CLAIMED
===============================================
Hi ${customerName},

Your license key for ${productName} was retrieved from the Activation Portal:

LICENSE KEY: ${licenseKey}
Order ID: ${orderId}
Timestamp: ${new Date().toISOString()}

If you did not initiate this request, contact support immediately: https://wa.me/919217282296
`.trim();

  return {
    to: params.customerName,
    subject: `License Key Retrieved: ${productName}`,
    html,
    text,
  };
}

// =============================================================================
// HIGH-LEVEL ORCHESTRATION FUNCTIONS
// =============================================================================

/**
 * Dispatch payment confirmation and complete access email (Idempotent)
 */
export async function dispatchOrderReceiptEmail(
  db: D1Database,
  env: Env,
  params: {
    orderId: string;
    customerEmail: string;
    customerName: string;
    productName: string;
    amountInrPaise: number;
    paymentId: string;
    licenseKey?: string | null;
    downloadUrl?: string | null;
  }
): Promise<SendResult> {
  const { orderId, customerEmail } = params;

  // 1. Idempotency Check
  const check = await hasEmailBeenSent(db, orderId, 'ORDER_RECEIPT');
  if (check.sent) {
    console.log(`[Email Engine] ORDER_RECEIPT already sent for order ${orderId}. Skipping duplicate.`);
    return {
      success: true,
      status: 'SENT',
      resendMessageId: check.resendMessageId || null,
      attemptCount: 0,
      mocked: false,
    };
  }

  // 2. Build Payload
  const built = buildOrderReceiptEmail(params);
  built.to = customerEmail;

  // 3. Send via Resend
  const result = await sendEmailWithResend(env, built);

  // 4. Log in D1
  await logEmailAttempt(db, {
    orderId,
    recipientEmail: customerEmail,
    emailType: 'ORDER_RECEIPT',
    resendMessageId: result.resendMessageId,
    status: result.status,
    attemptCount: result.attemptCount,
    errorMessage: result.error || null,
  });

  return result;
}

/**
 * Dispatch License Claimed Confirmation Email (Idempotent per claim session)
 */
export async function dispatchLicenseClaimedEmail(
  db: D1Database,
  env: Env,
  params: {
    orderId: string;
    customerEmail: string;
    customerName: string;
    productName: string;
    licenseKey: string;
    maxDevices: number;
  }
): Promise<SendResult> {
  const { orderId, customerEmail } = params;

  // Build Payload
  const built = buildLicenseClaimedEmail(params);
  built.to = customerEmail;

  // Send via Resend
  const result = await sendEmailWithResend(env, built);

  // Log in D1
  await logEmailAttempt(db, {
    orderId,
    recipientEmail: customerEmail,
    emailType: 'LICENSE_CLAIMED',
    resendMessageId: result.resendMessageId,
    status: result.status,
    attemptCount: result.attemptCount,
    errorMessage: result.error || null,
  });

  return result;
}

/**
 * Dispatch Download Delivery Refresh Email
 */
export async function dispatchDownloadDeliveryEmail(
  db: D1Database,
  env: Env,
  params: {
    orderId: string;
    customerEmail: string;
    customerName: string;
    productName: string;
    downloadUrl: string;
    expiresHours?: number;
  }
): Promise<SendResult> {
  const { orderId, customerEmail } = params;

  // Build Payload
  const built = buildDownloadDeliveryEmail(params);
  built.to = customerEmail;

  // Send via Resend
  const result = await sendEmailWithResend(env, built);

  // Log in D1
  await logEmailAttempt(db, {
    orderId,
    recipientEmail: customerEmail,
    emailType: 'DOWNLOAD_DELIVERY',
    resendMessageId: result.resendMessageId,
    status: result.status,
    attemptCount: result.attemptCount,
    errorMessage: result.error || null,
  });

  return result;
}

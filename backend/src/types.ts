/**
 * Types & Interfaces for Motion By DK Cloudflare Worker
 */

export interface Env {
  DB: D1Database;
  PRODUCTS_BUCKET: R2Bucket;
  ENVIRONMENT: string;
  CORS_ORIGIN: string;
  CASHFREE_APP_ID?: string;
  CASHFREE_SECRET_KEY?: string;
  CASHFREE_ENV?: string;             // 'SANDBOX' | 'PRODUCTION'
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_REPLY_TO?: string;
  EMAIL_TEST_RECIPIENT_ALLOWLIST?: string;
  ADMIN_JWT_SECRET?: string;
}

export interface ProductRecord {
  id: string;
  name: string;
  description: string | null;
  price_inr: number;                 // Integer paise
  price_usd: number | null;
  r2_object_key: string | null;
  has_license: number;               // 1 | 0
  max_devices: number;
  is_active: number;                 // 1 | 0
  created_at: string;
}

export interface CouponRecord {
  code: string;
  discount_inr: number;              // Integer paise
  applicable_product_id: string | null;
  max_uses: number;
  times_used: number;
  is_active: number;
  expires_at: string | null;
  created_at: string;
}

export interface CustomerRecord {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderRecord {
  id: string;
  order_id: string;
  customer_id: string;
  product_id: string;
  coupon_code: string | null;
  base_amount_inr: number;           // Paise
  discount_inr: number;              // Paise
  final_amount_inr: number;          // Paise
  currency: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  cf_payment_session_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LicenseRecord {
  id: string;
  license_key: string;
  license_hash: string | null;
  order_id: string | null;
  customer_id: string | null;
  product_id: string;
  max_devices: number;
  is_active: number;
  revocation_reason: string | null;
  is_legacy: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface DownloadTokenRecord {
  token: string;
  order_id: string;
  r2_object_key: string;
  download_count: number;
  max_downloads: number;
  expires_at: string;
  created_at: string;
}

export interface CashfreeOrderResponse {
  cf_order_id?: number | string;
  order_id: string;
  order_amount: number;
  order_currency: string;
  order_status: string;
  payment_session_id?: string;
  order_expiry_time?: string;
  message?: string;
  code?: string;
}

export type EmailType =
  | 'ORDER_RECEIPT'
  | 'LICENSE_ISSUED'
  | 'DOWNLOAD_DELIVERY'
  | 'LICENSE_CLAIMED'
  | 'CLAIM_OTP'
  | 'STARTER_KIT'
  | 'REFUND';

export type EmailStatus =
  | 'SENT'
  | 'ACCEPTED'
  | 'FAILED'
  | 'RETRYING'
  | 'MOCK_SENT'
  | 'PENDING';

export interface EmailDeliveryLogRecord {
  id: string;
  order_id: string;
  recipient_email: string;
  email_type: EmailType;
  resend_message_id: string | null;
  status: EmailStatus;
  attempt_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClaimVerificationRecord {
  id: string;
  order_id: string;
  email: string;
  otp_hash: string;
  attempt_count: number;
  max_attempts: number;
  is_consumed: number;
  expires_at: string;
  created_at: string;
}

export interface AdminUserRecord {
  id: string;
  username: string;
  password_hash: string;
  salt: string;
  full_name: string;
  role: 'admin' | 'support';
  is_active?: number;
  last_login_at: string | null;
  created_at: string;
}

export interface AuditLogRecord {
  id: string;
  actor_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface AdminJwtPayload {
  sub: string;
  name: string;
  role: string;
  iss?: string;
  aud?: string;
  iat: number;
  exp: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

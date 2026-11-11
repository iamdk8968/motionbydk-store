/**
 * Motion By DK — Cloudflare Worker API
 * Worker Name: motionbydk-api
 */

export interface Env {
  DB: D1Database;
  PRODUCTS_BUCKET: R2Bucket;
  ENVIRONMENT: string;
  CORS_ORIGIN: string;
  CASHFREE_APP_ID?: string;
  CASHFREE_SECRET_KEY?: string;
  CASHFREE_ENV?: string;
  RESEND_API_KEY?: string;
  ADMIN_JWT_SECRET?: string;
}

// Allowed Origins for CORS
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
      // 1. Root / Health Check Endpoint
      if (pathname === '/' || pathname === '/health' || pathname === '/api/health') {
        let d1Status = 'checking';
        let r2Status = 'checking';

        try {
          if (env.DB) {
            const result = await env.DB.prepare('SELECT 1 as test').first();
            d1Status = result && result.test === 1 ? 'connected' : 'unexpected_result';
          } else {
            d1Status = 'unbound';
          }
        } catch (err: any) {
          d1Status = `error: ${err.message || 'unknown'}`;
        }

        try {
          if (env.PRODUCTS_BUCKET) {
            // Check bucket listing / connectivity
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
          },
          200,
          corsHeaders
        );
      }

      // Placeholder endpoints for subsequent phases:
      if (pathname === '/api/checkout/create-order' && request.method === 'POST') {
        return jsonResponse(
          { error: 'PHASE_3_PENDING', message: 'Cashfree order creation endpoint will be active in Phase 3.' },
          501,
          corsHeaders
        );
      }

      if (pathname.startsWith('/api/checkout/status/') && request.method === 'GET') {
        return jsonResponse(
          { error: 'PHASE_3_PENDING', message: 'Order status check will be active in Phase 3.' },
          501,
          corsHeaders
        );
      }

      if (pathname === '/api/webhooks/cashfree' && request.method === 'POST') {
        return jsonResponse(
          { error: 'PHASE_3_PENDING', message: 'Cashfree webhook receiver will be active in Phase 3.' },
          501,
          corsHeaders
        );
      }

      if (pathname.startsWith('/api/download/') && (request.method === 'GET' || request.method === 'POST')) {
        return jsonResponse(
          { error: 'PHASE_4_PENDING', message: 'R2 secure download route will be active in Phase 4.' },
          501,
          corsHeaders
        );
      }

      if (pathname.startsWith('/api/license/') && request.method === 'POST') {
        return jsonResponse(
          { error: 'PHASE_5_PENDING', message: 'License verification route will be active in Phase 5.' },
          501,
          corsHeaders
        );
      }

      // 404 Route Not Found
      return jsonResponse(
        {
          error: 'NOT_FOUND',
          message: `Endpoint ${pathname} does not exist on MotionByDk API.`,
        },
        404,
        corsHeaders
      );
    } catch (err: any) {
      return jsonResponse(
        {
          error: 'INTERNAL_SERVER_ERROR',
          message: err.message || 'An unexpected error occurred.',
        },
        500,
        corsHeaders
      );
    }
  },
};

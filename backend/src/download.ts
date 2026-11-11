/**
 * Cloudflare R2 Digital Product Streaming Engine
 * Supports token validation, expiry checks, download limits, chunked streaming, and HTTP Range requests.
 */

import { Env, DownloadTokenRecord } from './types';

export async function handleDownloadRequest(
  request: Request,
  env: Env,
  token: string,
  corsHeaders: HeadersInit
): Promise<Response> {
  if (!token || token.trim().length < 16) {
    return new Response(
      JSON.stringify({
        error: 'INVALID_TOKEN',
        message: 'The download token is invalid or malformed.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // 1. Validate Token in D1
  const tokenRecord = await env.DB
    .prepare('SELECT * FROM download_tokens WHERE token = ?')
    .bind(token.trim())
    .first<DownloadTokenRecord>();

  const ipAddress = request.headers.get('CF-Connecting-IP') || request.headers.get('x-real-ip') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';

  if (!tokenRecord) {
    return new Response(
      JSON.stringify({
        error: 'TOKEN_NOT_FOUND',
        message: 'Download link does not exist or has already been removed.',
      }),
      { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // 2. Check Expiration
  const isExpired = new Date(tokenRecord.expires_at).getTime() <= Date.now();
  if (isExpired) {
    await logDownloadAttempt(env.DB, tokenRecord.token, 0, ipAddress, userAgent, 410);
    return new Response(
      JSON.stringify({
        error: 'TOKEN_EXPIRED',
        message: 'This secure download link has expired. Please check your order confirmation email or contact support@motionbydk.in.',
        expiredAt: tokenRecord.expires_at,
      }),
      { status: 410, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // 3. Check Download Limit
  if (tokenRecord.download_count >= tokenRecord.max_downloads) {
    await logDownloadAttempt(env.DB, tokenRecord.token, 0, ipAddress, userAgent, 403);
    return new Response(
      JSON.stringify({
        error: 'DOWNLOAD_LIMIT_REACHED',
        message: 'Maximum download limit reached for this purchase. Contact support@motionbydk.in if you need your access reset.',
        downloadCount: tokenRecord.download_count,
        maxDownloads: tokenRecord.max_downloads,
      }),
      { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // 4. Fetch Object from R2 with Range Header Support
  const rangeHeader = request.headers.get('Range') || request.headers.get('range');
  let object: R2ObjectBody | null = null;

  try {
    if (rangeHeader) {
      object = await env.PRODUCTS_BUCKET.get(tokenRecord.r2_object_key, {
        range: request.headers,
        onlyIf: request.headers,
      });
    } else {
      object = await env.PRODUCTS_BUCKET.get(tokenRecord.r2_object_key);
    }
  } catch (err: any) {
    console.error('[R2 Download Error]:', err);
    return new Response(
      JSON.stringify({
        error: 'STORAGE_ERROR',
        message: 'Unable to retrieve asset from storage.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  if (!object) {
    console.error(`[R2 Download] Object not found in bucket: ${tokenRecord.r2_object_key}`);
    return new Response(
      JSON.stringify({
        error: 'ASSET_NOT_FOUND',
        message: 'Product file is currently undergoing maintenance. Please contact support.',
      }),
      { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // 5. Increment Download Count in D1
  await env.DB
    .prepare('UPDATE download_tokens SET download_count = download_count + 1 WHERE token = ?')
    .bind(tokenRecord.token)
    .run();

  // Extract friendly filename
  const filename = tokenRecord.r2_object_key.split('/').pop() || 'MotionByDk_Download.zip';

  // Build Response Headers
  const responseHeaders = new Headers();
  object.writeHttpMetadata(responseHeaders);
  responseHeaders.set('etag', object.httpEtag);
  responseHeaders.set('Content-Type', 'application/zip');
  responseHeaders.set('Content-Disposition', `attachment; filename="${filename}"`);
  responseHeaders.set('Cache-Control', 'private, no-transform, max-age=3600');
  responseHeaders.set('Accept-Ranges', 'bytes');

  // Handle Partial Content (Range Requests)
  const isRangeRequest = !!rangeHeader && object.range;
  const status = isRangeRequest ? 206 : 200;

  if (isRangeRequest && object.range) {
    // Format: bytes start-end/total
    if ('offset' in object.range && 'length' in object.range) {
      const start = object.range.offset;
      const end = object.range.offset + object.range.length - 1;
      responseHeaders.set('Content-Range', `bytes ${start}-${end}/${object.size}`);
      responseHeaders.set('Content-Length', object.range.length.toString());
    }
  } else {
    responseHeaders.set('Content-Length', object.size.toString());
  }

  // Log successful download
  const bytesSent = isRangeRequest && object.range && 'length' in object.range ? object.range.length : object.size;
  await logDownloadAttempt(env.DB, tokenRecord.token, bytesSent, ipAddress, userAgent, status);

  // Stream directly from R2 to client (Memory usage < 5MB)
  return new Response(object.body, {
    status,
    headers: responseHeaders,
  });
}

async function logDownloadAttempt(
  db: D1Database,
  token: string,
  bytesSent: number,
  ipAddress: string,
  userAgent: string,
  statusCode: number
): Promise<void> {
  try {
    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO download_logs (id, token, bytes_sent, ip_address, user_agent, status_code)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(id, token, bytesSent, ipAddress, userAgent, statusCode)
      .run();
  } catch (err) {
    console.error('[Download Log Error]:', err);
  }
}

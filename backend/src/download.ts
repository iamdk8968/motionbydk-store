/**
 * Cloudflare R2 Digital Product Streaming Engine (Security Hardened)
 * Supports token validation, expiry checks, atomic download limits, chunked streaming, and HTTP Range requests.
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

  const cleanToken = token.trim();
  const ipAddress = request.headers.get('CF-Connecting-IP') || request.headers.get('x-real-ip') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';

  // 1. Validate Token in D1
  const tokenRecord = await env.DB
    .prepare('SELECT * FROM download_tokens WHERE token = ?')
    .bind(cleanToken)
    .first<DownloadTokenRecord>();

  if (!tokenRecord) {
    return new Response(
      JSON.stringify({
        error: 'TOKEN_NOT_FOUND',
        message: 'Download link does not exist or has already been removed.',
      }),
      { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // 2. Check Expiration (Strict 48-Hour TTL Enforcement)
  const isExpired = new Date(tokenRecord.expires_at).getTime() <= Date.now();
  if (isExpired) {
    await logDownloadAttempt(env.DB, cleanToken, 0, ipAddress, userAgent, 410);
    return new Response(
      JSON.stringify({
        error: 'TOKEN_EXPIRED',
        message: 'This secure download link has expired. Please check your order confirmation email or contact support@motionbydk.in.',
        expiredAt: tokenRecord.expires_at,
      }),
      { status: 410, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // 3. Range-Aware Atomic Slot Reservation
  // Only the initial download request or the first chunk (bytes=0-...) increments the download count.
  // Subsequent chunks for multi-connection downloaders do not consume extra download count slots.
  const rangeHeader = request.headers.get('Range') || request.headers.get('range');
  const isInitialOrFullDownload = !rangeHeader || rangeHeader.includes('bytes=0-');

  if (isInitialOrFullDownload) {
    const atomicUpdate = await env.DB
      .prepare(
        `UPDATE download_tokens 
         SET download_count = download_count + 1 
         WHERE token = ? AND download_count < max_downloads AND expires_at > datetime('now')`
      )
      .bind(cleanToken)
      .run();

    if (atomicUpdate.meta.changes === 0) {
      await logDownloadAttempt(env.DB, cleanToken, 0, ipAddress, userAgent, 403);
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
  } else {
    // For non-initial chunk requests, still verify that the token has not exceeded limits
    if (tokenRecord.download_count > tokenRecord.max_downloads) {
      await logDownloadAttempt(env.DB, cleanToken, 0, ipAddress, userAgent, 403);
      return new Response(
        JSON.stringify({
          error: 'DOWNLOAD_LIMIT_REACHED',
          message: 'Download limit exceeded.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  }

  // 4. Fetch Object from R2 with Range Header Support
  let object: R2ObjectBody | null = null;

  try {
    const rawObject = rangeHeader
      ? await env.PRODUCTS_BUCKET.get(tokenRecord.r2_object_key, {
          range: request.headers,
          onlyIf: request.headers,
        })
      : await env.PRODUCTS_BUCKET.get(tokenRecord.r2_object_key);

    if (rawObject && 'body' in rawObject) {
      object = rawObject as R2ObjectBody;
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
  const isRangeRequest = !!rangeHeader && !!object.range;
  const status = isRangeRequest ? 206 : 200;

  if (isRangeRequest && object.range) {
    const offset = 'offset' in object.range && typeof object.range.offset === 'number' ? object.range.offset : 0;
    const length = 'length' in object.range && typeof object.range.length === 'number' ? object.range.length : object.size;
    const end = offset + length - 1;
    responseHeaders.set('Content-Range', `bytes ${offset}-${end}/${object.size}`);
    responseHeaders.set('Content-Length', length.toString());
  } else {
    responseHeaders.set('Content-Length', object.size.toString());
  }

  // Log successful download
  const rangeLength = isRangeRequest && object.range && 'length' in object.range && typeof object.range.length === 'number'
    ? object.range.length
    : object.size;
  await logDownloadAttempt(env.DB, cleanToken, rangeLength, ipAddress, userAgent, status);

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

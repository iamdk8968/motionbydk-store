/**
 * Version & Release Management Engine
 * Secure updater manifest, release notes, license-gated download issuance, and rollback controls.
 */

import { PluginReleaseRecord } from './types';
import { createDownloadTokenForOrder } from './db';
import { verifyLicenseKey } from './licenseManager';

export async function getLatestReleaseManifest(
  db: D1Database,
  productId: string = 'ae-workflow-pro'
): Promise<{
  id: string;
  version: string;
  latestVersion: string;
  releaseDate: string;
  title: string;
  message: string;
  releaseNotes: string;
  minAEVersion: string;
  downloadUrl: string;
  changelog: string[];
} | null> {
  const release = await db
    .prepare(
      `SELECT * FROM plugin_releases 
       WHERE product_id = ? AND is_published = 1
       ORDER BY is_latest DESC, release_date DESC, created_at DESC LIMIT 1`
    )
    .bind(productId)
    .first<PluginReleaseRecord>();

  if (!release) return null;

  const changelog = release.release_notes
    ? release.release_notes.split('\n').map(l => l.replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean)
    : [];

  return {
    id: release.id,
    version: release.version,
    latestVersion: release.version,
    releaseDate: release.release_date,
    title: release.title,
    message: release.release_notes || 'A new update is ready for download.',
    releaseNotes: release.release_notes || '',
    minAEVersion: release.min_ae_version || '15.0',
    downloadUrl: `https://www.motionbydk.in/updates.html?v=${release.version}`,
    changelog,
  };
}

export async function listPublicReleases(
  db: D1Database,
  productId: string = 'ae-workflow-pro'
): Promise<PluginReleaseRecord[]> {
  const result = await db
    .prepare(
      `SELECT id, product_id, version, title, release_notes, release_date, min_ae_version,
              file_size_bytes, download_count, is_latest, created_at
       FROM plugin_releases
       WHERE product_id = ? AND is_published = 1
       ORDER BY release_date DESC, created_at DESC`
    )
    .bind(productId)
    .all<PluginReleaseRecord>();

  return result.results || [];
}

export async function claimReleaseDownload(
  db: D1Database,
  releaseId: string,
  credential: { licenseKey?: string; orderId?: string }
): Promise<{ success: boolean; token?: string; downloadUrl?: string; message?: string }> {
  // 1. Fetch requested release by exact ID, version, or fallback to latest published
  let release = await db
    .prepare('SELECT * FROM plugin_releases WHERE id = ? AND is_published = 1')
    .bind(releaseId)
    .first<PluginReleaseRecord>();

  if (!release) {
    const cleanVer = releaseId.replace(/^(ae-workflow-pro-)?v?/i, '').trim();
    release = await db
      .prepare(
        'SELECT * FROM plugin_releases WHERE (version = ? OR version = ? OR id LIKE ?) AND is_published = 1 ORDER BY is_latest DESC, release_date DESC LIMIT 1'
      )
      .bind(cleanVer, releaseId, `%${cleanVer}%`)
      .first<PluginReleaseRecord>();
  }

  if (!release && (releaseId.toLowerCase().includes('latest') || releaseId.startsWith('ae-workflow-pro') || releaseId.includes('3.8') || releaseId.includes('3.7'))) {
    release = await db
      .prepare('SELECT * FROM plugin_releases WHERE is_published = 1 ORDER BY is_latest DESC, release_date DESC LIMIT 1')
      .first<PluginReleaseRecord>();
  }

  if (!release) {
    return { success: false, message: 'The requested release does not exist or is currently unpublished.' };
  }

  // 2. Authenticate customer entitlement via license key or order ID
  let orderIdToUse = '';

  if (credential.licenseKey) {
    const verified = await verifyLicenseKey(db, credential.licenseKey.trim());
    if (!verified.valid || !verified.active) {
      return { success: false, message: verified.message || 'Invalid or revoked license key.' };
    }

    const lic = await db
      .prepare('SELECT order_id, customer_id, product_id FROM licenses WHERE license_key = ?')
      .bind(credential.licenseKey.trim().toUpperCase())
      .first<{ order_id: string | null; customer_id: string | null; product_id: string }>();

    if (lic && lic.order_id) {
      orderIdToUse = lic.order_id;
    } else {
      // Legacy key with no prior order row: ensure synthetic legacy order exists to satisfy foreign key
      orderIdToUse = `MDK_LEGACY_${credential.licenseKey.trim().replace(/[^A-Za-z0-9]/g, '_').slice(-16)}`;
      let customerId = lic?.customer_id;
      if (!customerId) {
        const defCust = await db.prepare('SELECT id FROM customers LIMIT 1').first<{ id: string }>();
        customerId = defCust?.id || 'c0000000-0000-4000-8000-000000000001';
      }
      await db
        .prepare(
          `INSERT OR IGNORE INTO orders (
            id, order_id, customer_id, product_id, base_amount_inr,
            discount_inr, final_amount_inr, currency, status, paid_at
          ) VALUES (?, ?, ?, ?, 0, 0, 0, 'INR', 'PAID', datetime('now'))`
        )
        .bind(crypto.randomUUID(), orderIdToUse, customerId, release.product_id)
        .run();
    }
  } else if (credential.orderId) {
    const order = await db
      .prepare("SELECT order_id, status FROM orders WHERE order_id = ? AND status = 'PAID'")
      .bind(credential.orderId.trim())
      .first<{ order_id: string; status: string }>();

    if (!order) {
      return { success: false, message: 'No paid order found for this order ID.' };
    }
    orderIdToUse = order.order_id;
  } else {
    return { success: false, message: 'A valid commercial license key or paid order ID is required to download.' };
  }

  // 3. Generate secure signed R2 download token (48h TTL)
  const dt = await createDownloadTokenForOrder(db, orderIdToUse, release.r2_object_key);

  // Increment download counter on release
  await db
    .prepare('UPDATE plugin_releases SET download_count = download_count + 1 WHERE id = ?')
    .bind(release.id)
    .run();

  return {
    success: true,
    token: dt.token,
    downloadUrl: `https://motionbydk-api.motionbydk-api.workers.dev/api/download/${dt.token}`,
  };
}

export async function listAdminReleases(db: D1Database): Promise<PluginReleaseRecord[]> {
  const result = await db
    .prepare('SELECT * FROM plugin_releases ORDER BY release_date DESC, created_at DESC')
    .all<PluginReleaseRecord>();

  return result.results || [];
}

export async function createRelease(
  db: D1Database,
  data: any
): Promise<PluginReleaseRecord> {
  const id = `rel-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const productId = data.productId || data.product_id || 'ae-workflow-pro';
  const version = (data.version || '').trim();
  const title = (data.title || `MotionByDk AE Workflow Pro v${version}`).trim();
  const releaseNotes = data.releaseNotes !== undefined ? data.releaseNotes : (data.release_notes !== undefined ? data.release_notes : null);
  const releaseDate = data.releaseDate || data.release_date || now.split('T')[0];
  const minAeVersion = data.minAeVersion || data.min_ae_version || '15.0';
  const r2ObjectKey = (data.r2ObjectKey || data.r2_object_key || '').trim();
  const fileSizeBytes = Number(data.fileSizeBytes !== undefined ? data.fileSizeBytes : (data.file_size_bytes !== undefined ? data.file_size_bytes : 0)) || 0;
  const isPublished = data.isPublished !== undefined ? Number(data.isPublished) : (data.is_published !== undefined ? Number(data.is_published) : 1);
  const isLatest = data.isLatest !== undefined ? Number(data.isLatest) : (data.is_latest !== undefined ? Number(data.is_latest) : 1);

  if (isLatest === 1) {
    // Unset other releases as latest for this product
    await db
      .prepare('UPDATE plugin_releases SET is_latest = 0, updated_at = ? WHERE product_id = ?')
      .bind(now, productId)
      .run();
  }

  await db
    .prepare(
      `INSERT INTO plugin_releases (
        id, product_id, version, title, release_notes, release_date,
        min_ae_version, r2_object_key, file_size_bytes, download_count,
        is_published, is_latest, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`
    )
    .bind(
      id,
      productId,
      version,
      title,
      releaseNotes,
      releaseDate,
      minAeVersion,
      r2ObjectKey,
      fileSizeBytes,
      isPublished,
      isLatest,
      now,
      now
    )
    .run();

  const created = await db.prepare('SELECT * FROM plugin_releases WHERE id = ?').bind(id).first<PluginReleaseRecord>();
  if (!created) throw new Error('Failed to retrieve newly created release.');
  return created;
}

export async function rollbackRelease(
  db: D1Database,
  targetReleaseId: string
): Promise<PluginReleaseRecord> {
  const target = await db
    .prepare('SELECT * FROM plugin_releases WHERE id = ?')
    .bind(targetReleaseId)
    .first<PluginReleaseRecord>();

  if (!target) throw new Error('Target release not found.');

  const now = new Date().toISOString();

  // 1. Unset all latest for this product
  await db
    .prepare('UPDATE plugin_releases SET is_latest = 0, updated_at = ? WHERE product_id = ?')
    .bind(now, target.product_id)
    .run();

  // 2. Set target as latest and ensure published
  await db
    .prepare('UPDATE plugin_releases SET is_latest = 1, is_published = 1, updated_at = ? WHERE id = ?')
    .bind(now, targetReleaseId)
    .run();

  const updated = await db
    .prepare('SELECT * FROM plugin_releases WHERE id = ?')
    .bind(targetReleaseId)
    .first<PluginReleaseRecord>();

  if (!updated) throw new Error('Failed to retrieve rolled-back release.');
  return updated;
}

export async function updateRelease(
  db: D1Database,
  id: string,
  data: any
): Promise<PluginReleaseRecord> {
  const existing = await db.prepare('SELECT * FROM plugin_releases WHERE id = ?').bind(id).first<PluginReleaseRecord>();
  if (!existing) throw new Error('Release not found.');

  const now = new Date().toISOString();
  const isLatest = data.is_latest !== undefined ? Number(data.is_latest) : (data.isLatest !== undefined ? Number(data.isLatest) : undefined);
  const isPublished = data.is_published !== undefined ? Number(data.is_published) : (data.isPublished !== undefined ? Number(data.isPublished) : undefined);
  const title = data.title !== undefined ? String(data.title).trim() : null;
  const releaseNotes = data.release_notes !== undefined ? data.release_notes : (data.releaseNotes !== undefined ? data.releaseNotes : null);
  const minAeVersion = data.min_ae_version !== undefined ? data.min_ae_version : (data.minAeVersion !== undefined ? data.minAeVersion : null);

  if (isLatest === 1) {
    await db
      .prepare('UPDATE plugin_releases SET is_latest = 0, updated_at = ? WHERE product_id = ? AND id != ?')
      .bind(now, existing.product_id, id)
      .run();
  }

  await db
    .prepare(
      `UPDATE plugin_releases SET
        title = COALESCE(?, title),
        release_notes = COALESCE(?, release_notes),
        min_ae_version = COALESCE(?, min_ae_version),
        is_published = COALESCE(?, is_published),
        is_latest = COALESCE(?, is_latest),
        updated_at = ?
      WHERE id = ?`
    )
    .bind(
      title,
      releaseNotes,
      minAeVersion,
      isPublished !== undefined ? isPublished : null,
      isLatest !== undefined ? isLatest : null,
      now,
      id
    )
    .run();

  const updated = await db.prepare('SELECT * FROM plugin_releases WHERE id = ?').bind(id).first<PluginReleaseRecord>();
  if (!updated) throw new Error('Failed to retrieve updated release.');
  return updated;
}

/**
 * Product & Plugin Catalog Manager
 * Handles public catalog discovery, product specifications, and admin CRUD operations.
 */

import { ProductRecord } from './types';

export async function listPublicProducts(db: D1Database): Promise<ProductRecord[]> {
  const result = await db
    .prepare(
      `SELECT *
       FROM products
       WHERE is_active = 1 AND (status = 'PUBLISHED' OR status IS NULL)
       ORDER BY is_free ASC, price_inr DESC`
    )
    .all<ProductRecord>();

  return result.results || [];
}

export async function getPublicProduct(db: D1Database, id: string): Promise<ProductRecord | null> {
  const product = await db
    .prepare(
      `SELECT *
       FROM products
       WHERE id = ? AND is_active = 1 AND (status = 'PUBLISHED' OR status IS NULL)`
    )
    .bind(id)
    .first<ProductRecord>();

  return product || null;
}

export async function listAdminProducts(db: D1Database): Promise<ProductRecord[]> {
  const result = await db
    .prepare(
      `SELECT * FROM products ORDER BY created_at DESC`
    )
    .all<ProductRecord>();

  return result.results || [];
}

export async function createProduct(
  db: D1Database,
  data: {
    id: string;
    name: string;
    description?: string;
    price_inr: number;
    price_usd?: number;
    r2_object_key?: string;
    has_license?: number;
    max_devices?: number;
    category?: string;
    is_free?: number;
    allow_coupons?: number;
    status?: string;
    thumbnail_url?: string;
    screenshots?: string;
    compatibility?: string;
    installation_guide?: string;
    features_list?: string;
    update_policy?: string;
  }
): Promise<ProductRecord> {
  const cleanId = data.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO products (
        id, name, description, price_inr, price_usd, r2_object_key,
        has_license, max_devices, is_active, category, is_free, allow_coupons, status,
        thumbnail_url, screenshots, compatibility, installation_guide,
        features_list, update_policy, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      cleanId,
      data.name.trim(),
      data.description || null,
      data.price_inr,
      data.price_usd !== undefined ? data.price_usd : 0,
      data.r2_object_key || null,
      data.has_license !== undefined ? data.has_license : 0,
      data.max_devices !== undefined ? data.max_devices : 2,
      data.category || 'plugin',
      data.is_free !== undefined ? data.is_free : 0,
      data.allow_coupons !== undefined ? data.allow_coupons : 1,
      data.status || 'PUBLISHED',
      data.thumbnail_url || null,
      data.screenshots || null,
      data.compatibility || null,
      data.installation_guide || null,
      data.features_list || null,
      data.update_policy || null,
      now,
      now
    )
    .run();

  const product = await db.prepare('SELECT * FROM products WHERE id = ?').bind(cleanId).first<ProductRecord>();
  if (!product) throw new Error('Failed to retrieve newly created product.');
  return product;
}

export async function updateProduct(
  db: D1Database,
  id: string,
  data: Partial<ProductRecord>
): Promise<ProductRecord> {
  const existing = await db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<ProductRecord>();
  if (!existing) throw new Error('Product not found.');

  const now = new Date().toISOString();

  await db
    .prepare(
      `UPDATE products SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        price_inr = COALESCE(?, price_inr),
        price_usd = COALESCE(?, price_usd),
        r2_object_key = COALESCE(?, r2_object_key),
        has_license = COALESCE(?, has_license),
        max_devices = COALESCE(?, max_devices),
        is_active = COALESCE(?, is_active),
        category = COALESCE(?, category),
        is_free = COALESCE(?, is_free),
        allow_coupons = COALESCE(?, allow_coupons),
        status = COALESCE(?, status),
        thumbnail_url = COALESCE(?, thumbnail_url),
        screenshots = COALESCE(?, screenshots),
        compatibility = COALESCE(?, compatibility),
        installation_guide = COALESCE(?, installation_guide),
        features_list = COALESCE(?, features_list),
        update_policy = COALESCE(?, update_policy),
        updated_at = ?
      WHERE id = ?`
    )
    .bind(
      data.name !== undefined ? data.name : null,
      data.description !== undefined ? data.description : null,
      data.price_inr !== undefined ? data.price_inr : null,
      data.price_usd !== undefined ? data.price_usd : null,
      data.r2_object_key !== undefined ? data.r2_object_key : null,
      data.has_license !== undefined ? data.has_license : null,
      data.max_devices !== undefined ? data.max_devices : null,
      data.is_active !== undefined ? data.is_active : null,
      data.category !== undefined ? data.category : null,
      data.is_free !== undefined ? data.is_free : null,
      data.allow_coupons !== undefined ? data.allow_coupons : null,
      data.status !== undefined ? data.status : null,
      data.thumbnail_url !== undefined ? data.thumbnail_url : null,
      data.screenshots !== undefined ? data.screenshots : null,
      data.compatibility !== undefined ? data.compatibility : null,
      data.installation_guide !== undefined ? data.installation_guide : null,
      data.features_list !== undefined ? data.features_list : null,
      data.update_policy !== undefined ? data.update_policy : null,
      now,
      id
    )
    .run();

  const updated = await db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<ProductRecord>();
  if (!updated) throw new Error('Failed to retrieve updated product.');
  return updated;
}

export async function archiveProduct(db: D1Database, id: string): Promise<boolean> {
  const result = await db
    .prepare("UPDATE products SET is_active = 0, status = 'ARCHIVED', updated_at = datetime('now') WHERE id = ?")
    .bind(id)
    .run();

  return (result.meta.changes || 0) > 0;
}

export async function deleteProduct(db: D1Database, id: string): Promise<boolean> {
  try {
    const result = await db
      .prepare('DELETE FROM products WHERE id = ?')
      .bind(id)
      .run();
    return (result.meta.changes || 0) > 0;
  } catch (err) {
    // Fallback to archive if referenced by foreign keys (e.g. historical orders)
    return await archiveProduct(db, id);
  }
}

/**
 * Homepage CMS Manager
 * Dynamic promotional banners, announcement bars, hero CTAs, and campaign schedules.
 */

import { HomepageCmsRecord } from './types';

export async function getPublicHomepageCms(
  db: D1Database
): Promise<Record<string, {
  title: string | null;
  content: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  badgeText: string | null;
}>> {
  const now = new Date().toISOString();
  const rows = await db
    .prepare(
      `SELECT * FROM homepage_cms 
       WHERE is_active = 1 
         AND (start_date IS NULL OR start_date <= ?)
         AND (end_date IS NULL OR end_date >= ?)`
    )
    .bind(now, now)
    .all<HomepageCmsRecord>();

  const result: Record<string, any> = {};
  for (const block of rows.results || []) {
    result[block.key] = {
      title: block.title,
      content: block.content,
      ctaText: block.cta_text,
      ctaUrl: block.cta_url,
      badgeText: block.badge_text,
    };
  }

  return result;
}

export async function listAdminHomepageCms(
  db: D1Database
): Promise<HomepageCmsRecord[]> {
  const rows = await db
    .prepare('SELECT * FROM homepage_cms ORDER BY key ASC')
    .all<HomepageCmsRecord>();

  return rows.results || [];
}

export async function upsertCmsBlock(
  db: D1Database,
  key: string,
  data: {
    title?: string;
    content?: string;
    ctaText?: string;
    ctaUrl?: string;
    badgeText?: string;
    startDate?: string;
    endDate?: string;
    isActive?: number;
  }
): Promise<HomepageCmsRecord> {
  const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO homepage_cms (
        key, title, content, cta_text, cta_url, badge_text,
        start_date, end_date, is_active, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        title = COALESCE(excluded.title, homepage_cms.title),
        content = COALESCE(excluded.content, homepage_cms.content),
        cta_text = COALESCE(excluded.cta_text, homepage_cms.cta_text),
        cta_url = COALESCE(excluded.cta_url, homepage_cms.cta_url),
        badge_text = COALESCE(excluded.badge_text, homepage_cms.badge_text),
        start_date = COALESCE(excluded.start_date, homepage_cms.start_date),
        end_date = COALESCE(excluded.end_date, homepage_cms.end_date),
        is_active = COALESCE(excluded.is_active, homepage_cms.is_active),
        updated_at = excluded.updated_at`
    )
    .bind(
      cleanKey,
      data.title !== undefined ? data.title : null,
      data.content !== undefined ? data.content : null,
      data.ctaText !== undefined ? data.ctaText : null,
      data.ctaUrl !== undefined ? data.ctaUrl : null,
      data.badgeText !== undefined ? data.badgeText : null,
      data.startDate !== undefined ? data.startDate : null,
      data.endDate !== undefined ? data.endDate : null,
      data.isActive !== undefined ? data.isActive : 1,
      now
    )
    .run();

  const record = await db
    .prepare('SELECT * FROM homepage_cms WHERE key = ?')
    .bind(cleanKey)
    .first<HomepageCmsRecord>();

  if (!record) throw new Error('Failed to retrieve updated CMS block.');
  return record;
}

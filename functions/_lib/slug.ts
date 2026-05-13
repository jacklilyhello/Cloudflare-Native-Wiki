import type { Env } from './types';

export function normalizeSlug(input: string) {
  return input
    .trim()
    .replace(/^\/docs\//, '')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5/_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/\/+/g, '/')
    .replace(/^-|-$/g, '');
}

export function slugifyTitle(title: string) {
  return normalizeSlug(title)
    .replace(/[\u4e00-\u9fa5]/g, '')
    .replace(/^-|-$/g, '') || 'untitled';
}

export async function ensureUniqueSlug(env: Env, rawSlug: string, exceptPageId?: string) {
  const siteId = env.SITE_ID || 'site_default';
  const base = normalizeSlug(rawSlug || 'untitled');
  let candidate = base;
  let index = 2;

  while (true) {
    const row = await env.DB.prepare(
      `SELECT id FROM pages WHERE site_id = ? AND normalized_slug = ? LIMIT 1`
    ).bind(siteId, candidate).first<{ id: string }>();

    if (!row || row.id === exceptPageId) return candidate;
    candidate = `${base}-${index++}`;
  }
}

import type { Env } from './types';

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizeSlugPath(input: string) {
  const decoded = safeDecode(String(input || '').trim());
  return decoded
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/?docs\//i, '')
    .replace(/^\/?zh\//i, '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\s+/g, '-')
    .replace(/\/+/g, '/')
    .split('/')
    .map((segment) =>
      segment
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}_-]+/gu, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
    )
    .filter(Boolean)
    .join('/');
}

export function slugifyTitle(input: string) {
  const normalized = normalizeSlugPath(input || '');
  return normalized || 'untitled';
}

export function encodeSlugPath(input: string) {
  return splitSlugSegments(input)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function splitSlugSegments(input: string) {
  const normalized = normalizeSlugPath(input);
  return normalized ? normalized.split('/') : [];
}

export async function ensureUniqueSlug(env: Env, rawSlug: string, exceptPageId?: string) {
  const siteId = env.SITE_ID || 'site_default';
  const base = normalizeSlugPath(rawSlug || 'untitled');
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

import type { Env } from '../_lib/types';
import { ok } from '../_lib/http';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const siteId = context.env.SITE_ID || 'site_default';
  const { searchParams } = new URL(context.request.url);
  const q = (searchParams.get('q') || '').trim();
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || '20'), 1), 50);

  if (!q) return ok({ query: '', pages: [] });

  const wildcard = `%${q.toLowerCase()}%`;
  const result = await context.env.DB.prepare(
    `SELECT id, title, slug, summary, excerpt, tags_json, published_at, updated_at
     FROM pages
     WHERE site_id = ?
       AND status = 'published'
       AND visibility = 'public'
       AND (
         LOWER(title) LIKE ?
         OR LOWER(slug) LIKE ?
         OR LOWER(COALESCE(summary, '')) LIKE ?
         OR LOWER(COALESCE(excerpt, '')) LIKE ?
         OR LOWER(COALESCE(tags_json, '')) LIKE ?
         OR LOWER(COALESCE(search_text, '')) LIKE ?
       )
     ORDER BY published_at DESC, updated_at DESC
     LIMIT ?`
  ).bind(siteId, wildcard, wildcard, wildcard, wildcard, wildcard, wildcard, limit).all<any>();

  const pages = (result.results || []).map((row) => ({
    ...row,
    tags: row.tags_json ? JSON.parse(row.tags_json) : []
  }));

  return ok({ query: q, pages }, { headers: { 'cache-control': 'public, max-age=30, s-maxage=300' } });
};

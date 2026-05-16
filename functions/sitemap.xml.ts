import type { Env } from './_lib/types';
import { CACHE_KEYS } from './_lib/cache';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const siteId = context.env.SITE_ID || 'site_default';
  const forceRebuild = new URL(context.request.url).searchParams.get('rebuild') === '1';
  if (forceRebuild) await context.env.WIKI_KV.delete(CACHE_KEYS.sitemap(siteId));
  const cached = !forceRebuild ? await context.env.WIKI_KV.get(CACHE_KEYS.sitemap(siteId)) : null;
  if (cached) return new Response(cached, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600, s-maxage=86400' } });

  const result = await context.env.DB.prepare(
    `SELECT slug, updated_at, published_at FROM pages WHERE site_id = ? AND status = 'published' AND visibility = 'public' ORDER BY published_at DESC`
  ).bind(siteId).all<any>();
  const urls = (result.results || []).map((row) => `  <url><loc>${context.env.SITE_URL}/docs/${row.slug}</loc><lastmod>${(row.updated_at || row.published_at || '').slice(0, 10)}</lastmod></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${context.env.SITE_URL}/</loc></url>\n${urls}\n</urlset>`;
  context.waitUntil(context.env.WIKI_KV.put(CACHE_KEYS.sitemap(siteId), xml));
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600, s-maxage=86400' } });
};

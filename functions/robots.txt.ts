import type { Env } from './_lib/types';
import { CACHE_KEYS } from './_lib/cache';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const siteId = context.env.SITE_ID || 'site_default';
  const forceRebuild = new URL(context.request.url).searchParams.get('rebuild') === '1';
  if (forceRebuild) await context.env.WIKI_KV.delete(CACHE_KEYS.robots(siteId));
  const cached = !forceRebuild ? await context.env.WIKI_KV.get(CACHE_KEYS.robots(siteId)) : null;
  if (cached) return new Response(cached, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600, s-maxage=86400' } });
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${context.env.SITE_URL}/sitemap.xml\n`;
  context.waitUntil(context.env.WIKI_KV.put(CACHE_KEYS.robots(siteId), body));
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600, s-maxage=86400' } });
};

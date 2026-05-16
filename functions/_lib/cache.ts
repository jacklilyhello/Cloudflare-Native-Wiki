import type { Env } from './types';

export const CACHE_KEYS = {
  settings: (siteId: string) => `site:${siteId}:settings:public`,
  navigation: (siteId: string) => `site:${siteId}:navigation:tree`,
  sitemap: (siteId: string) => `site:${siteId}:sitemap:xml`,
  robots: (siteId: string) => `site:${siteId}:robots:txt`,
  pageBySlug: (siteId: string, slug: string) => `site:${siteId}:page:slug:${slug}:latest`,
  redirect: (siteId: string, slug: string) => `site:${siteId}:redirect:${slug}`
};

export async function putJson(env: Env, key: string, value: unknown, expirationTtl?: number) {
  await env.WIKI_KV.put(key, JSON.stringify(value), expirationTtl ? { expirationTtl } : undefined);
}

export async function getJson<T>(env: Env, key: string): Promise<T | null> {
  const value = await env.WIKI_KV.get(key);
  return value ? JSON.parse(value) as T : null;
}

export async function purgePageCache(env: Env, slug: string) {
  const siteId = env.SITE_ID || 'site_default';
  await env.WIKI_KV.delete(CACHE_KEYS.pageBySlug(siteId, slug));
}

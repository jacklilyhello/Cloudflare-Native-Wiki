import type { Env } from '../_lib/types';
import { ok, readJson } from '../_lib/http';
import { requireUser } from '../_lib/auth';
import { CACHE_KEYS } from '../_lib/cache';
import { normalizeSlugPath } from '../_lib/slug';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const body = await readJson<{ slug?: string }>(context.request);
  const siteId = context.env.SITE_ID || 'site_default';
  if (body.slug) {
    await context.env.WIKI_KV.delete(CACHE_KEYS.pageBySlug(siteId, normalizeSlugPath(body.slug)));
  } else {
    await Promise.all([
      context.env.WIKI_KV.delete(CACHE_KEYS.settings(siteId)),
      context.env.WIKI_KV.delete(CACHE_KEYS.navigation(siteId)),
      context.env.WIKI_KV.delete(CACHE_KEYS.sitemap(siteId))
    ]);
  }
  return ok({});
};

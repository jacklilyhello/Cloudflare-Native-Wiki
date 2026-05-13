import type { Env } from '../_lib/types';
import { normalizeSlug } from '../_lib/slug';
import { CACHE_KEYS, getJson, putJson } from '../_lib/cache';
import { getNavigationTree } from '../_lib/navigation';
import { getPublicSettings } from '../_lib/settings';
import { renderDocument } from '../_lib/render-page';

async function buildPageResponse(context: EventContext<Env, string, unknown>, slug: string) {
  const env = context.env;
  const siteId = env.SITE_ID || 'site_default';
  const key = CACHE_KEYS.pageBySlug(siteId, slug);
  const cached = await getJson<any>(env, key);

  if (cached?.fullHtml) {
    return new Response(cached.fullHtml, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=60, s-maxage=86400',
        'etag': `"${cached.contentHash || cached.versionId}"`,
        'x-wiki-cache': 'kv-hit'
      }
    });
  }

  const page = await env.DB.prepare(
    `SELECT * FROM pages WHERE site_id = ? AND normalized_slug = ? AND status = 'published' AND visibility = 'public' LIMIT 1`
  ).bind(siteId, slug).first<any>();

  if (!page) {
    const redirect = await env.DB.prepare(
      `SELECT new_slug, redirect_type FROM slug_redirects WHERE site_id = ? AND old_normalized_slug = ? LIMIT 1`
    ).bind(siteId, slug).first<any>();

    if (redirect?.new_slug) {
      return Response.redirect(`${env.SITE_URL}/docs/${redirect.new_slug}`, redirect.redirect_type || 301);
    }

    return new Response('Not found', { status: 404 });
  }

  const object = page.rendered_r2_key ? await env.ASSETS_BUCKET.get(page.rendered_r2_key) : null;
  const html = object ? await object.text() : '<p>页面尚未生成渲染快照，请重新发布。</p>';
  const toc = page.toc_json ? JSON.parse(page.toc_json) : [];
  const navigation = await getNavigationTree(env);
  const settings = await getPublicSettings(env);
  const fullHtml = renderDocument({ env, settings, navigation, page, html, toc, slug });

  context.waitUntil(putJson(env, key, {
    page,
    html,
    toc,
    fullHtml,
    contentHash: page.current_version_id,
    versionId: page.current_version_id,
    cachedAt: Date.now()
  }));

  return new Response(fullHtml, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=86400',
      'etag': `"${page.current_version_id || page.updated_at}"`,
      'x-wiki-cache': 'miss'
    }
  });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const raw = Array.isArray(context.params.slug) ? context.params.slug.join('/') : String(context.params.slug || '');
  const slug = normalizeSlug(raw);
  if (!slug) return Response.redirect(`${context.env.SITE_URL}/`, 302);

  const cacheStorage = caches as unknown as { default: Cache };
  const cache = cacheStorage.default;
  const cacheKey = new Request(context.request.url, context.request);
  const cached = await cache.match(cacheKey);
  if (cached) {
    const res = new Response(cached.body, cached);
    res.headers.set('x-wiki-cache', 'edge-hit');
    return res;
  }

  const response = await buildPageResponse(context, slug);
  if (response.ok) context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
};

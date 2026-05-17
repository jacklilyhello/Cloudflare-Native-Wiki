import type { Env } from '../_lib/types';
import { encodeSlugPath, normalizeSlugPath } from '../_lib/slug';
import { CACHE_KEYS, getJson, putJson } from '../_lib/cache';
import { getNavigationTree } from '../_lib/navigation';
import { getPublicSettings } from '../_lib/settings';
import { renderDocument } from '../_lib/render-page';

async function buildPageResponse(
  context: EventContext<Env, string, unknown>,
  slug: string,
  cache: Cache,
  cacheKey: Request
) {
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
    const slugRow = await env.DB.prepare(
      `SELECT status, visibility FROM pages WHERE site_id = ? AND normalized_slug = ? LIMIT 1`
    ).bind(siteId, slug).first<{ status: string; visibility: string }>();

    if (slugRow && (slugRow.status !== 'published' || slugRow.visibility !== 'public')) {
      return buildNotFoundResponse(slug, 'not-published');
    }

    const redirect = await env.DB.prepare(
      `SELECT new_slug, redirect_type FROM slug_redirects WHERE site_id = ? AND old_normalized_slug = ? LIMIT 1`
    ).bind(siteId, slug).first<any>();

    if (redirect?.new_slug) {
      const redirectSlug = normalizeSlugPath(redirect.new_slug);
      if (redirectSlug) {
        return Response.redirect(`/docs/${encodeSlugPath(redirectSlug)}`, redirect.redirect_type || 301);
      }
      return buildNotFoundResponse(slug, 'redirect-miss');
    }

    return buildNotFoundResponse(slug, 'not-found');
  }

  const object = page.rendered_r2_key ? await env.ASSETS_BUCKET.get(page.rendered_r2_key) : null;
  const html = object ? await object.text() : '<p>页面尚未生成渲染快照，请重新发布。</p>';
  const toc = page.toc_json ? JSON.parse(page.toc_json) : [];
  const navigation = await getNavigationTree(env);
  const settings = await getPublicSettings(env);
  const fullHtml = renderDocument({ env, settings, navigation, page, html, toc, slug });

  context.waitUntil(Promise.all([
    putJson(env, key, {
      page,
      html,
      toc,
      fullHtml,
      contentHash: page.current_version_id,
      versionId: page.current_version_id,
      cachedAt: Date.now()
    }),
    cache.put(cacheKey, new Response(fullHtml, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=60, s-maxage=86400',
        'etag': `"${page.current_version_id || page.updated_at}"`,
        'x-wiki-cache': 'edge-fill'
      }
    }))
  ]));

  return new Response(fullHtml, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=86400',
      'etag': `"${page.current_version_id || page.updated_at}"`,
      'x-wiki-cache': 'miss'
    }
  });
}

function buildNotFoundResponse(slug: string, reason: 'not-published' | 'not-found' | 'redirect-miss') {
  const notFoundHtml = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="robots" content="noindex, nofollow" /><title>页面不存在</title><style>body{font-family:Inter,system-ui,-apple-system,sans-serif;background:#0b1020;color:#e7ecff;display:grid;place-items:center;min-height:100vh;margin:0}.card{max-width:560px;padding:32px;border:1px solid #28325c;border-radius:16px;background:#121935;box-shadow:0 10px 40px rgba(0,0,0,.35)}h1{margin:0 0 12px;font-size:28px}p{opacity:.88;line-height:1.7}a{color:#7cb7ff;text-decoration:none}.meta{margin-top:16px;font-size:13px;opacity:.7}</style></head><body><main class="card"><h1>404 · 页面未找到</h1><p>你访问的文档可能已移动、重命名或暂未发布。请返回首页或使用搜索查找相关内容。</p><p><a href="/">返回首页</a></p><p class="meta">Slug: ${slug}</p></main></body></html>`;
  return new Response(notFoundHtml, {
    status: 404,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60',
      'x-wiki-reason': reason
    }
  });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const raw = Array.isArray(context.params.slug) ? context.params.slug.join('/') : String(context.params.slug || '');
  const slug = normalizeSlugPath(raw);
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

  const response = await buildPageResponse(context, slug, cache, cacheKey);
  if (response.ok && response.headers.get('x-wiki-cache') === 'kv-hit') {
    context.waitUntil(cache.put(cacheKey, response.clone()));
  }
  return response;
};

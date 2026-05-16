import type { AuthedUser, Env } from './types';
import { createId, sha256 } from './id';
import { ensureUniqueSlug, normalizeSlug, slugifyTitle } from './slug';
import { renderMarkdown } from './markdown';
import { CACHE_KEYS, putJson } from './cache';
import { getNavigationTree } from './navigation';
import { getPublicSettings } from './settings';
import { renderDocument } from './render-page';
import { writeAuditLog } from './audit';

type PublishPipelineStep = 'r2-write' | 'd1-write' | 'kv-refresh' | 'cache-rebuild';

class PublishRetryableError extends Error {
  code: string;
  failedStep: PublishPipelineStep;
  constructor(message: string, failedStep: PublishPipelineStep) {
    super(message);
    this.name = 'PublishRetryableError';
    this.code = 'PUBLISH_RETRYABLE';
    this.failedStep = failedStep;
  }
}

export async function listPages(env: Env) {
  const siteId = env.SITE_ID || 'site_default';
  const result = await env.DB.prepare(
    `SELECT id, title, slug, summary, status, updated_at, published_at
     FROM pages
     WHERE site_id = ?
     ORDER BY updated_at DESC
     LIMIT 200`
  ).bind(siteId).all();
  return result.results || [];
}

export async function getPage(env: Env, id: string) {
  const siteId = env.SITE_ID || 'site_default';
  return env.DB.prepare(`SELECT * FROM pages WHERE site_id = ? AND id = ? LIMIT 1`).bind(siteId, id).first<any>();
}

export async function getPageContent(env: Env, page: any) {
  if (!page?.content_r2_key) return '';
  const object = await env.ASSETS_BUCKET.get(page.content_r2_key);
  return object ? await object.text() : '';
}

export async function createPage(env: Env, input: { title: string; slug?: string; summary?: string }, user: AuthedUser) {
  const siteId = env.SITE_ID || 'site_default';
  const id = createId('pg');
  const slug = await ensureUniqueSlug(env, input.slug || slugifyTitle(input.title));
  await env.DB.prepare(
    `INSERT INTO pages (id, site_id, title, slug, normalized_slug, summary, status, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)`
  ).bind(id, siteId, input.title, slug, normalizeSlug(slug), input.summary || '', user.id, user.id).run();
  await writeAuditLog(env, {
    user,
    action: 'page_create',
    entityType: 'page',
    entityId: id,
    metadata: { title: input.title, slug }
  });
  return getPage(env, id);
}

export async function savePageDraft(env: Env, id: string, input: any, user: AuthedUser) {
  const page = await getPage(env, id);
  if (!page) throw new Error('Page not found');
  const siteId = env.SITE_ID || 'site_default';
  const slug = await ensureUniqueSlug(env, input.slug || page.slug, id);
  const versionNumberRow = await env.DB.prepare(`SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM page_versions WHERE page_id = ?`).bind(id).first<{ next: number }>();
  const versionId = createId('ver');
  const content = typeof input.content === 'string' ? input.content : await getPageContent(env, page);
  const contentHash = await sha256(content);
  const contentKey = `content/pages/${id}/${versionId}.md`;
  await env.ASSETS_BUCKET.put(contentKey, content, { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } });
  const statements = [
    env.DB.prepare(
      `INSERT INTO page_versions (id, site_id, page_id, version_number, title, slug, content_r2_key, content_hash, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`
    ).bind(versionId, siteId, id, versionNumberRow?.next || 1, input.title || page.title, slug, contentKey, contentHash, user.id)
  ];

  if (page.status === 'published') {
    statements.push(env.DB.prepare(
      `UPDATE pages SET content_r2_key = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(contentKey, user.id, id));
  } else {
    statements.push(env.DB.prepare(
      `UPDATE pages SET title = ?, slug = ?, normalized_slug = ?, summary = ?, status = 'draft', content_r2_key = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(input.title || page.title, slug, normalizeSlug(slug), input.summary || '', contentKey, user.id, id));
  }

  await env.DB.batch(statements);
  await writeAuditLog(env, {
    user,
    action: 'page_draft_save',
    entityType: 'page',
    entityId: id,
    metadata: { versionId, slug, contentHash }
  });
  return getPage(env, id);
}

export async function publishPage(env: Env, id: string, input: any, user: AuthedUser) {
  const before = await getPage(env, id);
  if (!before) throw new Error('Page not found');
  const previousSlug = normalizeSlug(before.slug);
  const siteId = env.SITE_ID || 'site_default';
  const slug = await ensureUniqueSlug(env, input.slug || before.slug, id);
  const content = typeof input.content === 'string' ? input.content : await getPageContent(env, before);
  const rendered = renderMarkdown(content);
  const versionId = createId('ver');
  const contentHash = await sha256(content);
  const contentKey = `content/pages/${id}/${versionId}.md`;
  const renderedKey = `rendered/pages/${id}/${versionId}.html`;
  let pipelineStep: PublishPipelineStep = 'r2-write';
  let compensationExecuted = false;
  try {
    await env.ASSETS_BUCKET.put(contentKey, content, { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } });
    await env.ASSETS_BUCKET.put(renderedKey, rendered.html, { httpMetadata: { contentType: 'text/html; charset=utf-8' } });
  } catch (error) {
    await writeAuditLog(env, {
      user,
      action: 'page_publish_failed',
      entityType: 'page',
      entityId: id,
      metadata: { versionId, oldSlug: previousSlug, newSlug: normalizeSlug(slug), contentHash, pipelineStep, failedStep: pipelineStep, compensationExecuted }
    });
    throw error;
  }

  const latest = await env.DB.prepare(`SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM page_versions WHERE page_id = ?`).bind(id).first<{ next: number }>();
  const newSlug = normalizeSlug(slug);
  const oldSlug = previousSlug;

  const batch = [
    env.DB.prepare(
      `INSERT INTO page_versions (id, site_id, page_id, version_number, title, slug, content_r2_key, rendered_r2_key, content_hash, toc_json, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)`
    ).bind(versionId, siteId, id, latest?.next || 1, input.title || before.title, newSlug, contentKey, renderedKey, contentHash, JSON.stringify(rendered.toc), user.id),
    env.DB.prepare(
      `UPDATE pages SET title = ?, slug = ?, normalized_slug = ?, summary = ?, status = 'published', current_version_id = ?, content_r2_key = ?, rendered_r2_key = ?, toc_json = ?, reading_time = ?, word_count = ?, updated_by = ?, published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(input.title || before.title, newSlug, normalizeSlug(newSlug), input.summary || before.summary || '', versionId, contentKey, renderedKey, JSON.stringify(rendered.toc), rendered.readingTime, rendered.wordCount, user.id, id)
  ];

  if (oldSlug && oldSlug !== newSlug) {
    batch.push(env.DB.prepare(
      `INSERT OR REPLACE INTO slug_redirects (id, site_id, page_id, old_slug, old_normalized_slug, new_slug, redirect_type)
       VALUES (?, ?, ?, ?, ?, ?, 301)`
    ).bind(createId('redir'), siteId, id, oldSlug, normalizeSlug(oldSlug), newSlug));
  }

  pipelineStep = 'd1-write';
  try {
    await env.DB.batch(batch);
  } catch (error) {
    compensationExecuted = true;
    await Promise.allSettled([
      env.ASSETS_BUCKET.delete(contentKey),
      env.ASSETS_BUCKET.delete(renderedKey)
    ]);
    await writeAuditLog(env, {
      user,
      action: 'page_publish_failed',
      entityType: 'page',
      entityId: id,
      metadata: { versionId, oldSlug, newSlug, contentHash, pipelineStep, failedStep: pipelineStep, compensationExecuted }
    });
    throw error;
  }
  const updated = await getPage(env, id);
  pipelineStep = 'kv-refresh';
  try {
    if (oldSlug) await env.WIKI_KV.delete(CACHE_KEYS.pageBySlug(siteId, oldSlug));
    await env.WIKI_KV.delete(CACHE_KEYS.pageBySlug(siteId, newSlug));
    await env.WIKI_KV.delete(CACHE_KEYS.navigation(siteId));
    await env.WIKI_KV.delete(CACHE_KEYS.sitemap(siteId));
    await env.WIKI_KV.delete(CACHE_KEYS.settings(siteId));
  } catch {
    await writeAuditLog(env, {
      user,
      action: 'page_publish_failed',
      entityType: 'page',
      entityId: id,
      metadata: { versionId, oldSlug, newSlug, contentHash, pipelineStep, failedStep: pipelineStep, compensationExecuted }
    });
    throw new PublishRetryableError('KV refresh failed, please retry', pipelineStep);
  }

  pipelineStep = 'cache-rebuild';
  try {
    const navigation = await getNavigationTree(env);
    const settings = await getPublicSettings(env);
    const fullHtml = renderDocument({ env, settings, navigation, page: updated, html: rendered.html, toc: rendered.toc, slug: newSlug });
    await putJson(env, CACHE_KEYS.pageBySlug(siteId, newSlug), {
      page: updated,
      html: rendered.html,
      toc: rendered.toc,
      fullHtml,
      contentHash,
      versionId,
      cachedAt: Date.now()
    });
    const cache = (caches as unknown as { default: Cache }).default;
    const oldUrl = `${env.SITE_URL}/docs/${oldSlug}`;
    const newUrl = `${env.SITE_URL}/docs/${newSlug}`;
    if (oldSlug && oldSlug !== newSlug) {
      await cache.delete(new Request(oldUrl, { method: 'GET' }));
    }
    await cache.delete(new Request(newUrl, { method: 'GET' }));
    await cache.put(new Request(newUrl, { method: 'GET' }), new Response(fullHtml, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=60, s-maxage=86400',
        'etag': `"${contentHash || versionId}"`,
        'x-wiki-cache': 'edge-refresh'
      }
    }));
  } catch {
    await writeAuditLog(env, {
      user,
      action: 'page_publish_failed',
      entityType: 'page',
      entityId: id,
      metadata: { versionId, oldSlug, newSlug, contentHash, pipelineStep, failedStep: pipelineStep, compensationExecuted }
    });
    throw new PublishRetryableError('Cache rebuild failed, please retry', pipelineStep);
  }
  await writeAuditLog(env, {
    user,
    action: 'page_publish',
    entityType: 'page',
    entityId: id,
    metadata: { versionId, oldSlug, newSlug, contentHash, pipelineStep, failedStep: null, compensationExecuted }
  });

  return updated;
}

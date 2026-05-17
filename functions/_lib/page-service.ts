import type { AuthedUser, Env } from './types';
import { createId, sha256 } from './id';
import { ensureUniqueSlug, normalizeSlugPath, slugifyTitle } from './slug';
import { renderMarkdown } from './markdown';
import { CACHE_KEYS, putJson } from './cache';
import { getNavigationTree } from './navigation';
import { getPublicSettings } from './settings';
import { renderDocument } from './render-page';
import { writeAuditLog } from './audit';

type PublishPipelineStep = 'r2-write' | 'd1-write';

function stripMarkdown(content = '') {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[>#*_~\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildExcerpt(content = '', summary = '', maxLength = 180) {
  const base = (summary || '').trim() || stripMarkdown(content);
  return base.length <= maxLength ? base : `${base.slice(0, maxLength).trimEnd()}…`;
}

function buildSearchText(input: { title?: string; slug?: string; summary?: string; excerpt?: string; tags?: string[]; content?: string }) {
  return [input.title, input.slug, input.summary, input.excerpt, (input.tags || []).join(' '), stripMarkdown(input.content || '')]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
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

export async function getPageEditorPayload(env: Env, pageId: string) {
  const page = await getPage(env, pageId);
  if (!page) return null;
  const [markdown, html, latestVersion, publishedVersion] = await Promise.all([
    getPageContent(env, page),
    page.rendered_r2_key
      ? env.ASSETS_BUCKET.get(page.rendered_r2_key).then((obj) => obj?.text() || '')
      : Promise.resolve(''),
    env.DB.prepare(`SELECT id FROM page_versions WHERE page_id = ? ORDER BY version_number DESC LIMIT 1`).bind(pageId).first<{ id: string }>(),
    env.DB.prepare(`SELECT id FROM page_versions WHERE page_id = ? AND status = 'published' ORDER BY version_number DESC LIMIT 1`).bind(pageId).first<{ id: string }>()
  ]);
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    normalized_slug: page.normalized_slug,
    status: page.status,
    markdown,
    html,
    toc: page.toc_json ? JSON.parse(page.toc_json) : [],
    tags: page.tags_json ? JSON.parse(page.tags_json) : [],
    created_at: page.created_at,
    updated_at: page.updated_at,
    latest_version_id: latestVersion?.id || null,
    published_version_id: publishedVersion?.id || null
  };
}

export async function createPage(env: Env, input: { title: string; slug?: string; summary?: string }, user: AuthedUser) {
  const siteId = env.SITE_ID || 'site_default';
  const id = createId('pg');
  const slug = await ensureUniqueSlug(env, input.slug || slugifyTitle(input.title));
  await env.DB.prepare(
    `INSERT INTO pages (id, site_id, title, slug, normalized_slug, summary, status, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)`
  ).bind(id, siteId, input.title, slug, normalizeSlugPath(slug), input.summary || '', user.id, user.id).run();
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
    ).bind(input.title || page.title, slug, normalizeSlugPath(slug), input.summary || '', contentKey, user.id, id));
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
  const previousSlug = normalizeSlugPath(before.slug);
  const siteId = env.SITE_ID || 'site_default';
  const slug = await ensureUniqueSlug(env, input.slug || before.slug, id);
  const newSlug = normalizeSlugPath(slug);
  const content = typeof input.content === 'string' ? input.content : await getPageContent(env, before);
  const rendered = renderMarkdown(content);
  const excerpt = buildExcerpt(content, input.summary || before.summary || '');
  const tags = Array.isArray(input.tags) ? input.tags.filter((item: unknown) => typeof item === 'string').map((item: string) => item.trim()).filter(Boolean) : [];
  const description = typeof input.meta_description === 'string' ? input.meta_description : (before.meta_description || '');
  const searchText = buildSearchText({
    title: input.title || before.title,
    slug: newSlug,
    summary: `${input.summary || before.summary || ''} ${description}`.trim(),
    excerpt,
    tags,
    content
  });
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
      metadata: { versionId, oldSlug: previousSlug, newSlug: normalizeSlugPath(slug), contentHash, pipelineStep, failedStep: pipelineStep, compensationExecuted }
    });
    throw error;
  }

  const latest = await env.DB.prepare(`SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM page_versions WHERE page_id = ?`).bind(id).first<{ next: number }>();
  const oldSlug = previousSlug;

  const batch = [
    env.DB.prepare(
      `INSERT INTO page_versions (id, site_id, page_id, version_number, title, slug, content_r2_key, rendered_r2_key, content_hash, toc_json, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)`
    ).bind(versionId, siteId, id, latest?.next || 1, input.title || before.title, newSlug, contentKey, renderedKey, contentHash, JSON.stringify(rendered.toc), user.id),
    env.DB.prepare(
      `UPDATE pages SET title = ?, slug = ?, normalized_slug = ?, summary = ?, excerpt = ?, tags_json = ?, search_text = ?, status = 'published', current_version_id = ?, content_r2_key = ?, rendered_r2_key = ?, toc_json = ?, reading_time = ?, word_count = ?, updated_by = ?, published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(input.title || before.title, newSlug, normalizeSlugPath(newSlug), input.summary || before.summary || '', excerpt, JSON.stringify(tags), searchText, versionId, contentKey, renderedKey, JSON.stringify(rendered.toc), rendered.readingTime, rendered.wordCount, user.id, id)
  ];

  if (oldSlug && oldSlug !== newSlug) {
    batch.push(env.DB.prepare(
      `INSERT OR REPLACE INTO slug_redirects (id, site_id, page_id, old_slug, old_normalized_slug, new_slug, redirect_type)
       VALUES (?, ?, ?, ?, ?, ?, 301)`
    ).bind(createId('redir'), siteId, id, oldSlug, normalizeSlugPath(oldSlug), newSlug));
  }

  pipelineStep = 'd1-write';
  try {
    await env.DB.batch(batch);
    if (oldSlug && oldSlug !== newSlug) {
      const redirect = await env.DB.prepare(
        `SELECT redirect_type FROM slug_redirects WHERE site_id = ? AND page_id = ? AND old_normalized_slug = ? AND new_slug = ? LIMIT 1`
      ).bind(siteId, id, oldSlug, newSlug).first<{ redirect_type: number }>();
      if (!redirect || Number(redirect.redirect_type) !== 301) {
        throw new Error('slug redirect validation failed');
      }
    }
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
  if (oldSlug) await env.WIKI_KV.delete(CACHE_KEYS.pageBySlug(siteId, oldSlug));
  await env.WIKI_KV.delete(CACHE_KEYS.sitemap(siteId));
  await env.WIKI_KV.delete(CACHE_KEYS.robots(siteId));
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
  await writeAuditLog(env, {
    user,
    action: 'page_publish',
    entityType: 'page',
    entityId: id,
    metadata: { versionId, oldSlug, newSlug, contentHash, pipelineStep, failedStep: null, compensationExecuted }
  });

  return updated;
}

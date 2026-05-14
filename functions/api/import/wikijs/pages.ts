import type { Env } from '../../../_lib/types';
import { ok, readJson } from '../../../_lib/http';
import { requireUser } from '../../../_lib/auth';
import { createId } from '../../../_lib/id';
import { normalizeSlug } from '../../../_lib/slug';
import { renderMarkdown } from '../../../_lib/markdown';
import { CACHE_KEYS } from '../../../_lib/cache';

type WikiPage = { path: string; title: string; description?: string; content?: string; isPublished?: boolean; updatedAt?: string; createdAt?: string; localeCode?: string; tags?: string[] };
type WikiHistory = { pagePath?: string; path?: string; title?: string; content?: string; createdAt?: string; versionNumber?: number };

function mapSlug(path: string) {
  const raw = normalizeSlug(path || '');
  if (!raw) return 'home';
  if (raw === 'home' || raw === 'zh/home') return 'home';
  return raw.startsWith('zh/') ? raw.slice(3) : raw;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const body = await readJson<{ pages: WikiPage[]; history?: WikiHistory[]; jobId?: string; pageOffset?: number; pageLimit?: number }>(context.request);
  const siteId = context.env.SITE_ID || 'site_default';
  const allPages = body.pages || [];
  const offset = body.pageOffset || 0;
  const limit = body.pageLimit || allPages.length || 1;
  const pages = allPages.slice(offset, offset + limit);
  const history = body.history || [];
  let imported = 0;

  for (const row of pages) {
    const slug = mapSlug(row.path);
    const oldSlug = normalizeSlug(row.path || '');
    const pageId = createId('pg');
    const versionId = createId('ver');
    const content = row.content || '';
    const rendered = renderMarkdown(content);
    const contentKey = `content/pages/${pageId}/${versionId}.md`;
    const renderedKey = `rendered/pages/${pageId}/${versionId}.html`;
    await context.env.ASSETS_BUCKET.put(contentKey, content, { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } });
    await context.env.ASSETS_BUCKET.put(renderedKey, rendered.html, { httpMetadata: { contentType: 'text/html; charset=utf-8' } });

    await context.env.DB.prepare(
      `INSERT OR REPLACE INTO pages (id, site_id, title, slug, normalized_slug, summary, status, visibility, current_version_id, content_r2_key, rendered_r2_key, toc_json, meta_title, meta_description, reading_time, word_count, created_by, updated_by, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'public', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END)`
    ).bind(pageId, siteId, row.title || slug, slug, normalizeSlug(slug), row.description || '', row.isPublished ? 'published' : 'draft', versionId, contentKey, renderedKey, JSON.stringify(rendered.toc), row.title || slug, row.description || '', rendered.readingTime, rendered.wordCount, user.id, user.id, row.isPublished ? 'published' : 'draft').run();

    await context.env.DB.prepare(
      `INSERT INTO page_versions (id, site_id, page_id, version_number, title, slug, content_r2_key, rendered_r2_key, content_hash, toc_json, status, created_by)
       VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(versionId, siteId, pageId, row.title || slug, slug, contentKey, renderedKey, versionId, JSON.stringify(rendered.toc), row.isPublished ? 'published' : 'draft', user.id).run();

    const pageHistory = history.filter((h) => normalizeSlug(h.path || h.pagePath || '') === oldSlug);
    let seq = 2;
    for (const h of pageHistory) {
      const hVer = createId('ver');
      const hContent = h.content || '';
      const hRendered = renderMarkdown(hContent);
      const hContentKey = `content/pages/${pageId}/${hVer}.md`;
      const hRenderedKey = `rendered/pages/${pageId}/${hVer}.html`;
      await context.env.ASSETS_BUCKET.put(hContentKey, hContent, { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } });
      await context.env.ASSETS_BUCKET.put(hRenderedKey, hRendered.html, { httpMetadata: { contentType: 'text/html; charset=utf-8' } });
      await context.env.DB.prepare(
        `INSERT INTO page_versions (id, site_id, page_id, version_number, title, slug, content_r2_key, rendered_r2_key, content_hash, toc_json, status, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`
      ).bind(hVer, siteId, pageId, h.versionNumber || seq, h.title || row.title || slug, slug, hContentKey, hRenderedKey, hVer, JSON.stringify(hRendered.toc), 'draft', user.id, h.createdAt || null).run();
      seq++;
    }

    if (oldSlug && oldSlug !== normalizeSlug(slug)) {
      await context.env.DB.prepare(
        `INSERT OR REPLACE INTO slug_redirects (id, site_id, page_id, old_slug, old_normalized_slug, new_slug, redirect_type)
         VALUES (?, ?, ?, ?, ?, ?, 301)`
      ).bind(createId('redir'), siteId, pageId, oldSlug, oldSlug, normalizeSlug(slug)).run();
      await context.env.WIKI_KV.put(CACHE_KEYS.redirect(siteId, oldSlug), `/docs/${normalizeSlug(slug)}`);
    }
    await context.env.WIKI_KV.delete(CACHE_KEYS.pageBySlug(siteId, normalizeSlug(slug)));
    imported++;
  }

  await context.env.WIKI_KV.delete(CACHE_KEYS.sitemap(siteId));
  if (body.jobId) await context.env.DB.prepare(`UPDATE import_jobs SET processed_items = processed_items + ?, progress = MIN(100, CAST((processed_items + ?) * 100.0 / CASE WHEN total_items <= 0 THEN 1 ELSE total_items END AS INTEGER)), updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(pages.length, pages.length, body.jobId).run();
  return ok({ imported });
};

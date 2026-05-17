import type { Env } from '../../_lib/types';
import { ok, error, readJson } from '../../_lib/http';
import { requireUser } from '../../_lib/auth';
import { getPage, getPageEditorPayload } from '../../_lib/page-service';
import { ensureUniqueSlug, normalizeSlugPath } from '../../_lib/slug';
import { CACHE_KEYS, purgePageRelatedCaches } from '../../_lib/cache';
import { writeAuditLog } from '../../_lib/audit';
import { createId } from '../../_lib/id';
import { removeDeletedPageFromNavigation } from '../../_lib/navigation';

function getId(context: EventContext<Env, string, unknown>) {
  return String(context.params.id || '');
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const pageId = getId(context);
  const siteId = context.env.SITE_ID || 'site_default';
  const rawPage = await context.env.DB.prepare(`SELECT * FROM pages WHERE site_id = ? AND id = ? LIMIT 1`).bind(siteId, pageId).first<any>();
  if (!rawPage) return error('Page not found', 404, 'PAGE_NOT_FOUND', { pageId });
  if (rawPage.status === 'deleted' || rawPage.deleted_at) return error('Page has been deleted', 410, 'PAGE_DELETED', { pageId });
  const page = await getPageEditorPayload(context.env, pageId);
  if (!page) return ok({ page: { id: rawPage.id, title: rawPage.title, slug: rawPage.slug, normalized_slug: rawPage.normalized_slug, status: rawPage.status, markdown: '', html: '', toc: [], tags: [], created_at: rawPage.created_at, updated_at: rawPage.updated_at, latest_version_id: rawPage.current_version_id || null, published_version_id: null }, warning: 'PAGE_VERSION_MISSING' });
  return ok({ page });
};

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const id = getId(context);
  const page = await getPage(context.env, id);
  if (!page) return error('Page not found', 404);
  const body = await readJson<any>(context.request);
  const slug = await ensureUniqueSlug(context.env, body.slug || page.slug, id);
  const siteId = context.env.SITE_ID || 'site_default';
  const oldSlug = normalizeSlugPath(page.slug);
  const newSlug = normalizeSlugPath(slug);
  await context.env.DB.prepare(
    `UPDATE pages SET title = ?, slug = ?, normalized_slug = ?, summary = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(body.title || page.title, slug, newSlug, body.summary || page.summary || '', user.id, id).run();
  if (page.status === 'published' && oldSlug && oldSlug !== newSlug) {
    await context.env.DB.prepare(
      `INSERT OR REPLACE INTO slug_redirects (id, site_id, page_id, old_slug, old_normalized_slug, new_slug, redirect_type)
       VALUES (?, ?, ?, ?, ?, ?, 301)`
    ).bind(createId('redir'), siteId, id, oldSlug, oldSlug, newSlug).run();
    const redirect = await context.env.DB.prepare(
      `SELECT redirect_type FROM slug_redirects WHERE site_id = ? AND page_id = ? AND old_normalized_slug = ? AND new_slug = ? LIMIT 1`
    ).bind(siteId, id, oldSlug, newSlug).first<{ redirect_type: number }>();
    if (!redirect || Number(redirect.redirect_type) !== 301) {
      throw new Error('slug redirect validation failed');
    }
  }
  await Promise.all([
    context.env.WIKI_KV.delete(CACHE_KEYS.pageBySlug(siteId, oldSlug)),
    context.env.WIKI_KV.delete(CACHE_KEYS.pageBySlug(siteId, newSlug)),
    context.env.WIKI_KV.delete(CACHE_KEYS.sitemap(siteId))
  ]);
  await writeAuditLog(context.env, {
    user,
    request: context.request,
    action: 'page_update',
    entityType: 'page',
    entityId: id,
    metadata: { oldSlug, newSlug }
  });
  return ok({ page: await getPage(context.env, id) });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const id = getId(context);
  const siteId = context.env.SITE_ID || 'site_default';
  const page = await context.env.DB.prepare(
    `SELECT * FROM pages WHERE site_id = ? AND id = ? LIMIT 1`
  ).bind(siteId, id).first<any>();
  if (!page) return error('Page not found', 404);
  const normalizedSlug = normalizeSlugPath(page.slug);
  const isSoftDeleted = page.status === 'deleted';
  if (!isSoftDeleted) {
    await context.env.DB.prepare(
      `UPDATE pages SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP, deleted_by = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE site_id = ? AND id = ?`
    ).bind(user.id, user.id, siteId, id).run();
  }
  const navImpact = await removeDeletedPageFromNavigation(context.env, id);
  const purgedCacheKeys = await purgePageRelatedCaches(context.env, { pageId: id, slug: normalizedSlug });
  await writeAuditLog(context.env, {
    user,
    request: context.request,
    action: 'page_delete',
    entityType: 'page',
    entityId: id,
    metadata: {
      slug: page.slug,
      title: page.title,
      softDeleted: !isSoftDeleted,
      cacheKeysPurged: purgedCacheKeys,
      navigationImpactedNodes: navImpact.affectedCount,
      navigationImpactedNodeIds: navImpact.affectedNodeIds
    }
  });
  return ok({});
};

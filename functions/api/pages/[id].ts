import type { Env } from '../../_lib/types';
import { json, error, readJson } from '../../_lib/http';
import { requireUser } from '../../_lib/auth';
import { getPage, getPageContent } from '../../_lib/page-service';
import { ensureUniqueSlug, normalizeSlug } from '../../_lib/slug';
import { CACHE_KEYS } from '../../_lib/cache';
import { writeAuditLog } from '../../_lib/audit';
import { createId } from '../../_lib/id';

function getId(context: EventContext<Env, string, unknown>) {
  return String(context.params.id || '');
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const page = await getPage(context.env, getId(context));
  if (!page) return error('Page not found', 404);
  const content = await getPageContent(context.env, page);
  return json({ page, content });
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
  const oldSlug = normalizeSlug(page.slug);
  const newSlug = normalizeSlug(slug);
  await context.env.DB.prepare(
    `UPDATE pages SET title = ?, slug = ?, normalized_slug = ?, summary = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(body.title || page.title, slug, newSlug, body.summary || page.summary || '', user.id, id).run();
  if (page.status === 'published' && oldSlug && oldSlug !== newSlug) {
    await context.env.DB.prepare(
      `INSERT OR REPLACE INTO slug_redirects (id, site_id, page_id, old_slug, old_normalized_slug, new_slug, redirect_type)
       VALUES (?, ?, ?, ?, ?, ?, 301)`
    ).bind(createId('redir'), siteId, id, oldSlug, oldSlug, newSlug).run();
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
  return json({ page: await getPage(context.env, id) });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const id = getId(context);
  const page = await getPage(context.env, id);
  if (!page) return error('Page not found', 404);
  const siteId = context.env.SITE_ID || 'site_default';
  await context.env.DB.prepare(`DELETE FROM pages WHERE id = ?`).bind(id).run();
  await Promise.all([
    context.env.WIKI_KV.delete(CACHE_KEYS.pageBySlug(siteId, normalizeSlug(page.slug))),
    context.env.WIKI_KV.delete(CACHE_KEYS.sitemap(siteId))
  ]);
  await writeAuditLog(context.env, {
    user,
    request: context.request,
    action: 'page_delete',
    entityType: 'page',
    entityId: id,
    metadata: { slug: page.slug, title: page.title }
  });
  return json({ ok: true });
};

import type { Env } from '../../../_lib/types';
import { ok } from '../../../_lib/http';
import { requireUser } from '../../../_lib/auth';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context); if (user instanceof Response) return user;
  const siteId = context.env.SITE_ID || 'site_default';
  const total = await context.env.DB.prepare(`SELECT COUNT(*) c FROM pages WHERE site_id=?`).bind(siteId).first<any>();
  const visible = await context.env.DB.prepare(`SELECT COUNT(*) c FROM pages WHERE site_id=? AND status!='deleted' AND deleted_at IS NULL`).bind(siteId).first<any>();
  const rows = await context.env.DB.prepare(`SELECT p.id,p.title,p.slug,p.normalized_slug,p.status,p.deleted_at,p.current_version_id,p.content_r2_key,p.rendered_r2_key, CASE WHEN EXISTS(SELECT 1 FROM page_versions v WHERE v.id=p.current_version_id) THEN 1 ELSE 0 END AS has_current_version FROM pages p WHERE p.site_id=? AND p.status!='deleted' ORDER BY p.updated_at DESC LIMIT 20`).bind(siteId).all<any>();
  const nullIds = await context.env.DB.prepare(`SELECT COUNT(*) c FROM pages WHERE site_id=? AND (id IS NULL OR trim(id)='')`).bind(siteId).first<any>();
  const badSlug = await context.env.DB.prepare(`SELECT COUNT(*) c FROM pages WHERE site_id=? AND slug LIKE '/docs/%'`).bind(siteId).first<any>();
  const badNorm = await context.env.DB.prepare(`SELECT COUNT(*) c FROM pages WHERE site_id=? AND normalized_slug LIKE '/docs/%'`).bind(siteId).first<any>();
  const missingCurrent = await context.env.DB.prepare(`SELECT COUNT(*) c FROM pages WHERE site_id=? AND (current_version_id IS NULL OR current_version_id='')`).bind(siteId).first<any>();
  const brokenCurrent = await context.env.DB.prepare(`SELECT COUNT(*) c FROM pages p WHERE p.site_id=? AND p.current_version_id IS NOT NULL AND p.current_version_id!='' AND NOT EXISTS(SELECT 1 FROM page_versions v WHERE v.id=p.current_version_id)`).bind(siteId).first<any>();
  return ok({ siteId, totalPages: total?.c || 0, visiblePages: visible?.c || 0, visibleRows: rows.results || [], pagesWithNullId: nullIds?.c || 0, pagesSlugStartsWithDocs: badSlug?.c || 0, pagesNormalizedSlugStartsWithDocs: badNorm?.c || 0, pagesCurrentVersionNull: missingCurrent?.c || 0, pagesCurrentVersionBroken: brokenCurrent?.c || 0 });
};

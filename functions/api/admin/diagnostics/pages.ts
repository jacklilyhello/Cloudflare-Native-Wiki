import type { Env } from '../../../_lib/types';
import { ok } from '../../../_lib/http';
import { requireUser } from '../../../_lib/auth';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const siteId = context.env.SITE_ID || 'site_default';
  const [summary, suspicious] = await Promise.all([
    context.env.DB.prepare(`SELECT COUNT(*) AS total_pages, SUM(CASE WHEN status != 'deleted' AND deleted_at IS NULL THEN 1 ELSE 0 END) AS visible_pages, SUM(CASE WHEN status = 'deleted' OR deleted_at IS NOT NULL THEN 1 ELSE 0 END) AS deleted_pages, SUM(CASE WHEN current_version_id IS NULL OR current_version_id = '' THEN 1 ELSE 0 END) AS pages_without_latest_version, SUM(CASE WHEN slug LIKE '/docs/%' THEN 1 ELSE 0 END) AS pages_with_docs_slug_prefix, SUM(CASE WHEN normalized_slug LIKE '/docs/%' THEN 1 ELSE 0 END) AS pages_with_docs_normalized_prefix, SUM(CASE WHEN current_version_id IS NOT NULL AND current_version_id != '' AND NOT EXISTS (SELECT 1 FROM page_versions v WHERE v.id = pages.current_version_id) THEN 1 ELSE 0 END) AS pages_with_missing_latest_version_ref, SUM(CASE WHEN status = 'published' AND NOT EXISTS (SELECT 1 FROM page_versions v WHERE v.page_id = pages.id AND v.status = 'published') THEN 1 ELSE 0 END) AS pages_with_missing_published_version_ref FROM pages WHERE site_id = ?`).bind(siteId).first<any>(),
    context.env.DB.prepare(`SELECT p.id, p.title, p.slug, p.normalized_slug, p.status, p.deleted_at, p.current_version_id AS latest_version_id, (SELECT v.id FROM page_versions v WHERE v.page_id = p.id AND v.status = 'published' ORDER BY v.version_number DESC LIMIT 1) AS published_version_id, CASE WHEN EXISTS(SELECT 1 FROM page_versions v WHERE v.id = p.current_version_id) THEN 1 ELSE 0 END AS has_latest_version, CASE WHEN EXISTS(SELECT 1 FROM page_versions v WHERE v.page_id = p.id AND v.status = 'published') THEN 1 ELSE 0 END AS has_published_version FROM pages p WHERE p.site_id = ? AND (p.slug LIKE '/docs/%' OR p.normalized_slug LIKE '/docs/%' OR p.current_version_id IS NULL OR p.current_version_id = '' OR (p.current_version_id IS NOT NULL AND p.current_version_id != '' AND NOT EXISTS (SELECT 1 FROM page_versions v WHERE v.id = p.current_version_id)) OR (p.status = 'published' AND NOT EXISTS (SELECT 1 FROM page_versions v WHERE v.page_id = p.id AND v.status = 'published'))) ORDER BY p.updated_at DESC LIMIT 20`).bind(siteId).all<any>()
  ]);

  return ok({ diagnostics: { ...summary, suspicious_rows: suspicious.results || [] } });
};

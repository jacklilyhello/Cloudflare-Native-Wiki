import type { Env } from '../../_lib/types';
import { ok } from '../../_lib/http';
import { requireUser } from '../../_lib/auth';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context); if (user instanceof Response) return user;
  const siteId = context.env.SITE_ID || 'site_default';
  const warnings: string[] = [];
  const data: any = { counts: {}, recent_pages: [], recent_audit_logs: [], recent_import_jobs: [], diagnostics: {}, warnings, build: { commit: (context.env as any).CF_PAGES_COMMIT_SHA || 'unknown', branch: (context.env as any).CF_PAGES_BRANCH || 'unknown', url: (context.env as any).CF_PAGES_URL || 'unknown' } };
  const run = async (label: string, fn: () => Promise<any>, fallback: any) => { try { return await fn(); } catch (e: any) { warnings.push(`${label}: ${e?.message || 'query failed'}`); return fallback; } };
  data.counts = await run('counts', async () => await context.env.DB.prepare(`SELECT COUNT(*) total_pages, SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) published_pages, SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) draft_pages, SUM(CASE WHEN status='deleted' OR deleted_at IS NOT NULL THEN 1 ELSE 0 END) deleted_pages FROM pages WHERE site_id = ?`).bind(siteId).first<any>(), {});
  const assets = await run('assets', async () => await context.env.DB.prepare(`SELECT COUNT(*) asset_count FROM assets WHERE site_id = ?`).bind(siteId).first<any>(), { asset_count: 0 });
  const nav = await run('navigation', async () => await context.env.DB.prepare(`SELECT COUNT(*) navigation_count FROM navigation WHERE site_id = ?`).bind(siteId).first<any>(), { navigation_count: 0 });
  data.counts = { ...data.counts, asset_count: assets.asset_count || 0, navigation_count: nav.navigation_count || 0 };
  data.recent_pages = (await run('recent_pages', async () => (await context.env.DB.prepare(`SELECT id,title,slug,status,updated_at FROM pages WHERE site_id=? AND status!='deleted' ORDER BY updated_at DESC LIMIT 5`).bind(siteId).all<any>()).results, []) ) || [];
  data.recent_audit_logs = (await run('audit_logs', async () => (await context.env.DB.prepare(`SELECT created_at,action,user_id,entity_type,entity_id FROM audit_logs WHERE site_id=? ORDER BY created_at DESC LIMIT 5`).bind(siteId).all<any>()).results, []) ) || [];
  data.recent_import_jobs = (await run('import_jobs', async () => (await context.env.DB.prepare(`SELECT id,source,status,progress,created_at FROM import_jobs WHERE site_id=? ORDER BY created_at DESC LIMIT 5`).bind(siteId).all<any>()).results, []) ) || [];
  data.diagnostics = await run('diagnostics', async () => await context.env.DB.prepare(`SELECT SUM(CASE WHEN slug LIKE '/docs/%' OR normalized_slug LIKE '/docs/%' THEN 1 ELSE 0 END) bad_slugs, SUM(CASE WHEN current_version_id IS NULL OR current_version_id = '' THEN 1 ELSE 0 END) missing_latest FROM pages WHERE site_id = ?`).bind(siteId).first<any>(), {});
  return ok(data);
};

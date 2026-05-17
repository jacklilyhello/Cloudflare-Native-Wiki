import type { Env } from '../../../_lib/types';
import { ok, readJson } from '../../../_lib/http';
import { requireUser } from '../../../_lib/auth';
import { createId } from '../../../_lib/id';
import { parseWikiExportTarGz } from './_shared';
import { replaceNavigationTree } from '../../../_lib/navigation';
import { writeAuditLog } from '../../../_lib/audit';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context); if (user instanceof Response) return user;
  const body = await readJson<{ key: string }>(context.request);
  const siteId = context.env.SITE_ID || 'site_default';
  const jobId = createId('job');
  const obj = await context.env.ASSETS_BUCKET.get(body.key);
  if (!obj) return new Response('upload not found', { status: 404 });
  const parsed = parseWikiExportTarGz(new Uint8Array(await obj.arrayBuffer()));
  const pages = parsed.pages || [];
  const fail: Array<{ title: string; reason: string }> = [];
  let success = 0; let skipped = 0;

  await context.env.DB.prepare(`INSERT INTO import_jobs (id, site_id, source, status, total_items, created_by) VALUES (?, ?, 'wikijs', 'running', ?, ?)`)
    .bind(jobId, siteId, pages.length, user.id).run();

  for (const p of pages) {
    try {
      if (!p.path) { skipped++; fail.push({ title: p.title || '', reason: 'missing path' }); continue; }
      const slug = String(p.path).replace(/^\/+|\/+$/g, '') || 'home';
      const existing = await context.env.DB.prepare(`SELECT id FROM pages WHERE site_id=? AND normalized_slug=? LIMIT 1`).bind(siteId, slug).first<{id:string}>();
      if (existing) { skipped++; continue; }
      const pageId = createId('pg'); const verId = createId('ver');
      await context.env.DB.prepare(`INSERT INTO pages (id, site_id, title, slug, normalized_slug, status, current_version_id, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(pageId, siteId, p.title || slug, slug, slug, p.isPublished ? 'published' : 'draft', verId, user.id, user.id).run();
      await context.env.DB.prepare(`INSERT INTO page_versions (id, site_id, page_id, version_number, title, slug, content_r2_key, content_hash, status, created_by) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`)
        .bind(verId, siteId, pageId, p.title || slug, slug, '', verId, p.isPublished ? 'published' : 'draft', user.id).run();
      success++;
    } catch (e:any) { fail.push({ title: p.title || '', reason: e?.message || 'import failed' }); }
  }

  const navTree = parsed.navigationTree || [];
  if (navTree.length) await replaceNavigationTree(context.env, navTree);
  await writeAuditLog(context.env, { user, request: context.request, action: 'import.confirm', entityType: 'import_job', entityId: jobId, metadata: { total: pages.length, success, skipped, failed: fail.length } });
  await context.env.DB.prepare(`UPDATE import_jobs SET status='done', processed_items=?, progress=100, summary_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .bind(success + skipped + fail.length, JSON.stringify({ success, skipped, failed: fail.length }), jobId).run();

  return ok({
    jobId,
    stats: {
      totalFiles: parsed.totalFiles || 0,
      pages: { success, skipped, failed: fail.length },
      failureReasons: fail.reduce((m: Record<string, number>, f: any) => { m[f.reason] = (m[f.reason] || 0) + 1; return m; }, {}),
      samples: pages.slice(0, 10).map((p: any, i: number) => ({ title: p.title || '', slug: p.path || '', status: i < success ? 'success' : 'skipped' })),
      refreshed: { navigation: !!navTree.length, cache: true }
    },
    failures: fail.slice(0, 50)
  });
};

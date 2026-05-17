import type { Env } from '../../../../../_lib/types';
import { ok, error } from '../../../../../_lib/http';
import { requireUser } from '../../../../../_lib/auth';
import { createId, sha256 } from '../../../../../_lib/id';
import { writeAuditLog } from '../../../../../_lib/audit';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const pageId = String(context.params.id);
  const versionId = String(context.params.versionId);
  const siteId = context.env.SITE_ID || 'site_default';
  const version = await context.env.DB.prepare(`SELECT * FROM page_versions WHERE site_id=? AND page_id=? AND id=? LIMIT 1`).bind(siteId, pageId, versionId).first<any>();
  if (!version) return error('Version not found', 404, 'VERSION_NOT_FOUND', { pageId, versionId });
  const source = await context.env.ASSETS_BUCKET.get(version.content_r2_key);
  const markdown = source ? await source.text() : '';
  const newVersionId = createId('ver');
  const next = await context.env.DB.prepare(`SELECT COALESCE(MAX(version_number),0)+1 as n FROM page_versions WHERE page_id=?`).bind(pageId).first<any>();
  const contentHash = await sha256(markdown);
  const contentKey = `content/pages/${pageId}/${newVersionId}.md`;
  await context.env.ASSETS_BUCKET.put(contentKey, markdown, { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } });
  await context.env.DB.batch([
    context.env.DB.prepare(`INSERT INTO page_versions (id,site_id,page_id,version_number,title,slug,content_r2_key,content_hash,status,created_by,change_note) VALUES (?,?,?,?,?,?,?,?, 'draft',?,?)`).bind(newVersionId, siteId, pageId, next?.n || 1, version.title, version.slug, contentKey, contentHash, user.id, `restore from ${versionId}`),
    context.env.DB.prepare(`UPDATE pages SET current_version_id=?, content_r2_key=?, status='draft', updated_by=?, updated_at=CURRENT_TIMESTAMP WHERE site_id=? AND id=?`).bind(newVersionId, contentKey, user.id, siteId, pageId)
  ]);
  await writeAuditLog(context.env, { user, request: context.request, action: 'version_restore', entityType: 'page', entityId: pageId, metadata: { fromVersionId: versionId, toVersionId: newVersionId } });
  return ok({ restoredVersionId: newVersionId });
};

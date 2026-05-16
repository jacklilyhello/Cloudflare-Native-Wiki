import type { Env } from '../../_lib/types';
import { error, ok, readJson } from '../../_lib/http';
import { requireUser } from '../../_lib/auth';
import { writeAuditLog } from '../../_lib/audit';

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const siteId = context.env.SITE_ID || 'site_default';
  const id = Array.isArray(context.params.id) ? context.params.id[0] : context.params.id;
  if (!id) return error('asset id is required', 400);

  const body = await readJson<{ alt_text?: string }>(context.request);
  const altText = (body.alt_text || '').trim();
  const result = await context.env.DB.prepare(
    `UPDATE assets SET alt_text = ? WHERE id = ? AND site_id = ?`
  ).bind(altText || null, id, siteId).run();
  if (!result.success || !result.meta?.changes) return error('asset not found', 404);

  await writeAuditLog(context.env, {
    user,
    request: context.request,
    action: 'asset_alt_text_update',
    entityType: 'asset',
    entityId: id,
    metadata: { altText }
  });
  return ok({ id, alt_text: altText });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const siteId = context.env.SITE_ID || 'site_default';
  const id = Array.isArray(context.params.id) ? context.params.id[0] : context.params.id;
  if (!id) return error('asset id is required', 400);

  const row = await context.env.DB.prepare(
    `SELECT id, r2_key, original_filename, mime_type FROM assets WHERE id = ? AND site_id = ?`
  ).bind(id, siteId).first<{ id: string; r2_key: string; original_filename: string; mime_type: string }>();
  if (!row) return error('asset not found', 404);

  await context.env.ASSETS_BUCKET.delete(row.r2_key);
  await context.env.DB.prepare(`DELETE FROM assets WHERE id = ? AND site_id = ?`).bind(id, siteId).run();

  await writeAuditLog(context.env, {
    user,
    request: context.request,
    action: 'asset_delete',
    entityType: 'asset',
    entityId: id,
    metadata: {
      r2Key: row.r2_key,
      originalFilename: row.original_filename,
      mimeType: row.mime_type
    }
  });

  return ok({ id });
};

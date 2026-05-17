import type { Env } from '../../_lib/types';
import { ok } from '../../_lib/http';
import { requireUser } from '../../_lib/auth';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const siteId = context.env.SITE_ID || 'site_default';
  const url = new URL(context.request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') || '20')));
  const action = (url.searchParams.get('action') || '').trim();
  const offset = (page - 1) * pageSize;
  const where = action ? `site_id = ? AND action = ?` : `site_id = ?`;
  const binds: any[] = action ? [siteId, action] : [siteId];
  const total = await context.env.DB.prepare(`SELECT COUNT(*) AS total FROM audit_logs WHERE ${where}`).bind(...binds).first<any>();
  const result = await context.env.DB.prepare(`SELECT created_at as time, action, user_id as actor, entity_type as target_type, entity_id as target_id, metadata_json as details FROM audit_logs WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(...binds, pageSize, offset).all<any>();
  return ok({ items: result.results || [], page, pageSize, total: total?.total || 0 });
};

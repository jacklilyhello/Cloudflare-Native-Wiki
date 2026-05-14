import type { Env } from '../_lib/types';
import { requireUser } from '../_lib/auth';
import { json } from '../_lib/http';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;

  const siteId = context.env.SITE_ID || 'site_default';
  const url = new URL(context.request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') || '20')));
  const offset = (page - 1) * pageSize;
  const q = (url.searchParams.get('q') || '').trim();
  const action = (url.searchParams.get('action') || '').trim();
  const entityType = (url.searchParams.get('entity_type') || '').trim();

  const conditions = ['site_id = ?'];
  const bind: Array<string | number> = [siteId];
  if (q) {
    conditions.push('(action LIKE ? OR entity_type LIKE ? OR user_email LIKE ?)');
    bind.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (action) {
    conditions.push('action = ?');
    bind.push(action);
  }
  if (entityType) {
    conditions.push('entity_type = ?');
    bind.push(entityType);
  }
  const where = conditions.join(' AND ');

  const totalRow = await context.env.DB.prepare(`SELECT COUNT(*) as count FROM audit_logs WHERE ${where}`).bind(...bind).first<{ count: number }>();
  const rows = await context.env.DB.prepare(
    `SELECT id, action, entity_type, entity_id, user_id, user_email, metadata_json, created_at
     FROM audit_logs WHERE ${where}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...bind, pageSize, offset).all<any>();

  return json({ logs: rows.results || [], pagination: { page, pageSize, total: totalRow?.count || 0 } });
};

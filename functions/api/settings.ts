import type { Env } from '../_lib/types';
import { json, readJson } from '../_lib/http';
import { requireUser } from '../_lib/auth';
import { CACHE_KEYS } from '../_lib/cache';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const siteId = context.env.SITE_ID || 'site_default';
  const result = await context.env.DB.prepare(`SELECT key, value FROM settings WHERE site_id = ? ORDER BY key ASC`).bind(siteId).all<any>();
  return json({ settings: Object.fromEntries((result.results || []).map((r) => [r.key, r.value])) });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const siteId = context.env.SITE_ID || 'site_default';
  const body = await readJson<{ settings: Record<string, string> }>(context.request);
  const statements = Object.entries(body.settings || {}).map(([key, value]) => context.env.DB.prepare(
    `INSERT INTO settings (site_id, key, value, value_type, is_public, updated_by, updated_at)
     VALUES (?, ?, ?, 'string', 1, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(site_id, key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`
  ).bind(siteId, key, String(value), user.id));
  if (statements.length) await context.env.DB.batch(statements);
  await context.env.WIKI_KV.delete(CACHE_KEYS.settings(siteId));
  return json({ ok: true });
};

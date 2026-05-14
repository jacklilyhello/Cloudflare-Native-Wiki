import type { Env } from '../../../_lib/types';
import { ok, readJson } from '../../../_lib/http';
import { requireUser } from '../../../_lib/auth';
import { createId } from '../../../_lib/id';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context); if (user instanceof Response) return user;
  const siteId = context.env.SITE_ID || 'site_default';
  const result = await context.env.DB.prepare(`SELECT * FROM import_jobs WHERE site_id=? ORDER BY created_at DESC LIMIT 30`).bind(siteId).all();
  return ok({ jobs: result.results || [] });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context); if (user instanceof Response) return user;
  const body = await readJson<{ source?: string; totalItems?: number }>(context.request);
  const siteId = context.env.SITE_ID || 'site_default';
  const id = createId('job');
  await context.env.DB.prepare(`INSERT INTO import_jobs (id, site_id, source, status, total_items, created_by) VALUES (?, ?, ?, 'running', ?, ?)`)
    .bind(id, siteId, body.source || 'wikijs', body.totalItems || 0, user.id).run();
  return ok({ id });
};

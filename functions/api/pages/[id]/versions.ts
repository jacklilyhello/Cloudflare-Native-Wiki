import type { Env } from '../../../_lib/types';
import { ok } from '../../../_lib/http';
import { requireUser } from '../../../_lib/auth';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const result = await context.env.DB.prepare(
    `SELECT id, version_number, title, slug, status, change_note, created_at FROM page_versions WHERE page_id = ? ORDER BY version_number DESC`
  ).bind(String(context.params.id)).all();
  return ok({ versions: result.results || [] });
};

import type { Env } from '../../_lib/types';
import { ok } from '../../_lib/http';
import { requireUser } from '../../_lib/auth';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const siteId = context.env.SITE_ID || 'site_default';
  const result = await context.env.DB.prepare(
    `SELECT id, original_filename, mime_type, file_size, public_url, alt_text, caption, created_at FROM assets WHERE site_id = ? ORDER BY created_at DESC LIMIT 100`
  ).bind(siteId).all();
  return ok({ assets: result.results || [] });
};

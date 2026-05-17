import type { Env } from '../../../_lib/types';
import { ok, readJson } from '../../../_lib/http';
import { requireUser } from '../../../_lib/auth';
import { normalizeSlugPath } from '../../../_lib/slug';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const body = await readJson<{ slug: string; exceptPageId?: string }>(context.request);
  const siteId = context.env.SITE_ID || 'site_default';
  const slug = normalizeSlugPath(body.slug || '');
  const row = await context.env.DB.prepare(`SELECT id FROM pages WHERE site_id = ? AND normalized_slug = ? LIMIT 1`).bind(siteId, slug).first<any>();
  return ok({ available: !row || row.id === body.exceptPageId, slug });
};

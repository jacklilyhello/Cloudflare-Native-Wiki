import type { Env } from '../../_lib/types';
import { json, error, readJson } from '../../_lib/http';
import { requireUser } from '../../_lib/auth';
import { getPage, getPageContent } from '../../_lib/page-service';
import { ensureUniqueSlug, normalizeSlug } from '../../_lib/slug';

function getId(context: EventContext<Env, string, unknown>) {
  return String(context.params.id || '');
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const page = await getPage(context.env, getId(context));
  if (!page) return error('Page not found', 404);
  const content = await getPageContent(context.env, page);
  return json({ page, content });
};

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const id = getId(context);
  const page = await getPage(context.env, id);
  if (!page) return error('Page not found', 404);
  const body = await readJson<any>(context.request);
  const slug = await ensureUniqueSlug(context.env, body.slug || page.slug, id);
  await context.env.DB.prepare(
    `UPDATE pages SET title = ?, slug = ?, normalized_slug = ?, summary = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(body.title || page.title, slug, normalizeSlug(slug), body.summary || page.summary || '', user.id, id).run();
  return json({ page: await getPage(context.env, id) });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const id = getId(context);
  await context.env.DB.prepare(`DELETE FROM pages WHERE id = ?`).bind(id).run();
  return json({ ok: true });
};

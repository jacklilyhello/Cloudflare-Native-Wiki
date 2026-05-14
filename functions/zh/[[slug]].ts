import type { Env } from '../_lib/types';
import { normalizeSlug } from '../_lib/slug';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const raw = Array.isArray(context.params.slug) ? context.params.slug.join('/') : String(context.params.slug || '');
  const normalized = normalizeSlug(raw);
  const legacySlug = normalizeSlug(`zh/${normalized}`);
  const siteId = context.env.SITE_ID || 'site_default';

  const redirect = await context.env.DB.prepare(
    `SELECT new_slug, redirect_type FROM slug_redirects WHERE site_id = ? AND old_normalized_slug = ? LIMIT 1`
  ).bind(siteId, legacySlug).first<any>();

  if (redirect?.new_slug) {
    return Response.redirect(`${context.env.SITE_URL}/docs/${redirect.new_slug}`, redirect.redirect_type || 301);
  }

  if (normalized) {
    return Response.redirect(`${context.env.SITE_URL}/docs/${normalized}`, 301);
  }

  return Response.redirect(`${context.env.SITE_URL}/`, 302);
};

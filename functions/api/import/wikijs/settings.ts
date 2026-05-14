import type { Env } from '../../../_lib/types';
import { ok, readJson } from '../../../_lib/http';
import { requireUser } from '../../../_lib/auth';
import { CACHE_KEYS } from '../../../_lib/cache';
import { PUBLIC_SETTINGS_KEYS } from '../../../_lib/settings';

const mapping: Record<string, string> = {
  host: 'site_url', title: 'site_title', footerOverride: 'footer_text', logoUrl: 'logo_url', contentLicense: 'content_license'
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const body = await readJson<{ settings: Record<string, any> }>(context.request);
  const siteId = context.env.SITE_ID || 'site_default';
  const source = body.settings || {};
  const result: Record<string, string> = {};
  for (const [from, to] of Object.entries(mapping)) {
    if (source[from] != null) result[to] = String(source[from]);
  }
  if (source?.seo?.description) result.seo_description = String(source.seo.description);
  if (source?.theming?.tocPosition) result.toc_position = String(source.theming.tocPosition);
  const stmts = Object.entries(result).map(([k, v]) => context.env.DB.prepare(
    `INSERT INTO settings (site_id, key, value, is_public, updated_by) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(site_id, key) DO UPDATE SET value=excluded.value, is_public=excluded.is_public, updated_by=excluded.updated_by, updated_at=CURRENT_TIMESTAMP`
  ).bind(siteId, k, v, PUBLIC_SETTINGS_KEYS.has(k) ? 1 : 0, user.id));
  if (stmts.length) await context.env.DB.batch(stmts);
  await context.env.WIKI_KV.delete(CACHE_KEYS.settings(siteId));
  return ok({ imported: Object.keys(result).length, keys: Object.keys(result) });
};

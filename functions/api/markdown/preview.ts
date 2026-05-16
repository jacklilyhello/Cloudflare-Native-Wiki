import type { Env } from '../../_lib/types';
import { ok, readJson } from '../../_lib/http';
import { requireUser } from '../../_lib/auth';
import { renderMarkdown } from '../../_lib/markdown';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const body = await readJson<{ markdown: string }>(context.request);
  const siteId = context.env.SITE_ID || 'site_default';
  const row = await context.env.DB.prepare(`SELECT value FROM settings WHERE site_id = ? AND key = 'allowed_iframe_domains' LIMIT 1`).bind(siteId).first<{ value: string }>();
  const allowedIframeDomains = (row?.value || '').split(/[\n,]/).map((v) => v.trim()).filter(Boolean);
  const rendered = renderMarkdown(body.markdown || '', { allowedIframeDomains });
  return ok(rendered);
};

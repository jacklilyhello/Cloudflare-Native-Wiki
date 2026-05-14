import type { Env } from '../../../_lib/types';
import { ok, readJson } from '../../../_lib/http';
import { requireUser } from '../../../_lib/auth';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context); if (user instanceof Response) return user;
  const siteId = context.env.SITE_ID || 'site_default';
  const job = await context.env.DB.prepare(`SELECT * FROM import_jobs WHERE site_id=? AND id=? LIMIT 1`).bind(siteId, String(context.params.id)).first<any>();
  return ok({ job });
};

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context); if (user instanceof Response) return user;
  const body = await readJson<any>(context.request);
  const siteId = context.env.SITE_ID || 'site_default';
  await context.env.DB.prepare(`UPDATE import_jobs SET status=COALESCE(?,status), progress=COALESCE(?,progress), processed_items=COALESCE(?,processed_items), summary_json=COALESCE(?,summary_json), error_json=COALESCE(?,error_json), updated_at=CURRENT_TIMESTAMP WHERE site_id=? AND id=?`)
    .bind(body.status ?? null, body.progress ?? null, body.processedItems ?? null, body.summaryJson ? JSON.stringify(body.summaryJson) : null, body.errorJson ? JSON.stringify(body.errorJson) : null, siteId, String(context.params.id)).run();
  return ok({ updated: true });
};

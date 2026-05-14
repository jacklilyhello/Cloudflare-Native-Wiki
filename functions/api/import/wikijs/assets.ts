import type { Env } from '../../../_lib/types';
import { ok, readJson } from '../../../_lib/http';
import { requireUser } from '../../../_lib/auth';
import { createId } from '../../../_lib/id';

type AssetIn = { path: string; name: string; mime: string; dataBase64: string };
const EXT_TO_MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };

function inferMime(name: string, mime?: string) {
  if (mime && mime !== 'application/octet-stream') return mime;
  const ext = (name.split('.').pop() || '').toLowerCase();
  return EXT_TO_MIME[ext] || 'application/octet-stream';
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const body = await readJson<{ assets: AssetIn[]; jobId?: string }>(context.request);
  const siteId = context.env.SITE_ID || 'site_default';
  let imported = 0;
  const failures: Array<{ name: string; error: string }> = [];
  for (const file of body.assets || []) {
    try {
      const bytes = Uint8Array.from(atob(file.dataBase64), c => c.charCodeAt(0));
      const id = createId('asset');
      const r2Key = `assets/import/${Date.now()}-${file.name}`;
      const mime = inferMime(file.name, file.mime);
      await context.env.ASSETS_BUCKET.put(r2Key, bytes, { httpMetadata: { contentType: mime } });
      const url = `/assets/${r2Key}`;
      await context.env.DB.prepare(`INSERT INTO assets (id, site_id, filename, original_filename, mime_type, file_size, r2_key, public_url, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, siteId, file.name, file.name, mime, bytes.byteLength, r2Key, url, user.id).run();
      imported++;
    } catch (e: any) {
      failures.push({ name: file.name, error: e.message || 'unknown error' });
    }
  }
  if (body.jobId) await context.env.DB.prepare(`UPDATE import_jobs SET processed_items = processed_items + ?, summary_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind((body.assets || []).length, JSON.stringify({ imported, failures }), body.jobId).run();
  return ok({ imported, failures });
};

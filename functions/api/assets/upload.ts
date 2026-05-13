import type { Env } from '../../_lib/types';
import { json, error } from '../../_lib/http';
import { requireUser } from '../../_lib/auth';
import { createId, sha256 } from '../../_lib/id';

const MAX_SIZE = 8 * 1024 * 1024;
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']);

function extFromMime(mime: string) {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/svg+xml') return 'svg';
  return 'bin';
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;

  const form = await context.request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return error('file is required', 400);
  if (file.size > MAX_SIZE) return error('file too large', 413);
  if (!ALLOWED.has(file.type)) return error('unsupported file type', 415);

  const siteId = context.env.SITE_ID || 'site_default';
  const id = createId('asset');
  const ext = extFromMime(file.type);
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const buffer = await file.arrayBuffer();
  const digest = await sha256(buffer);
  const filename = `${id}-${digest.slice(0, 10)}.${ext}`;
  const r2Key = `assets/images/${yyyy}/${mm}/${filename}`;

  await context.env.ASSETS_BUCKET.put(r2Key, buffer, {
    httpMetadata: {
      contentType: file.type,
      cacheControl: 'public, max-age=31536000, immutable'
    }
  });

  const publicUrl = `/assets/${r2Key}`;
  await context.env.DB.prepare(
    `INSERT INTO assets (id, site_id, filename, original_filename, mime_type, file_size, r2_key, public_url, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, siteId, filename, file.name, file.type, file.size, r2Key, publicUrl, user.id).run();

  return json({ id, url: publicUrl, public_url: publicUrl, markdown: `![${file.name}](${publicUrl})` }, { status: 201 });
};

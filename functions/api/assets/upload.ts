import type { Env } from '../../_lib/types';
import { ok, error } from '../../_lib/http';
import { requireUser } from '../../_lib/auth';
import { createId } from '../../_lib/id';
import { writeAuditLog } from '../../_lib/audit';

const DEFAULT_MAX_SIZE_MB = 8;
const DEFAULT_ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'application/pdf', 'text/plain'];

function extFromFilename(filename: string) {
  const idx = filename.lastIndexOf('.');
  if (idx < 0 || idx === filename.length - 1) return '';
  const ext = filename.slice(idx + 1).toLowerCase();
  return /^[a-z0-9]+$/.test(ext) ? ext : '';
}

function extFromMime(mime: string) {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/svg+xml') return 'svg';
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'text/plain') return 'txt';
  return '';
}

function parseAllowedMimeTypes(raw: string | undefined) {
  if (!raw) return DEFAULT_ALLOWED_MIME_TYPES;
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_ALLOWED_MIME_TYPES;
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.map((s) => String(s).trim()).filter(Boolean);
  } catch {}
  return trimmed.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;

  const form = await context.request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return error('file is required', 400);
  const siteId = context.env.SITE_ID || 'site_default';
  const settingsRows = await context.env.DB.prepare(
    `SELECT key, value FROM settings WHERE site_id = ? AND key IN ('upload_max_size_mb', 'upload_allowed_mime_types')`
  ).bind(siteId).all<{ key: string; value: string }>();
  const settings = Object.fromEntries((settingsRows.results || []).map((r) => [r.key, r.value]));
  const maxSizeMb = Number(settings.upload_max_size_mb || DEFAULT_MAX_SIZE_MB) || DEFAULT_MAX_SIZE_MB;
  const allowedMimeTypes = parseAllowedMimeTypes(settings.upload_allowed_mime_types);
  const allowed = new Set(allowedMimeTypes);
  if (file.size > maxSizeMb * 1024 * 1024) return error(`file too large (max ${maxSizeMb}MB)`, 413);
  if (!file.type || !allowed.has(file.type)) return error('unsupported file type', 415);

  const id = createId('asset');
  const ext = extFromFilename(file.name) || extFromMime(file.type);
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const buffer = await file.arrayBuffer();
  const filename = ext ? `${id}.${ext}` : id;
  const r2Key = `assets/uploads/${yyyy}/${mm}/${filename}`;

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
  await writeAuditLog(context.env, {
    user,
    request: context.request,
    action: 'asset_upload',
    entityType: 'asset',
    entityId: id,
    metadata: {
      filename,
      originalFilename: file.name,
      mimeType: file.type,
      fileSize: file.size,
      r2Key
    }
  });

  const markdown = file.type.startsWith('image/')
    ? `![${file.name}](${publicUrl})`
    : `[${file.name}](${publicUrl})`;
  return ok({ id, url: publicUrl, public_url: publicUrl, markdown }, { status: 201 });
};

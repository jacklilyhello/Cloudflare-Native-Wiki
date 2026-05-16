import type { Env } from '../../_lib/types';
import { ok, error, readJson } from '../../_lib/http';
import { createId } from '../../_lib/id';
import { signJwt, verifyPassword } from '../../_lib/auth';
import { writeAuditLog } from '../../_lib/audit';

type Body = { email: string; password: string };

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = await readJson<Body>(context.request);
  const email = body.email?.trim().toLowerCase();
  const password = body.password || '';
  if (!email || !password) return error('Email and password are required', 400);

  const siteId = context.env.SITE_ID || 'site_default';
  let user = await context.env.DB.prepare(
    `SELECT id, email, role, password_hash, is_active FROM users WHERE site_id = ? AND email = ? LIMIT 1`
  ).bind(siteId, email).first<any>();

  if (!user && email === context.env.ADMIN_EMAIL?.toLowerCase()) {
    const id = createId('usr');
    await context.env.DB.prepare(
      `INSERT INTO users (id, site_id, email, username, display_name, role, password_hash)
       VALUES (?, ?, ?, ?, ?, 'owner', ?)`
    ).bind(id, siteId, email, 'admin', 'Admin', context.env.ADMIN_PASSWORD_HASH || null).run();
    user = await context.env.DB.prepare(
      `SELECT id, email, role, password_hash, is_active FROM users WHERE id = ? LIMIT 1`
    ).bind(id).first<any>();
  }

  if (!user || !user.is_active) return error('Invalid credentials', 401);
  const passwordOk = await verifyPassword(context.env, password, user.password_hash || context.env.ADMIN_PASSWORD_HASH);
  if (!passwordOk) return error('Invalid credentials', 401);

  await context.env.DB.prepare(`UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(user.id).run();
  await writeAuditLog(context.env, {
    user: { id: user.id, email: user.email, role: user.role },
    request: context.request,
    action: 'login_success',
    entityType: 'user',
    entityId: user.id,
    metadata: { email: user.email }
  });
  const ttlSetting = await context.env.DB.prepare(
    `SELECT value FROM settings WHERE site_id = ? AND key = 'admin_session_ttl' LIMIT 1`
  ).bind(siteId).first<{ value: string }>();
  const ttl = Math.max(60, Number(ttlSetting?.value || '') || 60 * 60 * 8);
  const token = await signJwt(context.env, { id: user.id, email: user.email, role: user.role }, ttl);
  const cookie = [
    `wiki_token=${token}`,
    `Max-Age=${ttl}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax'
  ].join('; ');
  return ok(
    { token, user: { id: user.id, email: user.email, role: user.role } },
    { headers: { 'Set-Cookie': cookie } }
  );
};

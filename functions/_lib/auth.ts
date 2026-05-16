import type { AuthedUser, Env } from './types';
import { error } from './http';

function b64url(input: ArrayBuffer | Uint8Array | string) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = '';
  bytes.forEach((b) => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function unb64url(input: string) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - input.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
}

export async function signJwt(env: Env, user: AuthedUser, expiresInSeconds = 60 * 60 * 8) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: env.JWT_ISSUER || 'cf-native-emby-wiki',
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + expiresInSeconds
  };

  const encodedHeader = b64url(JSON.stringify(header));
  const encodedPayload = b64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = b64url(await hmac(env.JWT_SECRET, signingInput));
  return `${signingInput}.${signature}`;
}

export async function verifyJwt(env: Env, token: string): Promise<AuthedUser | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = b64url(await hmac(env.JWT_SECRET, `${header}.${payload}`));
  if (expected !== signature) return null;
  const decoded = JSON.parse(new TextDecoder().decode(unb64url(payload)));
  if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
  return { id: decoded.sub, email: decoded.email, role: decoded.role };
}

export async function requireUser(context: EventContext<Env, string, unknown>): Promise<AuthedUser | Response> {
  const auth = context.request.headers.get('authorization') || '';
  const bearerToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const cookie = context.request.headers.get('cookie') || '';
  const cookieToken = cookie.split(';').map((item) => item.trim()).find((item) => item.startsWith('wiki_token='))?.slice('wiki_token='.length) || '';
  const token = bearerToken || cookieToken;
  if (!token) return error('Unauthorized', 401);
  const user = await verifyJwt(context.env, token);
  if (!user) return error('Unauthorized', 401);
  return user;
}

export function hasRole(user: AuthedUser, roles: AuthedUser['role'][]) {
  return roles.includes(user.role);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function verifyPbkdf2(plain: string, storedHash: string) {
  // Format: pbkdf2:<iterations>:<salt-base64url>:<hash-base64url>
  const [, iterRaw, saltRaw, hashRaw] = storedHash.split(':');
  const iterations = Number(iterRaw);
  if (!iterations || !saltRaw || !hashRaw) return false;
  const salt = unb64url(saltRaw);
  const expected = unb64url(hashRaw);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(plain), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, expected.length * 8);
  return timingSafeEqual(new Uint8Array(bits), expected);
}

export async function verifyPassword(env: Env, plain: string, storedHash?: string | null) {
  // Local-only convenience. Do not use ADMIN_DEV_PASSWORD in production.
  if (env.ADMIN_DEV_PASSWORD && plain === env.ADMIN_DEV_PASSWORD) return true;
  if (!storedHash) return false;

  if (storedHash.startsWith('pbkdf2:')) return verifyPbkdf2(plain, storedHash);

  // Legacy fallback: sha256:<hex>. Kept only for easy migration.
  if (storedHash.startsWith('sha256:')) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
    const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return `sha256:${hex}` === storedHash;
  }

  return false;
}

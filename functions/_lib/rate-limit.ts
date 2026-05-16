import type { Env } from './types';

const DEFAULT_LOGIN_MAX_ATTEMPTS = 10;

function getMinuteBucket(now = new Date()) {
  return now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
}

function getClientIp(request: Request) {
  const cfIp = request.headers.get('CF-Connecting-IP') || request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const xff = request.headers.get('x-forwarded-for');
  if (!xff) return 'unknown';
  return xff.split(',')[0]?.trim() || 'unknown';
}

function loginRateLimitKey(ip: string, minuteBucket: string) {
  return `rl:login:${ip}:${minuteBucket}`;
}

export type LoginRateLimitResult =
  | { allowed: true; ip: string; minuteBucket: string; key: string; count: number; maxAttempts: number }
  | { allowed: false; ip: string; minuteBucket: string; key: string; count: number; maxAttempts: number };

export async function checkLoginRateLimit(env: Env, request: Request, maxAttempts = DEFAULT_LOGIN_MAX_ATTEMPTS): Promise<LoginRateLimitResult> {
  const ip = getClientIp(request);
  const minuteBucket = getMinuteBucket();
  const key = loginRateLimitKey(ip, minuteBucket);
  const current = Number.parseInt((await env.WIKI_KV.get(key)) || '0', 10) || 0;

  if (current >= maxAttempts) {
    return { allowed: false, ip, minuteBucket, key, count: current, maxAttempts };
  }

  return { allowed: true, ip, minuteBucket, key, count: current, maxAttempts };
}

export async function recordLoginFailure(env: Env, key: string): Promise<number> {
  const current = Number.parseInt((await env.WIKI_KV.get(key)) || '0', 10) || 0;
  const next = current + 1;
  await env.WIKI_KV.put(key, String(next), { expirationTtl: 120 });
  return next;
}

export async function recordLoginSuccess(env: Env, key: string) {
  await env.WIKI_KV.delete(key);
}

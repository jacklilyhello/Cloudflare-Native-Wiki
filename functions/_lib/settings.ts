import type { Env } from './types';
import { CACHE_KEYS, getJson, putJson } from './cache';

export async function getPublicSettings(env: Env) {
  const siteId = env.SITE_ID || 'site_default';
  const key = CACHE_KEYS.settings(siteId);
  const cached = await getJson<Record<string, string>>(env, key);
  if (cached) return cached;

  const result = await env.DB.prepare(
    `SELECT key, value FROM settings WHERE site_id = ? AND is_public = 1`
  ).bind(siteId).all<{ key: string; value: string }>();
  const settings = Object.fromEntries((result.results || []).map((row) => [row.key, row.value]));
  await putJson(env, key, settings);
  return settings;
}

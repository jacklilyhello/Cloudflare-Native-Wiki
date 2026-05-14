import type { Env } from './types';
import { CACHE_KEYS, getJson, putJson } from './cache';

export const PUBLIC_SETTINGS_KEYS = new Set([
  'site_title', 'site_subtitle', 'site_url', 'default_locale', 'homepage_slug', 'footer_text',
  'content_license', 'logo_url', 'favicon_url', 'primary_color', 'accent_color', 'enable_dark_mode',
  'default_theme', 'seo_title_suffix', 'seo_description', 'robots_index', 'robots_follow',
  'canonical_base_url', 'og_title', 'og_description', 'og_image_url', 'nav_mode', 'toc_position',
  'sidebar_collapsed_by_default', 'show_breadcrumbs', 'show_page_toc', 'show_edit_link',
  'allowed_page_extensions', 'enable_mermaid', 'enable_katex', 'enable_code_copy',
  'enable_heading_anchor', 'enable_image_lightbox', 'enable_reading_time', 'custom_footer_html'
]);

export async function getPublicSettings(env: Env) {
  const siteId = env.SITE_ID || 'site_default';
  const key = CACHE_KEYS.settings(siteId);
  const cached = await getJson<Record<string, string>>(env, key);
  if (cached) return cached;

  const result = await env.DB.prepare(
    `SELECT key, value FROM settings WHERE site_id = ? AND is_public = 1`
  ).bind(siteId).all<{ key: string; value: string }>();
  const settings = Object.fromEntries((result.results || []).filter((row) => PUBLIC_SETTINGS_KEYS.has(row.key)).map((row) => [row.key, row.value]));
  await putJson(env, key, settings);
  return settings;
}

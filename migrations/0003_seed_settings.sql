INSERT OR IGNORE INTO settings (site_id, key, value, value_type, is_public)
VALUES
('site_default', 'site.title', 'Emby Wiki', 'string', 1),
('site_default', 'site.subtitle', 'Emby 与媒体服务器教程站', 'string', 1),
('site_default', 'site.logo_url', '', 'string', 1),
('site_default', 'site.favicon_url', '/favicon.svg', 'string', 1),
('site_default', 'site.theme_color', '#3b82f6', 'string', 1),
('site_default', 'site.default_theme', 'system', 'string', 1),
('site_default', 'site.home_slug', 'emby/getting-started', 'string', 1),
('site_default', 'site.footer', 'Powered by Cloudflare Native Emby Wiki', 'string', 1),
('site_default', 'seo.default_title', 'Emby Wiki', 'string', 1),
('site_default', 'seo.default_description', 'Emby、Docker、Nginx、Cloudflare 与媒体服务器教程。', 'string', 1),
('site_default', 'seo.og_image', '', 'string', 1);

-- Optional demo navigation and starter page metadata.
INSERT OR IGNORE INTO navigation (id, site_id, parent_id, page_id, label, icon, href, sort_order, depth, is_folder, is_visible)
VALUES
('nav_emby', 'site_default', NULL, NULL, 'Emby 教程', 'server', NULL, 0, 0, 1, 1),
('nav_install', 'site_default', 'nav_emby', NULL, '安装部署', 'box', NULL, 0, 1, 1, 1),
('nav_reverse_proxy', 'site_default', 'nav_emby', NULL, '反向代理', 'network', NULL, 1, 1, 1, 1),
('nav_cloudflare', 'site_default', NULL, NULL, 'Cloudflare', 'cloud', NULL, 1, 0, 1, 1);

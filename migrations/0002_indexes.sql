CREATE INDEX IF NOT EXISTS idx_users_site_email ON users(site_id, email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE INDEX IF NOT EXISTS idx_pages_site_status ON pages(site_id, status);
CREATE INDEX IF NOT EXISTS idx_pages_site_slug ON pages(site_id, slug);
CREATE INDEX IF NOT EXISTS idx_pages_site_normalized_slug ON pages(site_id, normalized_slug);
CREATE INDEX IF NOT EXISTS idx_pages_published_at ON pages(site_id, published_at);

CREATE INDEX IF NOT EXISTS idx_page_versions_page_id ON page_versions(page_id);
CREATE INDEX IF NOT EXISTS idx_page_versions_status ON page_versions(status);
CREATE INDEX IF NOT EXISTS idx_page_versions_created_at ON page_versions(created_at);

CREATE INDEX IF NOT EXISTS idx_slug_redirects_old_slug ON slug_redirects(site_id, old_normalized_slug);

CREATE INDEX IF NOT EXISTS idx_navigation_parent ON navigation(site_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_navigation_sort ON navigation(site_id, parent_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_navigation_page ON navigation(site_id, page_id);

CREATE INDEX IF NOT EXISTS idx_assets_site_mime ON assets(site_id, mime_type);
CREATE INDEX IF NOT EXISTS idx_assets_site_created_at ON assets(site_id, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(site_id, user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(site_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(site_id, created_at);

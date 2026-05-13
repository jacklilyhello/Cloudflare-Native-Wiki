PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  host TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO sites (id, name, host)
VALUES ('site_default', 'Emby Wiki', 'wiki.example.com');

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL DEFAULT 'site_default',
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'editor',
  avatar_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL DEFAULT 'site_default',
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  normalized_slug TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  visibility TEXT NOT NULL DEFAULT 'public',
  current_version_id TEXT,
  content_r2_key TEXT,
  rendered_r2_key TEXT,
  toc_json TEXT,
  meta_title TEXT,
  meta_description TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image_asset_id TEXT,
  canonical_url TEXT,
  reading_time INTEGER NOT NULL DEFAULT 0,
  word_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id),
  FOREIGN KEY(updated_by) REFERENCES users(id),
  UNIQUE(site_id, normalized_slug)
);

CREATE TABLE IF NOT EXISTS page_versions (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL DEFAULT 'site_default',
  page_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content_r2_key TEXT NOT NULL,
  rendered_r2_key TEXT,
  content_hash TEXT NOT NULL,
  toc_json TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  change_note TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE CASCADE,
  FOREIGN KEY(page_id) REFERENCES pages(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id),
  UNIQUE(page_id, version_number)
);

CREATE TABLE IF NOT EXISTS slug_redirects (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL DEFAULT 'site_default',
  page_id TEXT NOT NULL,
  old_slug TEXT NOT NULL,
  old_normalized_slug TEXT NOT NULL,
  new_slug TEXT NOT NULL,
  redirect_type INTEGER NOT NULL DEFAULT 301,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE CASCADE,
  FOREIGN KEY(page_id) REFERENCES pages(id) ON DELETE CASCADE,
  UNIQUE(site_id, old_normalized_slug)
);

CREATE TABLE IF NOT EXISTS navigation (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL DEFAULT 'site_default',
  parent_id TEXT,
  page_id TEXT,
  label TEXT NOT NULL,
  icon TEXT,
  href TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  depth INTEGER NOT NULL DEFAULT 0,
  is_folder INTEGER NOT NULL DEFAULT 0,
  is_visible INTEGER NOT NULL DEFAULT 1,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE CASCADE,
  FOREIGN KEY(parent_id) REFERENCES navigation(id) ON DELETE CASCADE,
  FOREIGN KEY(page_id) REFERENCES pages(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL DEFAULT 'site_default',
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  r2_key TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  alt_text TEXT,
  caption TEXT,
  uploaded_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE CASCADE,
  FOREIGN KEY(uploaded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS settings (
  site_id TEXT NOT NULL DEFAULT 'site_default',
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'string',
  is_public INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(site_id, key),
  FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE CASCADE,
  FOREIGN KEY(updated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL DEFAULT 'site_default',
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata_json TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

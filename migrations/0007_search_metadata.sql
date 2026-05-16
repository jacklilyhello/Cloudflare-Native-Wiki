ALTER TABLE pages ADD COLUMN excerpt TEXT;
ALTER TABLE pages ADD COLUMN tags_json TEXT;
ALTER TABLE pages ADD COLUMN search_text TEXT;

CREATE INDEX IF NOT EXISTS idx_pages_search_text ON pages(site_id, search_text);

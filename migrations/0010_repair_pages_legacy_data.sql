-- Idempotent legacy data repair
UPDATE pages
SET slug = CASE
  WHEN slug LIKE '/docs/%' THEN substr(slug, 7)
  WHEN slug LIKE 'docs/%' THEN substr(slug, 6)
  ELSE slug
END
WHERE slug LIKE '/docs/%' OR slug LIKE 'docs/%';

UPDATE pages
SET normalized_slug = CASE
  WHEN normalized_slug LIKE '/docs/%' THEN substr(normalized_slug, 7)
  WHEN normalized_slug LIKE 'docs/%' THEN substr(normalized_slug, 6)
  WHEN normalized_slug IS NULL OR normalized_slug = '' THEN slug
  ELSE normalized_slug
END
WHERE normalized_slug LIKE '/docs/%' OR normalized_slug LIKE 'docs/%' OR normalized_slug IS NULL OR normalized_slug = '';

UPDATE pages
SET slug = 'untitled-' || substr(id, -6)
WHERE slug IS NULL OR trim(slug) = '';

UPDATE pages
SET current_version_id = (
  SELECT v.id FROM page_versions v
  WHERE v.page_id = pages.id
  ORDER BY v.version_number DESC
  LIMIT 1
)
WHERE (current_version_id IS NULL OR current_version_id = '')
  AND EXISTS (SELECT 1 FROM page_versions v2 WHERE v2.page_id = pages.id);

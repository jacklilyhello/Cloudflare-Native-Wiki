# Database Design

## Purpose

D1 is used as the structured metadata database. It should not be used as binary object storage.

## Tables

### users

Stores admin/editor identities.

Important columns:

- `id`
- `email`
- `username`
- `display_name`
- `password_hash`
- `role`
- `is_active`
- `last_login_at`

Roles planned:

- owner
- admin
- editor
- viewer

MVP can use admin/editor only.

### pages

Stores current page metadata.

Important columns:

- `id`
- `title`
- `slug`
- `normalized_slug`
- `status`
- `visibility`
- `current_version_id`
- `content_r2_key`
- `rendered_r2_key`
- `toc_json`
- `meta_title`
- `meta_description`
- `canonical_url`
- `reading_time`
- `word_count`
- `published_at`

`pages` should point to the currently published version.

### page_versions

Stores all draft and published versions.

Important columns:

- `id`
- `page_id`
- `version_number`
- `title`
- `slug`
- `content_r2_key`
- `rendered_r2_key`
- `content_hash`
- `toc_json`
- `status`
- `change_note`

Markdown source and rendered HTML should be in R2, not directly in D1.

### slug_redirects

Stores old slug to new slug mapping.

Use cases:

- SEO-safe slug edits
- old shared links continue working
- 301 permanent redirect

### navigation

Stores left sidebar navigation tree.

Important columns:

- `id`
- `parent_id`
- `page_id`
- `label`
- `icon`
- `href`
- `sort_order`
- `depth`
- `is_folder`
- `is_visible`
- `is_pinned`

The public navigation tree should be materialized into KV as JSON.

### assets

Stores asset metadata.

Important columns:

- `id`
- `filename`
- `original_filename`
- `mime_type`
- `file_size`
- `width`
- `height`
- `r2_key`
- `public_url`
- `alt_text`
- `caption`

Binary data is stored in R2.

### settings

Stores global site configuration.

Examples:

- site_title
- site_subtitle
- site_logo
- site_favicon
- theme_color
- default_theme
- custom_homepage
- footer_html
- seo_title
- seo_description
- og_image

Public settings should be cached in KV.

### audit_logs

Stores important admin actions.

Examples:

- login
- page_create
- page_update
- page_publish
- page_delete
- settings_update
- asset_upload

## Recommended future SaaS changes

When turning this into a multi-site SaaS, add:

```sql
CREATE TABLE sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  custom_domain TEXT,
  owner_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Then add `site_id` to:

- pages
- page_versions
- navigation
- assets
- settings
- users_roles

For first version, do not implement this UI.

## Migration files

Existing files:

- `migrations/0001_init.sql`
- `migrations/0002_indexes.sql`
- `migrations/0003_seed_settings.sql`
- `migrations/0004_seed_demo_content.sql`

Run locally:

```bash
npm run db:migrate:local
```

Run remotely:

```bash
npm run db:migrate:remote
```


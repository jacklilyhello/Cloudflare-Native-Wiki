# Codex Task Plan

## Task 0 — Build verification

Run:

```bash
npm install
npm run typecheck
npm run build
```

Fix all compile errors before adding features.

Expected areas to inspect:

- `astro.config.mjs`
- `src/env.d.ts`
- Pages Functions handler signatures
- Cloudflare bindings type definitions
- React component imports
- Tailwind v4 integration

## Task 1 — Verify D1 migrations

Run:

```bash
wrangler d1 migrations apply cf_native_wiki --local
```

Then verify all tables exist:

```sql
SELECT name FROM sqlite_master WHERE type='table';
```

Confirm tables:

- users
- pages
- page_versions
- slug_redirects
- navigation
- assets
- settings
- audit_logs

## Task 2 — Verify local Cloudflare preview

Run:

```bash
npm run build
wrangler pages dev dist --compatibility-date=2026-05-13
```

Use `.dev.vars`:

```bash
JWT_SECRET=dev-secret-change-me
ADMIN_DEV_PASSWORD=admin123456
```

Verify:

- `/`
- `/admin/login`
- `/admin`
- `/api/settings/public`
- `/robots.txt`
- `/sitemap.xml`

## Task 3 — Make Markdown renderer production-grade

Current renderer should be improved to support:

- GitHub-flavored Markdown
- tables
- task lists
- code blocks
- admonitions
- heading anchors
- automatic TOC
- KaTeX math
- Mermaid fences
- iframe/video whitelist
- HTML sanitization
- lazy images
- table overflow wrapper

Recommended final library direction:

- either keep `markdown-it` and strengthen plugins
- or migrate to `unified / remark / rehype` if deeper AST control is needed

For this codebase, a practical first iteration is to keep `markdown-it` and add sanitization and Shiki.

## Task 4 — Complete page publishing pipeline

Publishing should do this atomically as much as D1/R2/KV allows:

1. Read latest draft Markdown.
2. Render Markdown to HTML.
3. Extract TOC.
4. Store Markdown source in R2.
5. Store rendered HTML snapshot in R2.
6. Insert page version.
7. Update `pages.current_version_id`.
8. Update `pages.rendered_r2_key` and `pages.content_r2_key`.
9. Write `page:slug:{slug}:latest` into KV.
10. Rebuild `site:navigation:tree` if needed.
11. Rebuild sitemap KV.
12. Remove or version old Cache API entry.

## Task 5 — Improve navigation manager

Implement:

- multi-level tree
- collapse/expand
- current item highlight
- auto-expand parent chain
- icon selector
- drag-and-drop sorting
- folder nodes
- linked page nodes
- mobile drawer

Recommended library:

- `@dnd-kit/core`
- `@dnd-kit/sortable`

## Task 6 — Improve asset manager

Implement:

- drag upload
- paste upload
- image preview grid
- alt text editing
- copy Markdown snippet
- delete asset
- optional original file retention
- WebP client-side compression

Do not store image binary in D1.

## Task 7 — Security hardening

Implement:

- secure password hash verification
- login rate limiting
- JWT expiration handling
- HttpOnly cookie option if preferred
- upload MIME whitelist
- upload max size
- sanitize rendered HTML
- audit log writes for page publish/delete/settings changes
- optional Cloudflare Access JWT verification

## Task 8 — Production caching

Implement:

- ETag based on `pageId:versionId:contentHash`
- `Cache-Control` headers for public pages
- `no-store` for admin/API mutating routes
- KV cache for settings, navigation, sitemap and pages
- Cache API write-through for HTML pages
- manual SWR using `ctx.waitUntil()` where needed

## Task 9 — SEO

Implement:

- meta title
- meta description
- canonical URL
- OpenGraph tags
- Twitter card tags
- structured data `TechArticle`
- sitemap generation
- robots generation
- 301 old slug redirect
- 404 page

## Task 10 — UI polish

Public site:

- fixed left sidebar
- centered article column
- right TOC
- GitBook/VitePress/Wiki.js style typography
- dark mode
- code copy button
- image lightbox
- responsive drawer

Admin:

- Notion / Linear / Vercel style
- clean page list
- split Markdown editor and preview
- publish status badges
- version history drawer
- settings form


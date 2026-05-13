# Codex Start Here

## Project

Cloudflare Native Emby Wiki — a single-site Markdown Wiki / documentation system for Emby and media-server tutorials.

This repository is intentionally designed as a **Cloudflare-native lightweight CMS**, not as a traditional Wiki.js clone running on a Node.js server.

## Non-negotiable constraints

1. Single-site first. Do not implement multi-tenant SaaS in v1.
2. Keep the data model extensible for future SaaS use.
3. Public frontend should behave like a static documentation site.
4. Admin should behave like a lightweight CMS.
5. No VPS.
6. No Docker.
7. No long-running Node.js server.
8. No MySQL or PostgreSQL server.
9. Use Cloudflare Pages, Pages Functions, D1, KV, R2, and Cache API.
10. Keep Markdown content editable and versioned.

## Current source status

This bundle contains a working MVP skeleton, not a finished commercial product.

Implemented structure:

- Astro + React + TypeScript + TailwindCSS project
- Cloudflare Pages Functions routing
- D1 migrations
- R2-backed content and asset storage helpers
- KV cache helpers
- public `/docs/:slug` rendering function
- `/admin` lightweight CMS shell
- login endpoint
- page CRUD and publish endpoints
- Markdown preview endpoint
- asset upload endpoint
- navigation, settings, sitemap and robots endpoints

Important files:

```txt
README.md
wrangler.toml
migrations/0001_init.sql
functions/docs/[[slug]].ts
functions/_lib/page-service.ts
functions/_lib/render-page.ts
functions/_lib/markdown.ts
functions/_lib/cache.ts
src/components/admin/AdminApp.tsx
```

## First Codex objective

Before adding major features, make the current MVP build cleanly and deploy to Cloudflare Pages.

Recommended first sequence:

```bash
npm install
npm run typecheck
npm run build
```

Then fix any TypeScript, Astro, Cloudflare runtime, or dependency issues.

## Deferred local-environment checks

Status as of 2026-05-13:

- Local `node`, `npm`, `pnpm`, and `bun` were not available in the current shell.
- Temporary download of official Node.js for local verification was not approved.
- The following checks were intentionally skipped and must be resumed in the later cloud development environment:
  - `npm install`
  - `npm run typecheck`
  - `npm run build`
  - `npm run db:migrate:local`
  - `npm run preview`
  - Cloudflare Pages Functions runtime smoke tests

When cloud development starts, resume from `docs/CODEX_TASKS.md` Task 0, then Task 1 and Task 2 before adding larger features.

## Development priority

### Priority 1 — make MVP stable

- Ensure `npm run build` passes.
- Ensure Pages Functions types compile.
- Ensure `wrangler pages dev dist` runs.
- Ensure D1 migrations apply locally and remotely.
- Ensure `/docs/:slug` resolves demo content after migration.
- Ensure admin login works with `.dev.vars`.
- Ensure page publish writes content to R2 and cache metadata to KV.

### Priority 2 — complete core CMS

- Improve admin page manager UI.
- Add delete page confirmation.
- Add restore version UI.
- Add navigation drag-and-drop.
- Add settings form validation.
- Add asset list preview and deletion.

### Priority 3 — improve Markdown renderer

- Add safer HTML sanitization.
- Add Shiki code highlighting.
- Add Mermaid lazy-rendering.
- Add KaTeX rendering.
- Add image lightbox.
- Add table overflow handling.
- Add heading anchors and automatic TOC.

### Priority 4 — production hardening

- Add audit logs.
- Add rate limiting for login and upload.
- Add Cloudflare Access optional verification.
- Add ETag handling.
- Add cache revalidation behavior.
- Add sitemap regeneration on publish.
- Add backup/export tools.

## Do not do yet

- Do not add multi-tenant billing.
- Do not add collaborative editing.
- Do not add comments.
- Do not add a separate backend server.
- Do not replace D1 with PostgreSQL.
- Do not store images or large HTML blobs directly in D1.

## Architecture docs

Read these files in order:

1. `docs/PRODUCTION_ARCHITECTURE_DESIGN.md`
2. `docs/IMPLEMENTATION_STATUS.md`
3. `docs/CODEX_TASKS.md`
4. `docs/DATABASE_DESIGN.md`
5. `docs/CACHE_RENDERING_STRATEGY.md`
6. `docs/CLOUDFLARE_DEPLOYMENT.md`
7. `docs/UI_UX_SPEC.md`

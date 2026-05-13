# Prompt for Codex

You are working on this repository: `cf-native-emby-wiki`.

The goal is to build a single-site Cloudflare-native Markdown Wiki for Emby / media-server tutorials. The system should feel like Wiki.js / GitBook / VitePress, but it must not use a traditional Node.js backend, VPS, Docker, MySQL, or PostgreSQL.

Read these files first:

1. `CODEX_START_HERE.md`
2. `DESIGN_DOCUMENT.md`
3. `docs/IMPLEMENTATION_STATUS.md`
4. `docs/CODEX_TASKS.md`
5. `docs/DATABASE_DESIGN.md`
6. `docs/CACHE_RENDERING_STRATEGY.md`
7. `docs/CLOUDFLARE_DEPLOYMENT.md`
8. `docs/UI_UX_SPEC.md`

Important constraints:

- First version is single-site only.
- Keep SaaS extension space in the data model, but do not build multi-tenant UI yet.
- Use Cloudflare Pages for frontend.
- Use Pages Functions for API.
- Use D1 for metadata.
- Use R2 for Markdown, rendered HTML, images and attachments.
- Use KV for settings, navigation, sitemap and page hot cache.
- Use Cache API for edge HTML responses.
- Public pages should be close to static-site performance.
- Admin should be a lightweight CMS.

Your first task:

Run and fix:

```bash
npm install
npm run typecheck
npm run build
```

After the build is clean, continue with the tasks in `docs/CODEX_TASKS.md`.

Do not introduce:

- Express
- Next.js server mode
- Docker
- VPS deployment scripts
- PostgreSQL/MySQL
- separate long-running backend process


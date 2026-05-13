# Bundle Manifest

This archive contains the source code and architecture documentation for the Cloudflare Native Emby Wiki project.

## Root documents

- `CODEX_START_HERE.md` — first file Codex should read
- `CODEX_PROMPT.md` — prompt text for Codex
- `DESIGN_DOCUMENT.md` — complete production architecture design document
- `README.md` — developer setup and deployment commands

## Architecture documents

- `docs/PRODUCTION_ARCHITECTURE_DESIGN.md` — full architecture
- `docs/IMPLEMENTATION_STATUS.md` — what is implemented and what is not
- `docs/CODEX_TASKS.md` — concrete Codex development tasks
- `docs/DATABASE_DESIGN.md` — D1 schema explanation
- `docs/CACHE_RENDERING_STRATEGY.md` — public rendering and cache chain
- `docs/CLOUDFLARE_DEPLOYMENT.md` — Cloudflare deployment guide
- `docs/UI_UX_SPEC.md` — public and admin UI/UX specification
- `docs/OFFICIAL_REFERENCES.md` — Cloudflare official documentation links

## Source code

- `src/` — Astro frontend and React admin component
- `functions/` — Cloudflare Pages Functions API and public document handlers
- `migrations/` — D1 migrations
- `public/` — public CSS, JS and static assets
- `scripts/` — helper scripts

## Intended usage

Upload or unpack this bundle into a GitHub repository, then ask Codex to read `CODEX_START_HERE.md` and continue development according to `docs/CODEX_TASKS.md`.


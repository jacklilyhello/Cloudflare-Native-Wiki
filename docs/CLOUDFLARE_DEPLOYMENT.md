# Cloudflare Deployment Guide

## Required Cloudflare resources

- Cloudflare Pages project
- D1 database
- KV namespace
- R2 bucket
- Optional custom domain
- Optional Cloudflare Access application for `/admin/*`

## Bindings

The Pages project must bind:

```txt
DB             -> D1 database
WIKI_KV        -> KV namespace
ASSETS_BUCKET  -> R2 bucket
```

These names are used by the Functions code and should not be changed unless code is updated.

## Create resources

```bash
wrangler d1 create cf_native_wiki
wrangler kv namespace create WIKI_KV
wrangler r2 bucket create cf-native-emby-wiki-assets
```

Update `wrangler.toml` with the real IDs.

## Secrets

Production:

```bash
wrangler secret put JWT_SECRET
wrangler secret put ADMIN_PASSWORD_HASH
```

Generate password hash:

```bash
npm run password:hash -- your-password-here
```

Development `.dev.vars`:

```bash
JWT_SECRET=dev-secret-change-me
ADMIN_DEV_PASSWORD=admin123456
```

Do not commit `.dev.vars`.

## D1 migrations

Local:

```bash
npm run db:migrate:local
```

Remote:

```bash
npm run db:migrate:remote
```

## Local development

Astro dev server:

```bash
npm run dev
```

Cloudflare Pages Functions preview:

```bash
npm run build
npm run preview
```

## Deploy

```bash
npm run deploy
```

Or connect to GitHub in Cloudflare Pages:

```txt
Build command: npm run build
Build output directory: dist
```

## Production checks

After deploy, test:

```txt
/
/admin/login
/admin
/api/settings/public
/robots.txt
/sitemap.xml
/docs/emby/docker
```

Also verify:

- D1 binding exists
- KV binding exists
- R2 binding exists
- environment secrets exist
- custom domain works
- headers are correct

## Optional Cloudflare Access

Recommended for production:

- Protect `/admin/*`
- Protect `/api/*` if all API is admin-only

If enabled, the Worker/Function code should still verify Access JWT for protected routes, not only rely on UI access.


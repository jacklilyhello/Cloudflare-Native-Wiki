# Cache and Rendering Strategy

## Goal

The public wiki must be nearly as fast as a static site, while still supporting admin editing.

## Core rule

Do not parse Markdown on every public request.

Markdown should be rendered when a page is published. Public requests should use one of these in order:

1. Cache API HTML response
2. KV latest page payload
3. R2 rendered HTML snapshot
4. D1 metadata fallback

## Public request path

```txt
GET /docs/emby/docker
  -> Cache API match
  -> KV page:slug:emby/docker:latest
  -> D1 pages lookup
  -> R2 rendered HTML read
  -> assemble shell HTML
  -> put KV
  -> put Cache API
  -> return response
```

## Publish path

```txt
POST /api/pages/:id/publish
  -> auth
  -> read draft Markdown from request or R2
  -> render Markdown
  -> extract TOC
  -> calculate hash / word count / reading time
  -> put Markdown in R2
  -> put rendered HTML in R2
  -> insert page_versions
  -> update pages
  -> update KV latest page
  -> update navigation KV if needed
  -> update sitemap KV
```

## Cache headers

Public HTML:

```http
Cache-Control: public, max-age=60, s-maxage=86400
CDN-Cache-Control: public, max-age=86400
ETag: "pageId-versionId-contentHash"
```

Admin pages and write APIs:

```http
Cache-Control: no-store
```

Static assets:

```http
Cache-Control: public, max-age=31536000, immutable
```

## KV keys

```txt
site:settings:public
site:navigation:tree
site:sitemap:xml

page:slug:{slug}:latest
page:id:{pageId}:meta
page:id:{pageId}:toc

redirect:slug:{oldSlug}
```

## Cache invalidation

Preferred strategy: versioned cache, not global purge.

When a page is published:

1. Generate a new version id.
2. Store new HTML under R2 key with version id.
3. Update `page:slug:{slug}:latest` in KV.
4. New response ETag uses new version id.
5. Old edge cache expires naturally.
6. Critical pages can be revalidated through `/api/revalidate`.

## Stale-while-revalidate

Cloudflare Cache API `cache.match()` / `cache.put()` does not honor `stale-while-revalidate`. If SWR behavior is needed at this layer, implement it manually with `ctx.waitUntil()`.

Pseudo-code:

```ts
const cache = caches.default;
const cached = await cache.match(request);

if (cached) {
  return cached;
}

const response = await renderFromKVOrD1(request, env);
ctx.waitUntil(cache.put(request, response.clone()));
return response;
```

## Cache risk controls

- Never cache admin pages.
- Never cache authenticated API mutations.
- Use versioned R2 keys for rendered content.
- Keep slug redirects separately cacheable.
- Rebuild sitemap only on publish/unpublish/delete.
- Settings changes should refresh `site:settings:public`.


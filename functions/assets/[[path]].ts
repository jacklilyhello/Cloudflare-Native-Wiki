import type { Env } from '../_lib/types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const path = Array.isArray(context.params.path) ? context.params.path.join('/') : String(context.params.path || '');
  const key = path.startsWith('assets/') ? path : `assets/${path}`;
  const object = await context.env.ASSETS_BUCKET.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', headers.get('cache-control') || 'public, max-age=31536000, immutable');
  return new Response(object.body, { headers });
};

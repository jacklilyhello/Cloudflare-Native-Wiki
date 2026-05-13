import type { Env } from './_lib/types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${context.env.SITE_URL}/sitemap.xml\n`;
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600, s-maxage=86400' } });
};

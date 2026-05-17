import type { Env } from '../../../_lib/types';
import { ok, readJson } from '../../../_lib/http';
import { requireUser } from '../../../_lib/auth';
import { parseWikiExportTarGz } from './_shared';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context); if (user instanceof Response) return user;
  const body = await readJson<{ key: string }>(context.request);
  const obj = await context.env.ASSETS_BUCKET.get(body.key);
  if (!obj) return new Response('upload not found', { status: 404 });
  const parsed = parseWikiExportTarGz(new Uint8Array(await obj.arrayBuffer()));
  const pages = parsed.pages || [];
  const pageList = pages.map((p: any) => ({ title: p.title || '', path: p.path || '', published: !!p.isPublished }));
  const directoryTree = Object.keys(parsed.navigation || {}).slice(0, 50);
  return ok({
    key: body.key,
    directoryTree,
    pages: pageList,
    metadata: { hasSettings: !!parsed.settings, hasNavigation: !!parsed.navigation, historyCount: (parsed.history || []).length, assetCount: (parsed.assets || []).length, totalFiles: parsed.totalFiles || 0 },
    errors: parsed.errors || [],
  });
};

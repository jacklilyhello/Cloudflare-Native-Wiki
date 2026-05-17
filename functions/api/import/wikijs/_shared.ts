import { gunzipSync, strFromU8 } from 'fflate';

export type WikiPage = { path: string; title: string; description?: string; content?: string; isPublished?: boolean; updatedAt?: string; createdAt?: string; localeCode?: string; tags?: string[] };
export type WikiHistory = { pagePath?: string; path?: string; title?: string; content?: string; createdAt?: string; versionNumber?: number };

export function parseTar(data: Uint8Array): Record<string, Uint8Array> { const out: Record<string, Uint8Array> = {}; let offset = 0; while (offset + 512 <= data.length) { const header = data.slice(offset, offset + 512); const name = strFromU8(header.slice(0, 100)).replace(/\0.*$/, ''); if (!name) break; const sizeOct = strFromU8(header.slice(124, 136)).replace(/\0.*$/, '').trim(); const size = parseInt(sizeOct || '0', 8) || 0; const start = offset + 512; const end = start + size; out[name] = data.slice(start, end); offset = start + Math.ceil(size / 512) * 512; } return out; }

export function parseWikiExportTarGz(buf: Uint8Array) {
  const files = parseTar(gunzipSync(buf));
  const out: any = { assets: [], errors: [] as string[] };
  for (const [name, v] of Object.entries(files)) {
    try {
      if (name.endsWith('settings.json')) out.settings = JSON.parse(strFromU8(v));
      else if (name.endsWith('navigation.json')) out.navigation = JSON.parse(strFromU8(v));
      else if (name.endsWith('pages.json.gz')) out.pages = JSON.parse(strFromU8(gunzipSync(v)));
      else if (name.endsWith('pages-history.json.gz')) out.history = JSON.parse(strFromU8(gunzipSync(v)));
      else if (name.includes('/assets/')) out.assets.push({ path: name, name: name.split('/').pop() || name, mime: 'application/octet-stream', dataBase64: btoa(String.fromCharCode(...v)) });
    } catch (e: any) { out.errors.push(`${name}: ${e?.message || 'parse failed'}`); }
  }
  out.navigationTree = mapWikiNavigation(out.navigation);
  out.totalFiles = Object.keys(files).length;
  return out;
}

export function mapWikiNavigation(nav: any) { const localePriority = ['zh', 'zh-CN', 'en']; const siteNode = nav?.site || {}; const picked = localePriority.map((k) => siteNode?.[k]?.items).find(Boolean) || siteNode?.items || nav?.items || []; return (picked || []).map((item: any, idx: number) => { if (item.targetType === 'external') return { id: `imp-nav-${idx}`, type: 'external', title: item.label || item.target, href: item.target }; const target = String(item.target || ''); return { id: `imp-nav-${idx}`, type: 'page', title: item.label || target, slug: target }; }); }

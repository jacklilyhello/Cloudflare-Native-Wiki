import type { Env } from './types';
import { CACHE_KEYS, getJson, putJson } from './cache';
import { encodeSlugPath, normalizeSlugPath } from './slug';

export type NavigationNode = {
  id: string;
  type: 'section' | 'page' | 'external';
  title: string;
  slug?: string;
  href?: string;
  icon?: string;
  children?: NavigationNode[];
  expanded?: boolean;
  hidden?: boolean;
  order?: number;
};

export const DEFAULT_NAVIGATION_TREE: NavigationNode[] = [
  { id: 'section-preface', type: 'section', title: '前言', expanded: true, children: [
    { id: 'page-project-intro', type: 'page', title: '项目介绍', slug: '项目介绍' },
    { id: 'page-community-rules', type: 'page', title: '社群守则', slug: '社群守则' },
    { id: 'page-what-is-emby', type: 'page', title: '什么是Emby', slug: 'home' },
    { id: 'page-client-choice', type: 'page', title: '客户端选择', slug: '客户端选择' }
  ]},
  { id: 'section-usage', type: 'section', title: '使用方式', expanded: true, children: [
    { id: 'page-new-user-guide', type: 'page', title: '新手入门', slug: '新手入门' },
    { id: 'page-register-buy', type: 'page', title: '注册与购买', slug: '注册与购买' },
    { id: 'page-lines', type: 'page', title: '线路说明', slug: '线路说明' },
    { id: 'page-request', type: 'page', title: '求片点播', slug: '求片点播' },
    { id: 'page-faq', type: 'page', title: '常见问题', slug: '常见问题' }
  ]},
  { id: 'section-extra', type: 'section', title: '拓展资料', expanded: true, children: [
    { id: 'page-emby-build', type: 'page', title: 'Emby搭建', slug: 'Emby搭建' },
    { id: 'page-nginx-x', type: 'page', title: 'Nginx-X 反向代理', slug: 'Nginx-X反代教程' },
    { id: 'page-home-emby', type: 'page', title: 'Emby家庭服务搭建', slug: 'Emby家庭服务搭建' },
    { id: 'page-xiaoya-alist', type: 'page', title: '使用小雅Alist搭建Emby', slug: '使用小雅Alist搭建Emby' },
    { id: 'page-babysitter-guide', type: 'page', title: '保姆级Emby小白开服教程', slug: '保姆级EMBY小白开服教程' },
    { id: 'page-vps-reverse-proxy', type: 'page', title: 'VPS传统反向代理', slug: 'VPS传统反向代理' }
  ]}
];

function cloneDefault() { return JSON.parse(JSON.stringify(DEFAULT_NAVIGATION_TREE)); }

export function validateNavigationTree(tree: any): NavigationNode[] {
  if (!Array.isArray(tree)) throw new Error('根节点必须是数组');
  const ids = new Set<string>();
  const walk = (nodes: any[], path: string): NavigationNode[] => nodes.map((node, i) => {
    if (!node || typeof node !== 'object') throw new Error(`${path}[${i}] 节点无效`);
    const id = String(node.id || '').trim(); const type = node.type; const title = String(node.title || '').trim();
    if (!id || !title) throw new Error(`${path}[${i}] 必须包含 id/title`);
    if (ids.has(id)) throw new Error(`id 重复: ${id}`); ids.add(id);
    if (!['section','page','external'].includes(type)) throw new Error(`${id} type 无效`);
    const out: NavigationNode = { id, type, title, icon: node.icon || undefined, hidden: !!node.hidden, expanded: !!node.expanded };
    if (type === 'page') { if (!node.slug) throw new Error(`${id} page 缺少 slug`); out.slug = String(node.slug); }
    if (type === 'external') { if (!node.href) throw new Error(`${id} external 缺少 href`); out.href = String(node.href); }
    if (type === 'section') out.children = Array.isArray(node.children) ? walk(node.children, `${path}[${i}].children`) : [];
    return out;
  });
  return walk(tree, 'tree');
}

async function ensurePageExists(env: Env, siteId: string, title: string, slug: string) {
  const normalized = normalizeSlugPath(slug);
  const exists = await env.DB.prepare('SELECT id FROM pages WHERE site_id = ? AND normalized_slug = ? LIMIT 1').bind(siteId, normalized).first<any>();
  if (exists?.id) return exists.id;
  const pageId = `pg_${normalized || slug}_${Date.now()}`;
  await env.DB.prepare('INSERT INTO pages (id, site_id, title, slug, normalized_slug, summary, status, visibility, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)')
    .bind(pageId, siteId, title, slug, normalized, '此页面待补充。', 'draft', 'public').run();
  return pageId;
}

export async function replaceNavigationTree(env: Env, input: any) {
  const siteId = env.SITE_ID || 'site_default';
  const tree = validateNavigationTree(input);
  const flat: any[] = [];
  const walk = async (nodes: NavigationNode[], parentId: string | null, depth: number) => {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const pageId = node.type === 'page' && node.slug ? await ensurePageExists(env, siteId, node.title, node.slug) : null;
      flat.push({ node, parentId, depth, sort: i, pageId });
      if (node.type === 'section' && node.children?.length) await walk(node.children, node.id, depth + 1);
    }
  };
  await walk(tree, null, 0);
  const stmts = [env.DB.prepare('DELETE FROM navigation WHERE site_id = ?').bind(siteId)];
  for (const row of flat) {
    const href = row.node.type === 'page' ? `/docs/${encodeSlugPath(row.node.slug)}` : row.node.href || null;
    stmts.push(env.DB.prepare(`INSERT INTO navigation (id, site_id, parent_id, page_id, label, icon, href, sort_order, depth, is_folder, is_visible, is_pinned)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`).bind(row.node.id, siteId, row.parentId, row.pageId, row.node.title, row.node.icon || null, href, row.sort, row.depth, row.node.type === 'section' ? 1 : 0, row.node.hidden ? 0 : 1));
  }
  await env.DB.batch(stmts);
  await putJson(env, CACHE_KEYS.navigation(siteId), tree);
  return tree;
}

export async function getNavigationTree(env: Env) {
  const siteId = env.SITE_ID || 'site_default';
  const key = CACHE_KEYS.navigation(siteId);
  const cached = await getJson<NavigationNode[]>(env, key);
  if (cached?.length) return cached;
  const rows = await env.DB.prepare('SELECT id,parent_id,label,icon,href,sort_order,is_folder,is_visible FROM navigation WHERE site_id = ? ORDER BY depth, sort_order').bind(siteId).all<any>();
  if (!rows.results?.length) {
    const seeded = cloneDefault();
    await replaceNavigationTree(env, seeded);
    return seeded;
  }
  const map = new Map<string, NavigationNode>(); const roots: NavigationNode[] = [];
  for (const r of rows.results) {
    const isSection = !!r.is_folder;
    const isExternal = !isSection && r.href && !String(r.href).startsWith('/docs/');
    const slug = !isSection && !isExternal && r.href ? decodeURIComponent(String(r.href).replace(/^\/docs\//, '')) : undefined;
    map.set(r.id, { id: r.id, type: isSection ? 'section' : (isExternal ? 'external' : 'page'), title: r.label, icon: r.icon || undefined, href: isExternal ? r.href : undefined, slug, hidden: !r.is_visible, children: isSection ? [] : undefined });
  }
  for (const r of rows.results) {
    const node = map.get(r.id)!;
    if (r.parent_id && map.has(r.parent_id)) (map.get(r.parent_id)!.children ||= []).push(node); else roots.push(node);
  }
  await putJson(env, key, roots);
  return roots;
}

export async function resetNavigationTree(env: Env) { return replaceNavigationTree(env, cloneDefault()); }

export async function removeDeletedPageFromNavigation(env: Env, pageId: string) {
  const siteId = env.SITE_ID || 'site_default';
  const result = await env.DB.prepare('SELECT id FROM navigation WHERE site_id = ? AND page_id = ?').bind(siteId, pageId).all<any>();
  const affectedNodeIds = (result.results || []).map((row) => row.id);
  if (!affectedNodeIds.length) return { affectedCount: 0, affectedNodeIds };
  await env.DB.prepare('DELETE FROM navigation WHERE site_id = ? AND page_id = ?').bind(siteId, pageId).run();
  await env.WIKI_KV.delete(CACHE_KEYS.navigation(siteId));
  return { affectedCount: affectedNodeIds.length, affectedNodeIds };
}

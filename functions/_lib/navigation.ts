import type { Env, NavNode } from './types';
import { CACHE_KEYS, getJson, putJson } from './cache';

export function buildTree(rows: NavNode[]) {
  const map = new Map<string, NavNode>();
  const roots: NavNode[] = [];
  rows.forEach((row) => map.set(row.id, { ...row, children: [] }));
  rows.forEach((row) => {
    const node = map.get(row.id)!;
    if (row.parent_id && map.has(row.parent_id)) {
      map.get(row.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

export async function getNavigationTree(env: Env) {
  const siteId = env.SITE_ID || 'site_default';
  const key = CACHE_KEYS.navigation(siteId);
  const cached = await getJson<NavNode[]>(env, key);
  if (cached) return cached;

  const result = await env.DB.prepare(
    `SELECT id, parent_id, page_id, label, icon, href, sort_order, depth, is_folder, is_visible
     FROM navigation
     WHERE site_id = ? AND is_visible = 1
     ORDER BY depth ASC, sort_order ASC, label ASC`
  ).bind(siteId).all<NavNode>();

  const tree = buildTree(result.results || []);
  await putJson(env, key, tree);
  return tree;
}

export async function replaceNavigationTree(env: Env, tree: NavNode[]) {
  const siteId = env.SITE_ID || 'site_default';
  const flat: NavNode[] = [];

  function walk(nodes: NavNode[], parentId: string | null, depth: number) {
    nodes.forEach((node, index) => {
      const row: NavNode = {
        ...node,
        parent_id: parentId,
        depth,
        sort_order: index,
        is_visible: node.is_visible === false ? 0 : 1,
        is_folder: node.is_folder ? 1 : 0
      };
      flat.push(row);
      if (node.children?.length) walk(node.children, node.id, depth + 1);
    });
  }
  walk(tree, null, 0);

  const statements = [env.DB.prepare(`DELETE FROM navigation WHERE site_id = ?`).bind(siteId)];
  for (const item of flat) {
    statements.push(env.DB.prepare(
      `INSERT INTO navigation (id, site_id, parent_id, page_id, label, icon, href, sort_order, depth, is_folder, is_visible, is_pinned)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      item.id,
      siteId,
      item.parent_id || null,
      item.page_id || null,
      item.label,
      item.icon || null,
      item.href || null,
      item.sort_order || 0,
      item.depth || 0,
      item.is_folder ? 1 : 0,
      item.is_visible === false ? 0 : 1,
      item.is_pinned ? 1 : 0
    ));
  }
  await env.DB.batch(statements);
  await putJson(env, CACHE_KEYS.navigation(siteId), tree);
  return tree;
}

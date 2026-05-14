import type { Env, NavNode } from './types';

function escapeHtml(input = '') {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function walkAncestors(nodes: NavNode[], slug: string, ancestors: string[] = []): string[] {
  for (const node of nodes) {
    const href = node.href || '';
    const normalized = href.replace(/^\/docs\//, '').replace(/^\//, '');
    const nextAncestors = [...ancestors, node.id || node.label];
    if (normalized === slug) return nextAncestors;
    if (node.children?.length) {
      const found = walkAncestors(node.children, slug, nextAncestors);
      if (found.length) return found;
    }
  }
  return [];
}

function renderNav(nodes: NavNode[], currentSlug: string, activePath: Set<string>): string {
  return `<ul class="nav-list">${nodes.map((node) => {
    const key = node.id || node.label;
    const href = node.href || (node.page_id ? '#' : '');
    const normalized = href.replace(/^\/docs\//, '').replace(/^\//, '');
    const active = normalized === currentSlug ? ' active' : '';
    const expanded = activePath.has(key) ? 'true' : 'false';
    const icon = node.icon ? `<span class="nav-icon" aria-hidden="true">${escapeHtml(node.icon)}</span>` : '';
    const children = node.children?.length ? `<div class="nav-children" data-expanded="${expanded}">${renderNav(node.children, currentSlug, activePath)}</div>` : '';
    const label = escapeHtml(node.label);
    const isFolder = node.is_folder || (!href && node.children?.length);
    const folderToggle = isFolder && node.children?.length ? `<button class="folder-toggle" data-target="${escapeHtml(key)}" aria-label="切换目录">▸</button>` : '';
    const link = href
      ? `<a class="nav-link${active}" href="${escapeHtml(href)}">${icon}<span>${label}</span></a>`
      : `<span class="nav-link nav-folder">${icon}<span>${label}</span></span>`;
    return `<li class="nav-item" data-node-id="${escapeHtml(key)}" data-expanded="${expanded}">${folderToggle}${link}${children}</li>`;
  }).join('')}</ul>`;
}

function renderToc(toc: any[]): string {
  if (!toc?.length) return '<div class="toc-title">本页目录</div><p class="toc-empty">暂无目录</p>';
  return `<div class="toc-title">本页目录</div>${toc.map((item) => `<a class="toc-link" data-toc-id="${escapeHtml(item.id)}" style="padding-left:${Math.max(0, item.level - 2) * 12}px" href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a>`).join('')}`;
}

function readingMeta(page: any) {
  const readingTime = Number(page.reading_time || 0);
  const wordCount = Number(page.word_count || 0);
  const updatedAt = page.updated_at || page.published_at || '';
  return { readingTime, wordCount, updatedAt };
}

export function renderDocument(input: {
  env: Env;
  settings: Record<string, string>;
  navigation: NavNode[];
  page: any;
  html: string;
  toc: any[];
  slug: string;
}) {
  const siteTitle = input.settings['site.title'] || 'Emby Wiki';
  const footer = input.settings['site.footer'] || '';
  const title = input.page.meta_title || `${input.page.title} - ${siteTitle}`;
  const description = input.page.meta_description || input.page.summary || input.settings['seo.default_description'] || '';
  const canonical = input.page.canonical_url || `${input.env.SITE_URL}/docs/${input.slug}`;
  const ogTitle = input.page.og_title || title;
  const ogDescription = input.page.og_description || description;
  const activePath = new Set(walkAncestors(input.navigation, input.slug));
  const meta = readingMeta(input.page);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: input.page.title,
    description,
    datePublished: input.page.published_at,
    dateModified: input.page.updated_at,
    wordCount: meta.wordCount,
    author: { '@type': 'Organization', name: siteTitle }
  };

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
  <meta property="og:title" content="${escapeHtml(ogTitle)}" />
  <meta property="og:description" content="${escapeHtml(ogDescription)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${escapeHtml(canonical)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}" />
  <link rel="stylesheet" href="/assets/wiki.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
  <header class="topbar">
    <button id="menu-toggle" class="mobile-menu-button" aria-label="打开目录">☰</button>
    <a class="logo" href="/"><span class="logo-mark"></span><span>${escapeHtml(siteTitle)}</span></a>
    <a class="topbar-admin" href="/admin">后台</a>
  </header>
  <div class="layout">
    <aside id="sidebar" class="sidebar">${renderNav(input.navigation, input.slug, activePath)}</aside>
    <main class="content">
      <div class="article-shell">
        <nav class="breadcrumbs"><a href="/">首页</a> / <span>${escapeHtml(input.slug)}</span></nav>
        <h1 class="page-title">${escapeHtml(input.page.title)}</h1>
        ${input.page.summary ? `<p class="page-summary">${escapeHtml(input.page.summary)}</p>` : ''}
        <div class="page-meta">
          ${meta.readingTime ? `<span>${meta.readingTime} 分钟阅读</span>` : ''}
          ${meta.wordCount ? `<span>${meta.wordCount} 字</span>` : ''}
          ${meta.updatedAt ? `<span>更新于 ${escapeHtml(String(meta.updatedAt).slice(0, 10))}</span>` : ''}
        </div>
        <article class="markdown-body">${input.html}</article>
        <footer class="footer">${escapeHtml(footer)}</footer>
      </div>
    </main>
    <aside class="toc">${renderToc(input.toc)}</aside>
  </div>
  <script type="module" src="/assets/wiki.js"></script>
</body>
</html>`;
}

export function renderNotFoundPage(input: { env: Env; settings: Record<string, string>; slug: string }) {
  const siteTitle = input.settings['site.title'] || 'Emby Wiki';
  const desc = `未找到 slug: ${input.slug}`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>页面未找到 - ${escapeHtml(siteTitle)}</title><meta name="description" content="${escapeHtml(desc)}"/><link rel="stylesheet" href="/assets/wiki.css"/></head><body><main class="not-found"><h1>404 · 页面未找到</h1><p>你访问的文档不存在，可能已经被移动或删除。</p><p class="slug">${escapeHtml(input.slug)}</p><div class="actions"><a href="/docs/getting-started" class="btn">返回文档</a><a href="/" class="btn btn-secondary">返回首页</a></div></main></body></html>`;
}

export function renderEmptySnapshotPage(input: { env: Env; settings: Record<string, string>; pageTitle: string }) {
  const siteTitle = input.settings['site.title'] || 'Emby Wiki';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${escapeHtml(input.pageTitle)} - ${escapeHtml(siteTitle)}</title><link rel="stylesheet" href="/assets/wiki.css"/></head><body><main class="not-found"><h1>内容尚未发布</h1><p>该页面尚未生成渲染快照，请前往后台重新发布。</p><div class="actions"><a href="/admin" class="btn">前往后台</a></div></main></body></html>`;
}

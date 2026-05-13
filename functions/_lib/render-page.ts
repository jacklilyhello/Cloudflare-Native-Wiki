import type { Env, NavNode } from './types';

function escapeHtml(input = '') {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderNav(nodes: NavNode[], currentSlug: string): string {
  return `<ul class="nav-list">${nodes.map((node) => {
    const href = node.href || (node.page_id ? '#' : '');
    const normalized = href.replace(/^\/docs\//, '').replace(/^\//, '');
    const active = normalized === currentSlug ? ' active' : '';
    const icon = node.icon ? `<span aria-hidden="true">${escapeHtml(icon)}</span>` : '';
    const children = node.children?.length ? `<div class="nav-children">${renderNav(node.children, currentSlug)}</div>` : '';
    const label = escapeHtml(node.label);
    const link = href ? `<a class="nav-link${active}" href="${escapeHtml(href)}">${icon}<span>${label}</span></a>` : `<span class="nav-link">${icon}<span>${label}</span></span>`;
    return `<li class="nav-item">${link}${children}</li>`;
  }).join('')}</ul>`;
}

function renderToc(toc: any[]): string {
  if (!toc?.length) return '<div class="toc-title">本页目录</div><p style="color:var(--muted);font-size:13px">暂无目录</p>';
  return `<div class="toc-title">本页目录</div>${toc.map((item) => `<a style="padding-left:${Math.max(0, item.level - 2) * 12}px" href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a>`).join('')}`;
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
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: input.page.title,
    description,
    datePublished: input.page.published_at,
    dateModified: input.page.updated_at,
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
  <link rel="stylesheet" href="/assets/wiki.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
  <header class="topbar">
    <a class="logo" href="/"><span class="logo-mark"></span><span>${escapeHtml(siteTitle)}</span></a>
  </header>
  <div class="layout">
    <aside class="sidebar">${renderNav(input.navigation, input.slug)}</aside>
    <main class="content">
      <div class="article-shell">
        <nav class="breadcrumbs"><a href="/">首页</a> / <span>${escapeHtml(input.slug)}</span></nav>
        <h1 class="page-title">${escapeHtml(input.page.title)}</h1>
        ${input.page.summary ? `<p class="page-summary">${escapeHtml(input.page.summary)}</p>` : ''}
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

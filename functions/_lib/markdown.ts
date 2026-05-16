import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import taskLists from 'markdown-it-task-lists';
import container from 'markdown-it-container';
import footnote from 'markdown-it-footnote';
import katex from 'markdown-it-katex';

export type TocItem = {
  id: string;
  level: number;
  text: string;
};

export type MarkdownRenderResult = {
  html: string;
  toc: TocItem[];
  wordCount: number;
  readingTime: number;
  excerpt: string;
  searchText: string;
};

export type MarkdownRenderOptions = {
  allowedIframeDomains?: string[];
};

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeInternalPageSlug(input: string) {
  return input.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\u4e00-\u9fa5\/-]+/g, '').replace(/^-|-$/g, '');
}

function createMarkdown() {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: false,
    highlight(code, lang) {
      const language = (lang || 'text').trim().split(/\s+/)[0] || 'text';
      if (language === 'mermaid') {
        return `<pre class="mermaid" data-mermaid="true">${escapeHtml(code)}</pre>`;
      }
      return `<pre class="code-block" data-lang="${escapeHtml(language)}"><div class="code-block-header"><span class="code-block-lang">${escapeHtml(language)}</span><button type="button" class="code-copy-btn" data-copy-code>Copy</button></div><code class="language-${escapeHtml(language)}">${escapeHtml(code)}</code></pre>`;
    }
  });

  md.use(anchor, {
    slugify,
    permalink: anchor.permalink.linkInsideHeader({
      symbol: '#',
      placement: 'after',
      class: 'heading-anchor',
      ariaHidden: true
    })
  });
  md.use(taskLists, { enabled: true, label: true, labelAfter: true });
  md.use(footnote);
  md.use(katex);

  for (const type of ['tip', 'info', 'warning', 'danger', 'note']) {
    md.use(container, type, {
      render(tokens: any[], idx: number) {
        if (tokens[idx].nesting === 1) {
          return `<div class="callout callout-${type}"><div class="callout-title">${type.toUpperCase()}</div>\n`;
        }
        return '</div>\n';
      }
    });
  }

  const defaultImage = md.renderer.rules.image || ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.image = (tokens, idx, options, _env, self) => {
    const token = tokens[idx];
    token.attrSet('loading', 'lazy');
    token.attrSet('decoding', 'async');
    return defaultImage(tokens, idx, options, _env, self);
  };

  return md;
}

function rewriteWikiLinks(markdown: string) {
  return (markdown || '').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, title: string, custom: string) => {
    const label = (custom || title).trim();
    const slug = normalizeInternalPageSlug(title);
    return `[${label}](/docs/${slug || 'home'})`;
  });
}

function sanitizeRenderedHtml(html: string, allowedIframeDomains: string[]) {
  let output = html || '';
  output = output.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  output = output.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  output = output.replace(/(href|src)\s*=\s*("|')\s*javascript:[\s\S]*?\2/gi, '$1="#"');

  output = output.replace(/<(iframe|video)\b([^>]*)>/gi, (_full, tag: string, attrs: string) => {
    const srcMatch = attrs.match(/\ssrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const src = srcMatch ? (srcMatch[2] || srcMatch[3] || srcMatch[4] || '') : '';
    if (!src) return '';
    let host = '';
    try {
      host = new URL(src, 'https://placeholder.local').hostname.toLowerCase();
    } catch {
      return '';
    }
    if (!allowedIframeDomains.includes(host)) return '';
    return `<${tag}${attrs}>`;
  });

  output = output.replace(/<table\b[\s\S]*?<\/table>/gi, (tableHtml) => `<div class="table-wrap">${tableHtml}</div>`);
  output = output.replace(/<span class="katex-error"[^>]*>([\s\S]*?)<\/span>/gi, '<code class="math-fallback">$1</code>');
  return output;
}

export function extractToc(html: string): TocItem[] {
  const toc: TocItem[] = [];
  const re = /<h([2-4]) id="([^"]+)">([\s\S]*?)<\/h\1>/g;
  let match;
  while ((match = re.exec(html))) {
    const text = match[3].replace(/<[^>]+>/g, '').replace('#', '').trim();
    toc.push({ level: Number(match[1]), id: match[2], text });
  }
  return toc;
}

function stripText(input: string) {
  return input.replace(/```[\s\S]*?```/g, ' ').replace(/`([^`]+)`/g, '$1').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function renderMarkdown(markdown: string, options: MarkdownRenderOptions = {}): MarkdownRenderResult {
  const md = createMarkdown();
  const rewritten = rewriteWikiLinks(markdown || '');
  const rawHtml = md.render(rewritten);
  const html = sanitizeRenderedHtml(rawHtml, (options.allowedIframeDomains || []).map((d) => d.trim().toLowerCase()).filter(Boolean));
  const toc = extractToc(html);
  const baseText = stripText(rewritten);
  const words = baseText.split(/\s+/).filter(Boolean).length;
  const cjk = (baseText.match(/[\u4e00-\u9fa5]/g) || []).length;
  const wordCount = words + cjk;
  const readingTime = Math.max(1, Math.ceil(wordCount / 350));
  const excerpt = baseText.slice(0, 220);
  const searchText = stripText(html);
  return { html, toc, wordCount, readingTime, excerpt, searchText };
}

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

function createMarkdown() {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: false,
    highlight(code, lang) {
      const language = (lang || 'text').trim().split(/\s+/)[0];
      if (language === 'mermaid') {
        return `<pre class="mermaid">${escapeHtml(code)}</pre>`;
      }
      return `<pre class="code-block"><code class="language-${escapeHtml(language)}">${escapeHtml(code)}</code></pre>`;
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
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    token.attrSet('loading', 'lazy');
    token.attrSet('decoding', 'async');
    return defaultImage(tokens, idx, options, env, self);
  };

  return md;
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

export function renderMarkdown(markdown: string) {
  const md = createMarkdown();
  const html = md.render(markdown || '');
  const toc = extractToc(html);
  const words = (markdown || '').replace(/```[\s\S]*?```/g, '').trim().split(/\s+/).filter(Boolean).length;
  const cjk = ((markdown || '').match(/[\u4e00-\u9fa5]/g) || []).length;
  const wordCount = words + cjk;
  const readingTime = Math.max(1, Math.ceil(wordCount / 350));
  return { html, toc, wordCount, readingTime };
}

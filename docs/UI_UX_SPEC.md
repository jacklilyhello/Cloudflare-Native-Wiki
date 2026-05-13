# UI / UX Specification

## Design target

A technical documentation interface inspired by:

- Wiki.js
- GitBook
- VitePress
- Docusaurus
- Notion
- Linear
- Vercel Docs

The visual tone should be:

- minimal
- refined
- technical
- calm
- high readability
- excellent dark mode

## Public page layout

Desktop:

```txt
┌────────────────────────────────────────────────────┐
│ Top Bar                                            │
├───────────────┬──────────────────────┬─────────────┤
│ Left Sidebar  │ Main Article         │ Right TOC   │
│ 280px         │ max-width 860px       │ 220px       │
└───────────────┴──────────────────────┴─────────────┘
```

Mobile:

```txt
Top Bar
Menu Drawer Button
Article
Floating TOC Button
```

## Left navigation

Must support:

- multi-level tree
- collapse/expand
- current page highlight
- auto-expand parents
- icons
- folders
- linked page nodes
- mobile drawer
- optional pinned top nodes

## Right TOC

Must support:

- H2/H3 anchors
- active section highlight
- smooth scroll
- hide on small screens
- sticky position on desktop

## Article typography

Recommended:

```css
.article {
  max-width: 860px;
  font-size: 16px;
  line-height: 1.78;
}

.article h1 {
  font-size: 2.25rem;
  line-height: 1.2;
}

.article h2 {
  font-size: 1.6rem;
  margin-top: 3rem;
  border-bottom: 1px solid var(--border);
}
```

## Code blocks

Must support:

- syntax highlighting
- language label
- copy button
- optional filename
- horizontal scroll
- dark mode optimized background

Future enhancement:

- Shiki themes
- highlighted lines
- diff blocks

## Callouts

Supported types:

- note
- tip
- warning
- danger

Example Markdown:

```md
:::warning
Do not expose your Emby admin port directly to the public internet.
:::
```

## Admin UI

Style should resemble a lightweight modern CMS:

- Notion-like editing simplicity
- Linear-like sidebar polish
- Vercel-like clean forms

Admin sections:

```txt
Dashboard
Pages
Navigation
Assets
Settings
Versions
Audit Logs
```

Page editor:

```txt
Title
Slug
Status

Markdown editor | Live preview

Save Draft | Publish | Versions
```

## Dark mode

Dark mode must not simply invert colors.

Use:

```css
--bg: #09090b;
--surface: #151518;
--border: #27272a;
--text: #f4f4f5;
--muted: #a1a1aa;
--primary: #60a5fa;
--code-bg: #020617;
```

## Motion

Keep motion subtle:

- sidebar expand/collapse 150-200ms
- drawer slide 180-220ms
- skeleton fade
- page transitions light, not distracting


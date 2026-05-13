# Cloudflare Native Emby Wiki

一个面向 Emby / 媒体服务器教程站的 Cloudflare 原生轻量级 Markdown Wiki。

## 技术栈

- Astro + React Islands + TypeScript
- TailwindCSS
- Cloudflare Pages
- Cloudflare Pages Functions
- Cloudflare D1
- Cloudflare R2
- Cloudflare KV
- Cloudflare Cache API
- Markdown-it 渲染管线

## 第一版范围

- 单站点 Wiki
- 页面创建、编辑、删除、发布
- 页面历史版本
- slug 唯一性与旧 slug 重定向
- 左侧导航树
- 右侧 TOC
- Markdown 预览
- 图片上传到 R2
- KV 热缓存
- Cache API 页面缓存
- 后台轻 CMS

## 初始化

```bash
npm install
```

创建 Cloudflare 资源：

```bash
wrangler d1 create cf_native_wiki
wrangler kv namespace create WIKI_KV
wrangler r2 bucket create cf-native-emby-wiki-assets
```

把返回的 ID 填入 `wrangler.toml`。

设置密钥：

```bash
wrangler secret put JWT_SECRET
wrangler secret put ADMIN_PASSWORD_HASH
```

开发阶段可以在 `.dev.vars` 中写：

```bash
JWT_SECRET=dev-secret-change-me
ADMIN_DEV_PASSWORD=admin123456
```

执行数据库迁移：

```bash
npm run db:migrate:local
# 或生产
npm run db:migrate:remote
```

本地运行：

```bash
npm run dev
```

Pages Functions 预览：

```bash
npm run build
npm run preview
```

部署：

```bash
npm run deploy
```

## 默认路由

- `/`：公开首页
- `/docs/:slug`：文档页面，由 Pages Function 读取 KV/R2/D1 并返回完整 HTML
- `/admin/login`：后台登录
- `/admin`：后台管理
- `/api/*`：后台 API
- `/assets/*`：R2 资源代理

## Cloudflare 绑定

Pages Functions 需要绑定：

- `DB`：D1 数据库
- `WIKI_KV`：KV 命名空间
- `ASSETS_BUCKET`：R2 Bucket

Cloudflare Pages Functions 的绑定可以接入 KV、D1、R2 等资源；Functions 使用文件系统路由，`functions` 目录结构决定 API 路由。

## 注意

这不是传统 Node.js 常驻后端。前台页面以静态站性能为目标，后台编辑发布后将 Markdown 渲染结果写入 R2 和 KV，前台优先从 Cache API / KV 返回页面。

## Codex handoff

This bundle includes extra documentation for Codex or another coding agent.

Read in this order:

1. `CODEX_START_HERE.md`
2. `CODEX_PROMPT.md`
3. `DESIGN_DOCUMENT.md`
4. `docs/IMPLEMENTATION_STATUS.md`
5. `docs/CODEX_TASKS.md`
6. `docs/DATABASE_DESIGN.md`
7. `docs/CACHE_RENDERING_STRATEGY.md`
8. `docs/CLOUDFLARE_DEPLOYMENT.md`
9. `docs/UI_UX_SPEC.md`


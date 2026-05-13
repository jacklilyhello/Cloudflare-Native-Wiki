# 架构说明

本项目第一版是单站点 Emby Wiki，不做多租户控制台，但数据库保留 `site_id` 字段，为以后 SaaS 化预留空间。

## 读取链路

```txt
Browser -> Cloudflare CDN -> Cache API -> KV -> R2 -> D1
```

前台尽量不访问 D1。页面发布后，Markdown 源文件和 HTML 快照写入 R2，页面完整 HTML payload 写入 KV，访问 `/docs/:slug` 时优先走 Cache API 和 KV。

## 写入链路

```txt
Admin -> Pages Functions -> D1/R2 -> KV refresh
```

后台所有接口均要求 JWT。草稿不会刷新前台缓存，发布才会刷新。

## Cloudflare 资源

- D1：元数据、版本、设置、导航、用户
- R2：图片、Markdown 源文档、HTML 快照
- KV：页面热缓存、导航树、公开设置、sitemap
- Cache API：HTML 响应级缓存

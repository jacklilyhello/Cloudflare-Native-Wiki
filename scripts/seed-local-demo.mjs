import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const pageId = 'pg_getting_started';
const versionId = 'ver_getting_started_v1';
const siteId = 'site_default';
const slug = 'getting-started';
const contentKey = `content/pages/${pageId}/${versionId}.md`;
const renderedKey = `rendered/pages/${pageId}/${versionId}.html`;

const markdown = `# Getting Started\n\n欢迎使用 Cloudflare Native Emby Wiki。\n\n- 创建页面\n- 保存草稿\n- 发布内容\n`;
const html = `<h1 id="getting-started">Getting Started</h1><p>欢迎使用 Cloudflare Native Emby Wiki。</p><ul><li>创建页面</li><li>保存草稿</li><li>发布内容</li></ul>`;
const tocJson = JSON.stringify([{ level: 2, id: 'getting-started', text: 'Getting Started' }]).replace(/'/g, "''");

mkdirSync('.tmp', { recursive: true });
writeFileSync('.tmp/getting-started.md', markdown);
writeFileSync('.tmp/getting-started.html', html);

execSync(`wrangler r2 object put cf-native-emby-wiki-assets/${contentKey} --file .tmp/getting-started.md --local`, { stdio: 'inherit' });
execSync(`wrangler r2 object put cf-native-emby-wiki-assets/${renderedKey} --file .tmp/getting-started.html --local`, { stdio: 'inherit' });

const sql = `
INSERT OR IGNORE INTO settings (site_id, key, value) VALUES
('${siteId}','site.title','Emby Wiki'),
('${siteId}','site.footer','Powered by Cloudflare Native Wiki'),
('${siteId}','seo.default_description','Cloudflare Native Emby Wiki');

INSERT OR REPLACE INTO pages
(id, site_id, title, slug, normalized_slug, summary, status, visibility, content_r2_key, rendered_r2_key, toc_json, reading_time, word_count, current_version_id, published_at, created_by, updated_by, updated_at)
VALUES
('${pageId}','${siteId}','Getting Started','${slug}','${slug}','本地演示已发布页面','published','public','${contentKey}','${renderedKey}','${tocJson}',1,24,'${versionId}',CURRENT_TIMESTAMP,NULL,NULL,CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO page_versions
(id, site_id, page_id, version_number, title, slug, content_r2_key, rendered_r2_key, content_hash, toc_json, status, created_by)
VALUES
('${versionId}','${siteId}','${pageId}',1,'Getting Started','${slug}','${contentKey}','${renderedKey}','seedhash001','${tocJson}','published',NULL);

INSERT OR REPLACE INTO navigation
(id, site_id, parent_id, page_id, label, icon, href, sort_order, depth, is_folder, is_visible)
VALUES
('nav_getting_started','${siteId}',NULL,'${pageId}','Getting Started','book-open','/docs/${slug}',0,0,0,1);

INSERT OR REPLACE INTO slug_redirects
(id, site_id, page_id, old_slug, old_normalized_slug, new_slug, redirect_type)
VALUES
('redir_getting_started_old','${siteId}','${pageId}','getting-started-old','getting-started-old','${slug}',301);
`;

writeFileSync('.tmp/seed-local-demo.sql', sql);
execSync('wrangler d1 execute cf_native_wiki --local --file .tmp/seed-local-demo.sql', { stdio: 'inherit' });

console.log('Local seed completed: /docs/getting-started should be available.');

import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Image, Settings, LogOut, Plus, Save, Send, AlertCircle, CheckCircle2, Loader2, Trash2, Copy } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { gunzipSync, strFromU8 } from 'fflate';

type PageItem = { id: string; title: string; slug: string; status: string; summary?: string; content?: string; meta_title?: string; meta_description?: string };
type SettingsMap = Record<string, string>;
type Toast = { id: number; type: 'success' | 'error'; message: string };

function authHeaders() { const token = localStorage.getItem('wiki_token'); return token ? { Authorization: `Bearer ${token}` } : undefined; }

async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set('content-type', headers.get('content-type') || 'application/json');
  const token = localStorage.getItem('wiki_token');
  if (token) headers.set('authorization', `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (res.status === 401) {
    localStorage.removeItem('wiki_token');
    if (location.pathname !== '/admin/login') location.href = '/admin/login';
  }
  if (!res.ok || json?.ok === false) throw new Error(json?.error?.message || json?.error || `Request failed: ${res.status}`);
  return json.data ?? json;
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (type: Toast['type'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((s) => [...s, { id, type, message }]);
    setTimeout(() => setToasts((s) => s.filter((t) => t.id !== id)), 3000);
  };
  return { toasts, push };
}

const LoadingButton = ({ loading, children, ...props }: any) => (
  <button disabled={loading || props.disabled} {...props} className={`${props.className} disabled:opacity-50`}>
    {loading && <Loader2 size={15} className="mr-2 inline animate-spin" />}
    {children}
  </button>
);

export default function AdminApp() {
  const [tab, setTab] = useState<'pages' | 'navigation' | 'assets' | 'settings' | 'import'>('pages');
  const { toasts, push } = useToasts();
  useEffect(() => { if (!localStorage.getItem('wiki_token')) location.href = '/admin/login'; }, []);

  const tabs = [
    { id: 'pages', label: '页面', icon: FileText }, { id: 'navigation', label: '导航树', icon: FileText },
    { id: 'assets', label: '资源', icon: Image }, { id: 'settings', label: '站点设置', icon: Settings }, { id: 'import', label: 'Import', icon: FileText }
  ] as const;

  return <main className="min-h-screen bg-[var(--bg-soft)] text-[var(--text)]"><aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[var(--border)] bg-[var(--surface)] p-4 md:block"><div className="mb-8 px-2"><div className="text-lg font-semibold">Emby Wiki</div><div className="text-xs text-[var(--muted)]">Cloudflare Native CMS</div></div><nav className="space-y-1">{tabs.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id as any)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm ${tab === item.id ? 'bg-[var(--primary-soft)] text-[var(--primary)]' : 'text-[var(--muted)] hover:bg-[var(--bg-soft)]'}`}><Icon size={16} />{item.label}</button>; })}</nav><button onClick={() => { localStorage.removeItem('wiki_token'); location.href = '/admin/login'; }} className="absolute bottom-4 left-4 right-4 flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)]"><LogOut size={16} /> 退出登录</button></aside><section className="md:pl-64"><div className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4"><h1 className="text-xl font-semibold">后台管理</h1></div><div className="p-4 md:p-6">{tab === 'pages' && <PagesPanel push={push} />}{tab === 'navigation' && <NavigationPanel push={push} />}{tab === 'assets' && <AssetsPanel push={push} />}{tab === 'settings' && <SettingsPanel push={push} />}{tab === 'import' && <ImportPanel push={push} />}</div></section>
    <div className="fixed right-4 top-4 z-50 space-y-2">{toasts.map((t) => <div key={t.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white shadow ${t.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>{t.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}{t.message}</div>)}</div>
  </main>;
}

function PagesPanel({ push }: { push: (t: 'success' | 'error', m: string) => void }) { const [pages, setPages] = useState<PageItem[]>([]); const [selected, setSelected] = useState<PageItem | null>(null); const [content, setContent] = useState(''); const [preview, setPreview] = useState(''); const [loading, setLoading] = useState<Record<string, boolean>>({});
  const setL = (k: string, v: boolean) => setLoading((s) => ({ ...s, [k]: v }));
  async function loadPages() { const data = await api('/api/pages'); setPages(data.pages || []); }
  async function openPage(id: string) { setL('open', true); try { const data = await api(`/api/pages/${id}`); setSelected(data.page); setContent(data.content || ''); } catch (e: any) { push('error', `打开页面失败: ${e.message}`); } finally { setL('open', false); } }
  async function createPage() { setL('create', true); try { const data = await api('/api/pages', { method: 'POST', body: JSON.stringify({ title: '新页面', slug: `new-page-${Date.now()}` }) }); await loadPages(); await openPage(data.page.id); push('success', '页面已创建'); } catch (e: any) { push('error', e.message); } finally { setL('create', false); } }
  async function saveDraft() { if (!selected) return; setL('save', true); try { await api(`/api/pages/${selected.id}/draft`, { method: 'POST', body: JSON.stringify({ ...selected, content }) }); push('success', '草稿已保存'); await loadPages(); } catch (e: any) { push('error', `保存失败: ${e.message}`); } finally { setL('save', false); } }
  async function publish() { if (!selected) return; setL('publish', true); try { await api(`/api/pages/${selected.id}/publish`, { method: 'POST', body: JSON.stringify({ ...selected, content }) }); push('success', '页面已发布'); await loadPages(); } catch (e: any) { push('error', `发布失败: ${e.message}`); } finally { setL('publish', false); } }
  async function removePage() { if (!selected || !confirm('确认删除页面？')) return; setL('delete', true); try { await api(`/api/pages/${selected.id}`, { method: 'DELETE' }); setSelected(null); await loadPages(); push('success', '页面已删除'); } catch (e: any) { push('error', `删除失败: ${e.message}`); } finally { setL('delete', false); } }
  async function updatePreview(next: string) { setContent(next); try { const data = await api('/api/markdown/preview', { method: 'POST', body: JSON.stringify({ markdown: next }) }); setPreview(data.html); } catch {} }
  useEffect(() => { loadPages().catch((e) => push('error', e.message)); }, []);
  return <div className="grid gap-4 lg:grid-cols-[320px_1fr]"><div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">页面</h2><LoadingButton loading={loading.create} onClick={createPage} className="inline-flex items-center gap-1 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white"><Plus size={14} />新建</LoadingButton></div><div className="space-y-2">{pages.map((p) => <button key={p.id} onClick={() => openPage(p.id)} className={`w-full rounded-xl border p-3 text-left ${selected?.id === p.id ? 'border-[var(--primary)] bg-[var(--primary-soft)]' : 'border-[var(--border)] hover:border-[var(--primary)]'}`}><div className="text-sm font-medium">{p.title}</div><div className="mt-1 truncate text-xs text-[var(--muted)]">/docs/{p.slug}</div><div className="mt-2 text-xs text-[var(--muted)]">{p.status}</div></button>)}</div></div>
  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">{!selected ? <Empty label="选择或创建一个页面" /> : <div><div className="grid gap-3 md:grid-cols-2"><label className="block text-sm">标题<input value={selected.title} onChange={(e) => setSelected({ ...selected, title: e.target.value })} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2" /></label><label className="block text-sm">Slug<input value={selected.slug} onChange={(e) => setSelected({ ...selected, slug: e.target.value })} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2" /></label></div><label className="mt-3 block text-sm">摘要<input value={selected.summary || ''} onChange={(e) => setSelected({ ...selected, summary: e.target.value })} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2" /></label>
  <div className="mt-3 grid gap-3 md:grid-cols-2"><label className="text-sm">SEO 标题<input value={selected.meta_title || ''} onChange={(e) => setSelected({ ...selected, meta_title: e.target.value })} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2" /></label><label className="text-sm">SEO 描述<input value={selected.meta_description || ''} onChange={(e) => setSelected({ ...selected, meta_description: e.target.value })} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2" /></label></div>
  <div className="mt-4 grid gap-4 xl:grid-cols-2"><div className="overflow-hidden rounded-xl border border-[var(--border)]"><CodeMirror value={content} height="480px" extensions={[markdown()]} onChange={updatePreview} /></div><div className="max-h-[480px] overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg)] p-5"><article className="markdown-body" dangerouslySetInnerHTML={{ __html: preview || '<p class="text-sm opacity-60">预览会显示在这里</p>' }} /></div></div>
  <div className="mt-4 flex flex-wrap items-center gap-3"><LoadingButton loading={loading.save} onClick={saveDraft} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm"><Save size={16} />保存草稿</LoadingButton><LoadingButton loading={loading.publish} onClick={publish} className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"><Send size={16} />发布</LoadingButton><LoadingButton loading={loading.delete} onClick={removePage} className="inline-flex items-center gap-2 rounded-xl border border-rose-400 px-4 py-2 text-sm text-rose-600"><Trash2 size={16} />删除</LoadingButton></div></div>}</div></div>;
}

function NavigationPanel({ push }: any) { const [jsonMode, setJsonMode] = useState('[]'); const [loading, setLoading] = useState(false); useEffect(() => { api('/api/navigation').then((d) => setJsonMode(JSON.stringify(d.tree || [], null, 2))).catch((e) => push('error', e.message)); }, []);
  return <Panel title="导航树管理" desc="当前版本先提供 JSON 可视编辑 + 保存反馈。"><textarea value={jsonMode} onChange={(e) => setJsonMode(e.target.value)} className="h-80 w-full rounded-xl border p-3 font-mono text-xs" /><div className="mt-3"><LoadingButton loading={loading} onClick={async () => { try { setLoading(true); const tree = JSON.parse(jsonMode); await api('/api/navigation', { method: 'PUT', body: JSON.stringify({ tree }) }); push('success', '导航已保存'); } catch (e: any) { push('error', `导航保存失败: ${e.message}`); } finally { setLoading(false); } }} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm text-white">保存导航</LoadingButton></div></Panel>; }

function AssetsPanel({ push }: any) { const [assets, setAssets] = useState<any[]>([]); const [loading, setLoading] = useState(false);
  const load = async () => { const d = await api('/api/assets'); setAssets(d.assets || []); };
  useEffect(() => { load().catch((e) => push('error', e.message)); }, []);
  async function upload(files: FileList | null) { if (!files?.length) return; setLoading(true); try { for (const file of Array.from(files)) { const form = new FormData(); form.append('file', file); await api('/api/assets/upload', { method: 'POST', headers: authHeaders(), body: form }); } await load(); push('success', `上传成功 (${files.length})`); } catch (e: any) { push('error', `上传失败: ${e.message}`); } finally { setLoading(false); } }
  return <Panel title="资源管理" desc="支持多文件上传 + 复制 Markdown。"><label className="flex min-h-36 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-[var(--border)] p-6 text-sm text-[var(--muted)]">{loading ? '上传中...' : '点击选择图片上传（可多选）'}<input multiple type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files)} /></label><div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">{assets.map((asset) => <div key={asset.id} className="rounded-xl border border-[var(--border)] p-3"><img src={asset.public_url} alt={asset.original_filename} className="h-28 w-full rounded-lg object-cover" /><div className="mt-2 truncate text-xs">{asset.original_filename}</div><div className="mt-2 flex gap-2"><button className="rounded border px-2 py-1 text-xs" onClick={async () => { await navigator.clipboard.writeText(`![${asset.original_filename}](${asset.public_url})`); push('success', 'Markdown 已复制'); }}><Copy size={12} className="mr-1 inline" />Markdown</button></div></div>)}</div></Panel>; }

function SettingsPanel({ push }: any) { const [settings, setSettings] = useState<SettingsMap>({}); const [loading, setLoading] = useState(false); useEffect(() => { api('/api/settings').then((d) => setSettings(d.settings || {})).catch((e) => push('error', e.message)); }, []);
  const keys = useMemo(() => Object.keys(settings).sort(), [settings]);
  return <Panel title="站点设置" desc="保存后会刷新公开设置缓存。"><div className="grid gap-3 md:grid-cols-2">{keys.map((key) => <label key={key} className="block text-sm">{key}<input value={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2" /></label>)}</div><div className="mt-4"><LoadingButton loading={loading} onClick={async () => { try { setLoading(true); await api('/api/settings', { method: 'PUT', body: JSON.stringify({ settings }) }); push('success', '设置已保存'); } catch (e: any) { push('error', `设置保存失败: ${e.message}`); } finally { setLoading(false); } }} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white">保存设置</LoadingButton></div></Panel>; }

function ImportPanel({ push }: any) {
  const [parsed, setParsed] = useState<any>({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [jobId, setJobId] = useState<string>('');
  const [failedAssets, setFailedAssets] = useState<any[]>([]);
  const [jobReport, setJobReport] = useState<any>(null);
  const addLog = (line: string) => setLogs((s) => [`${new Date().toLocaleTimeString()} ${line}`, ...s].slice(0, 40));
  async function parse(file: File) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const tar = gunzipSync(buf);
    const files = parseTar(tar);
    const out: any = { assets: [] };
    Object.entries(files).forEach(([k, v]: any) => {
      const name = String(k);
      if (name.endsWith('settings.json')) out.settings = JSON.parse(strFromU8(v));
      else if (name.endsWith('navigation.json')) out.navigation = JSON.parse(strFromU8(v));
      else if (name.endsWith('pages.json.gz')) out.pages = JSON.parse(strFromU8(gunzipSync(v)));
      else if (name.endsWith('pages-history.json.gz')) out.history = JSON.parse(strFromU8(gunzipSync(v)));
      else if (name.includes('/assets/')) out.assets.push({ path: name, name: name.split('/').pop(), mime: 'image/png', dataBase64: btoa(String.fromCharCode(...v)) });
    });
    out.navigationTree = mapWikiNavigation(out.navigation);
    setParsed(out);
    addLog(`解析完成 pages=${out.pages?.length || 0} history=${out.history?.length || 0} assets=${out.assets?.length || 0}`);
    push('success', `解析完成: pages=${out.pages?.length || 0}, assets=${out.assets?.length || 0}`);
  }
  return <Panel title="Wiki.js Import" desc="上传 tar.gz 并分步导入 settings/assets/pages/navigation。"><label className="flex min-h-24 cursor-pointer items-center justify-center rounded-xl border border-dashed p-4">上传 wikijs-web-export-*.tar.gz<input type="file" className="hidden" accept=".tar.gz,.tgz" onChange={(e) => e.target.files?.[0] && parse(e.target.files[0]).catch((err) => push('error', err.message))} /></label>
  <div className="mt-3 text-sm">pages: {parsed.pages?.length || 0} / history: {parsed.history?.length || 0} / assets: {parsed.assets?.length || 0}</div>
  <div className="mt-2 h-2 rounded bg-slate-200"><div className="h-2 rounded bg-blue-500" style={{ width: `${progress}%` }} /></div>
  <div className="mt-3 flex gap-2">
    <LoadingButton loading={running} onClick={async () => { try { setRunning(true); setFailedAssets([]); const totalItems = (parsed.pages?.length || 0) + (parsed.assets?.length || 0) + 2; const oldJob = jobId ? await api(`/api/import/jobs/${jobId}`) : null; const nextOffset = oldJob?.job?.processed_items ? Math.max(0, Number(oldJob.job.processed_items) - (parsed.assets?.length || 0)) : 0; const job = oldJob?.job ? { id: oldJob.job.id } : await api('/api/import/jobs', { method: 'POST', body: JSON.stringify({ source: 'wikijs', totalItems }) }); setJobId(job.id); setProgress(5); addLog(`开始导入 job=${job.id} offset=${nextOffset}`); if (parsed.settings) { await api('/api/import/wikijs/settings', { method: 'POST', body: JSON.stringify({ settings: parsed.settings }) }); addLog('settings 导入完成'); } setProgress(25); if (parsed.assets?.length && nextOffset === 0) { const chunks = chunk(parsed.assets, 10); for (let i = 0; i < chunks.length; i++) { const result = await retry(async () => api('/api/import/wikijs/assets', { method: 'POST', body: JSON.stringify({ assets: chunks[i], jobId: job.id }) }), 2); if (result.failures?.length) setFailedAssets((s: any[]) => [...s, ...result.failures]); setProgress(25 + Math.round(((i + 1) / chunks.length) * 35)); addLog(`assets 批次 ${i + 1}/${chunks.length}`); } } if (parsed.pages?.length) { const pageChunks = chunk(parsed.pages.slice(nextOffset), 50); for (let i = 0; i < pageChunks.length; i++) { await api('/api/import/wikijs/pages', { method: 'POST', body: JSON.stringify({ pages: parsed.pages, history: parsed.history || [], pageOffset: nextOffset + i * 50, pageLimit: 50, jobId: job.id }) }); addLog(`pages 分页 ${i + 1}/${pageChunks.length}`); } } setProgress(80); if (parsed.navigationTree?.length) { await api('/api/import/wikijs/navigation', { method: 'POST', body: JSON.stringify({ tree: parsed.navigationTree }) }); addLog('navigation 导入完成'); } setProgress(100); const summaryFailed = failedAssets.length; await api(`/api/import/jobs/${job.id}`, { method: 'PATCH', body: JSON.stringify({ status: summaryFailed ? 'partial' : 'done', progress: 100, summaryJson: { failedAssets: summaryFailed } }) }); setJobReport((await api(`/api/import/jobs/${job.id}`)).job); push('success', '导入完成'); } catch (e: any) { addLog(`失败: ${e.message}`); if (jobId) await api(`/api/import/jobs/${jobId}`, { method: 'PATCH', body: JSON.stringify({ status: 'failed', errorJson: { message: e.message } }) }); push('error', `导入失败: ${e.message}`); } finally { setRunning(false); } }} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm text-white">开始/恢复导入</LoadingButton>
    {failedAssets.length > 0 && <button className="rounded-xl border px-3 py-2 text-sm" onClick={async()=>{const retryAssets=parsed.assets.filter((a:any)=>failedAssets.some((f:any)=>f.name===a.name)); const res=await api('/api/import/wikijs/assets-replay',{method:'POST',body:JSON.stringify({assets:retryAssets,jobId})}); setFailedAssets(res.failures||[]); push('success',`重试完成，剩余失败 ${res.failures?.length||0}`);}}>重放失败批次({failedAssets.length})</button>}
    <button className="rounded-xl border px-3 py-2 text-sm" onClick={async()=> jobId && setJobReport((await api(`/api/import/jobs/${jobId}`)).job)}>刷新报告</button>
  </div><div className="mt-3 max-h-40 overflow-auto rounded border p-2 text-xs">{logs.map((l, i) => <div key={i}>{l}</div>)}</div>{jobReport && <div className="mt-3 rounded border p-3 text-xs"><div>job: {jobReport.id}</div><div>status: {jobReport.status}</div><div>progress: {jobReport.progress}%</div><div>processed: {jobReport.processed_items}/{jobReport.total_items}</div><div>summary: {jobReport.summary_json}</div><div>error: {jobReport.error_json}</div></div>}</Panel>;
}

function parseTar(data: Uint8Array): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {};
  let offset = 0;
  while (offset + 512 <= data.length) {
    const header = data.slice(offset, offset + 512);
    const name = strFromU8(header.slice(0, 100)).replace(/\0.*$/, '');
    if (!name) break;
    const sizeOct = strFromU8(header.slice(124, 136)).replace(/\0.*$/, '').trim();
    const size = parseInt(sizeOct || '0', 8) || 0;
    const start = offset + 512;
    const end = start + size;
    out[name] = data.slice(start, end);
    offset = start + Math.ceil(size / 512) * 512;
  }
  return out;
}
function chunk<T>(arr: T[], n: number) { const out: T[][] = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }
async function retry(fn: () => Promise<any>, times = 2) { let err: any; for (let i = 0; i <= times; i++) { try { return await fn(); } catch (e) { err = e; } } throw err; }
function mapWikiNavigation(nav: any) {
  const localePriority = ['zh', 'zh-CN', 'en'];
  const siteNode = nav?.site || {};
  const picked = localePriority.map((k) => siteNode?.[k]?.items).find(Boolean) || siteNode?.items || nav?.items || [];
  const mapItems = (items: any[]): any[] => (items || []).map((item: any, idx: number) => {
    const visibilityGroups = Array.isArray(item.visibilityGroups) ? item.visibilityGroups : [];
    const hidden = item.visibilityMode === 'hidden' || (item.visibilityMode === 'groups' && visibilityGroups.length > 0);
    if (item.kind === 'header') return { id: `imp-${Date.now()}-${idx}`, type: 'section', title: item.label || 'Header', icon: item.icon, hidden, visibilityGroups, children: mapItems(item.items || []) };
    if (item.targetType === 'external') return { id: `imp-${Date.now()}-${idx}`, type: 'external', title: item.label || item.target, href: item.target, icon: item.icon, hidden, visibilityGroups };
    const slug = normalizeImportedSlug(String(item.target || ''));
    return { id: `imp-${Date.now()}-${idx}`, type: 'page', title: item.label || slug, slug, icon: item.icon, hidden, visibilityGroups };
  });
  return mapItems(picked);
}
function normalizeImportedSlug(raw: string) {
  return raw.replace(/^https?:\/\/[^/]+\//, '').replace(/^\/?docs\//, '').replace(/^\/?zh\//, '').replace(/^\/+/, '');
}

function Panel({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-lg font-semibold">{title}</h2>{desc && <p className="mt-1 text-sm text-[var(--muted)]">{desc}</p>}<div className="mt-5">{children}</div></section>; }
function Empty({ label }: { label: string }) { return <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--muted)]">{label}</div>; }

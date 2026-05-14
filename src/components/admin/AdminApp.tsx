import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Image, Settings, LogOut, Plus, Save, Send, LayoutDashboard, History, Search, Copy, Trash2 } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';

type PageItem = {
  id: string;
  title: string;
  slug: string;
  status: string;
  summary?: string;
  updated_at?: string;
  published_at?: string;
  content?: string;
};

type SettingsMap = Record<string, string>;
type NavNode = { id?: string; label: string; href?: string; icon?: string; is_folder?: boolean; is_visible?: boolean; children?: NavNode[] };

function authHeaders() {
  const token = localStorage.getItem('wiki_token');
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set('content-type', headers.get('content-type') || 'application/json');
  const token = localStorage.getItem('wiki_token');
  if (token) headers.set('authorization', `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(json?.error || `Request failed: ${res.status}`);
  return json;
}

function useAuthGuard() {
  useEffect(() => {
    if (!localStorage.getItem('wiki_token')) location.href = '/admin/login';
  }, []);
}

export default function AdminApp() {
  useAuthGuard();
  const [tab, setTab] = useState<'dashboard' | 'pages' | 'navigation' | 'assets' | 'settings' | 'audit'>('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pages', label: '页面', icon: FileText },
    { id: 'navigation', label: '导航树', icon: FileText },
    { id: 'assets', label: '资源', icon: Image },
    { id: 'settings', label: '站点设置', icon: Settings },
    { id: 'audit', label: '审计日志', icon: History }
  ] as const;

  return (
    <main className="min-h-screen bg-[var(--bg-soft)] text-[var(--text)]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[var(--border)] bg-[var(--surface)] p-4 md:block">
        <div className="mb-8 px-2">
          <div className="text-lg font-semibold">Emby Wiki</div>
          <div className="text-xs text-[var(--muted)]">Cloudflare Native CMS</div>
        </div>
        <nav className="space-y-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => setTab(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm ${tab === item.id ? 'bg-[var(--primary-soft)] text-[var(--primary)]' : 'text-[var(--muted)] hover:bg-[var(--bg-soft)]'}`}>
                <Icon size={16} /> {item.label}
              </button>
            );
          })}
        </nav>
        <button onClick={() => { localStorage.removeItem('wiki_token'); location.href = '/admin/login'; }} className="absolute bottom-4 left-4 right-4 flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)]">
          <LogOut size={16} /> 退出登录
        </button>
      </aside>
      <section className="md:pl-64">
        <div className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4"><h1 className="text-xl font-semibold">后台管理</h1></div>
        <div className="p-4 md:p-6">
          {tab === 'dashboard' && <DashboardPanel />}
          {tab === 'pages' && <PagesPanel />}
          {tab === 'navigation' && <NavigationPanel />}
          {tab === 'assets' && <AssetsPanel />}
          {tab === 'settings' && <SettingsPanel />}
          {tab === 'audit' && <AuditPanel />}
        </div>
      </section>
    </main>
  );
}

function DashboardPanel() {
  const [pages, setPages] = useState<PageItem[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  useEffect(() => {
    api('/api/pages').then((d) => setPages(d.pages || [])).catch(console.error);
    api('/api/assets').then((d) => setAssets(d.assets || [])).catch(console.error);
  }, []);
  const published = pages.filter((p) => p.status === 'published').length;
  const draft = pages.filter((p) => p.status !== 'published').length;
  const recent = [...pages].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || ''))).slice(0, 5);
  const cards = [
    { label: '页面总数', value: pages.length },
    { label: '已发布', value: published },
    { label: '草稿/其他', value: draft },
    { label: '资源总数', value: assets.length }
  ];
  return <Panel title="Dashboard" desc="站点核心概览">
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{cards.map((c) => <div key={c.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4"><div className="text-xs text-[var(--muted)]">{c.label}</div><div className="mt-2 text-2xl font-semibold">{c.value}</div></div>)}</div>
    <h3 className="mt-5 text-sm font-semibold">最近更新页面</h3>
    <div className="mt-2 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">{recent.map((r) => <div key={r.id} className="flex items-center justify-between px-3 py-2 text-sm"><span>{r.title}</span><span className="text-xs text-[var(--muted)]">{r.updated_at?.slice(0, 10) || '-'}</span></div>)}</div>
  </Panel>;
}

function PagesPanel() {
  const [pages, setPages] = useState<PageItem[]>([]);
  const [selected, setSelected] = useState<PageItem | null>(null);
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState('');
  const [message, setMessage] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [slugStatus, setSlugStatus] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  async function loadPages() { const json = await api('/api/pages'); setPages(json.pages || []); }
  async function openPage(id: string) { const json = await api(`/api/pages/${id}`); setSelected(json.page); setContent(json.content || ''); }
  async function createPage() {
    const json = await api('/api/pages', { method: 'POST', body: JSON.stringify({ title: '新页面', slug: 'new-page', summary: '' }) });
    await loadPages(); await openPage(json.page.id);
  }
  async function saveDraft() { if (!selected) return; await api(`/api/pages/${selected.id}/draft`, { method: 'POST', body: JSON.stringify({ ...selected, content }) }); setMessage('草稿已保存'); await loadPages(); }
  async function publish() { if (!selected) return; await api(`/api/pages/${selected.id}/publish`, { method: 'POST', body: JSON.stringify({ ...selected, content }) }); setMessage('已发布'); await loadPages(); }
  async function removePage() { if (!selected || !confirm(`确认删除 ${selected.title} ?`)) return; await api(`/api/pages/${selected.id}`, { method: 'DELETE' }); setSelected(null); setContent(''); setPreview(''); await loadPages(); }

  useEffect(() => { loadPages().catch(console.error); }, []);
  useEffect(() => {
    if (!selected?.slug) return;
    const timer = setTimeout(async () => {
      try {
        const json = await api(`/api/pages/slug/check?slug=${encodeURIComponent(selected.slug)}${selected.id ? `&excludeId=${selected.id}` : ''}`);
        setSlugStatus(json.available ? 'Slug 可用' : 'Slug 已存在，请更换');
      } catch { setSlugStatus('Slug 检测失败'); }
    }, 320);
    return () => clearTimeout(timer);
  }, [selected?.slug, selected?.id]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const json = await api('/api/markdown/preview', { method: 'POST', body: JSON.stringify({ markdown: content }) });
        setPreview(json.html || ''); setPreviewError('');
      } catch (error: any) { setPreviewError(error?.message || '预览失败'); }
    }, 380);
    return () => clearTimeout(timer);
  }, [content]);

  const filteredPages = useMemo(() => pages.filter((p) => (statusFilter === 'all' || p.status === statusFilter) && (`${p.title} ${p.slug}`.toLowerCase().includes(query.toLowerCase()))), [pages, statusFilter, query]);

  return (
    <div className="grid gap-4 lg:grid-cols-[350px_1fr]">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">页面</h2><button onClick={createPage} className="inline-flex items-center gap-1 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white"><Plus size={14} />新建</button></div>
        <div className="space-y-2">
          <div className="flex gap-2"><div className="relative w-full"><Search size={14} className="absolute left-2 top-2.5 text-[var(--muted)]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索标题/slug" className="w-full rounded-lg border border-[var(--border)] bg-transparent py-2 pl-7 pr-2 text-sm" /></div><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-[var(--border)] bg-transparent px-2 text-sm"><option value="all">全部</option><option value="published">published</option><option value="draft">draft</option></select></div>
          {filteredPages.map((p) => (<button key={p.id} onClick={() => openPage(p.id)} className="w-full rounded-xl border border-[var(--border)] p-3 text-left hover:border-[var(--primary)]"><div className="text-sm font-medium">{p.title}</div><div className="mt-1 truncate text-xs text-[var(--muted)]">/docs/{p.slug}</div><div className="mt-2 inline-flex rounded-full bg-[var(--bg-soft)] px-2 py-0.5 text-xs">{p.status}</div></button>))}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        {!selected ? <Empty label="选择或创建一个页面" /> : <>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm">标题<input value={selected.title} onChange={(e) => setSelected({ ...selected, title: e.target.value })} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2" /></label>
            <label className="block text-sm">Slug<input value={selected.slug} onChange={(e) => setSelected({ ...selected, slug: e.target.value })} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2" /><span className={`mt-1 block text-xs ${slugStatus.includes('可用') ? 'text-green-600' : 'text-amber-500'}`}>{slugStatus || '输入后自动检查 slug 冲突'}</span></label>
          </div>
          <label className="mt-3 block text-sm">摘要<input value={selected.summary || ''} onChange={(e) => setSelected({ ...selected, summary: e.target.value })} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2" /></label>
          <div className="mt-4 grid gap-4 xl:grid-cols-2"><div className="overflow-hidden rounded-xl border border-[var(--border)]"><CodeMirror value={content} height="620px" extensions={[markdown()]} onChange={setContent} basicSetup={{ lineNumbers: true }} /></div><div className="max-h-[620px] overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg)] p-5"><article className="markdown-body" dangerouslySetInnerHTML={{ __html: preview || '<p class="text-sm opacity-60">预览会显示在这里</p>' }} />{previewError && <p className="mt-3 text-sm text-red-500">{previewError}</p>}</div></div>
          <div className="mt-4 flex flex-wrap items-center gap-3"><button onClick={saveDraft} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm"><Save size={16} />保存草稿</button><button onClick={publish} className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"><Send size={16} />发布</button><button onClick={removePage} className="inline-flex items-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm text-red-600"><Trash2 size={16} />删除</button>{selected.slug && <a href={`/docs/${selected.slug}`} target="_blank" className="text-sm text-[var(--primary)]">查看前台页面</a>}<span className="text-sm text-[var(--muted)]">{message}</span></div>
        </>}
      </div>
    </div>
  );
}

function NavigationPanel() {
  const [tree, setTree] = useState<NavNode[]>([]);
  const [message, setMessage] = useState('');
  useEffect(() => { api('/api/navigation').then((json) => setTree(json.tree || [])).catch(console.error); }, []);

  function updateAtPath(path: number[], patch: Partial<NavNode>) {
    const walk = (nodes: NavNode[], depth = 0): NavNode[] => nodes.map((node, idx) => {
      if (idx !== path[depth]) return node;
      if (depth === path.length - 1) return { ...node, ...patch };
      return { ...node, children: walk(node.children || [], depth + 1) };
    });
    setTree((prev) => walk(prev));
  }
  function addSibling(path: number[], isFolder = false) {
    const walk = (nodes: NavNode[], depth = 0): NavNode[] => {
      if (depth === path.length - 1) {
        const next = [...nodes];
        next.splice(path[depth] + 1, 0, { label: isFolder ? '新目录' : '新页面', href: isFolder ? '' : '/docs/', icon: '📄', is_folder: isFolder, is_visible: true, children: [] });
        return next;
      }
      return nodes.map((n, i) => i === path[depth] ? { ...n, children: walk(n.children || [], depth + 1) } : n);
    };
    setTree((prev) => walk(prev));
  }
  function addChild(path: number[]) {
    const walk = (nodes: NavNode[], depth = 0): NavNode[] => nodes.map((n, i) => {
      if (i !== path[depth]) return n;
      if (depth === path.length - 1) return { ...n, is_folder: true, children: [...(n.children || []), { label: '子页面', href: '/docs/', icon: '📄', is_visible: true }] };
      return { ...n, children: walk(n.children || [], depth + 1) };
    });
    setTree((prev) => walk(prev));
  }
  function remove(path: number[]) {
    const walk = (nodes: NavNode[], depth = 0): NavNode[] => {
      if (depth === path.length - 1) return nodes.filter((_, i) => i !== path[depth]);
      return nodes.map((n, i) => i === path[depth] ? { ...n, children: walk(n.children || [], depth + 1) } : n);
    };
    setTree((prev) => walk(prev));
  }
  function move(path: number[], step: number) {
    const walk = (nodes: NavNode[], depth = 0): NavNode[] => {
      if (depth === path.length - 1) {
        const idx = path[depth];
        const target = idx + step;
        if (target < 0 || target >= nodes.length) return nodes;
        const next = [...nodes];
        [next[idx], next[target]] = [next[target], next[idx]];
        return next;
      }
      return nodes.map((n, i) => i === path[depth] ? { ...n, children: walk(n.children || [], depth + 1) } : n);
    };
    setTree((prev) => walk(prev));
  }
  function outdent(path: number[]) {
    if (path.length < 2) return;
    const parentPath = path.slice(0, -1);
    const idx = path[path.length - 1];
    const parentIdx = parentPath[parentPath.length - 1];
    setTree((prev) => {
      const clone = structuredClone(prev) as NavNode[];
      let parentArr: NavNode[] = clone;
      for (let d = 0; d < parentPath.length - 1; d++) parentArr = parentArr[parentPath[d]].children || [];
      const parent = parentArr[parentIdx];
      const child = (parent.children || [])[idx];
      if (!child) return prev;
      parent.children = (parent.children || []).filter((_, i) => i !== idx);
      parentArr.splice(parentIdx + 1, 0, child);
      return clone;
    });
  }
  async function save() { await api('/api/navigation', { method: 'PUT', body: JSON.stringify({ tree }) }); setMessage('导航树已保存'); }

  const renderNodes = (nodes: NavNode[], prefix: number[] = []): React.ReactNode => nodes.map((node, i) => {
    const path = [...prefix, i];
    return <div key={`${path.join('-')}-${node.label}`} className="rounded-xl border border-[var(--border)] p-3">
      <div className="grid gap-2 md:grid-cols-4">
        <input value={node.label} onChange={(e) => updateAtPath(path, { label: e.target.value })} className="rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-sm" />
        <input value={node.href || ''} onChange={(e) => updateAtPath(path, { href: e.target.value })} className="rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-sm" />
        <input value={node.icon || ''} onChange={(e) => updateAtPath(path, { icon: e.target.value })} className="rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-sm" />
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={node.is_visible !== false} onChange={(e) => updateAtPath(path, { is_visible: e.target.checked })} />可见</label>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <button className="rounded border border-[var(--border)] px-2 py-1" onClick={() => move(path, -1)}>上移</button>
        <button className="rounded border border-[var(--border)] px-2 py-1" onClick={() => move(path, 1)}>下移</button>
        <button className="rounded border border-[var(--border)] px-2 py-1" onClick={() => addSibling(path, false)}>新增同级页</button>
        <button className="rounded border border-[var(--border)] px-2 py-1" onClick={() => addChild(path)}>新增子节点</button>
        {path.length > 1 && <button className="rounded border border-[var(--border)] px-2 py-1" onClick={() => outdent(path)}>取消缩进</button>}
        <button className="rounded border border-red-300 px-2 py-1 text-red-600" onClick={() => remove(path)}>删除</button>
      </div>
      {!!node.children?.length && <div className="mt-2 space-y-2 pl-4 border-l border-[var(--border)]">{renderNodes(node.children, path)}</div>}
    </div>;
  });

  return <Panel title="导航树管理" desc="支持多级编辑、子节点、取消缩进、上移下移。拖拽排序下一步补充。">
    <div className="space-y-2">{renderNodes(tree)}</div>
    <div className="mt-3 flex flex-wrap items-center gap-2"><button onClick={() => setTree((prev) => [...prev, { label: '新顶层页面', href: '/docs/', icon: '📄', is_visible: true }])} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">新增顶层页面</button><button onClick={save} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white">保存导航</button><span className="text-sm text-[var(--muted)]">{message}</span></div>
  </Panel>;
}

function AuditPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;
  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), q });
    if (action) params.set('action', action);
    if (entityType) params.set('entity_type', entityType);
    api(`/api/audit-logs?${params.toString()}`).then((json) => {
      setLogs(json.logs || []);
      setTotal(json.pagination?.total || 0);
    }).catch(console.error);
  }, [q, page, action, entityType]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const actionOptions = useMemo(() => [...new Set(logs.map((l) => l.action).filter(Boolean))], [logs]);
  const entityOptions = useMemo(() => [...new Set(logs.map((l) => l.entity_type).filter(Boolean))], [logs]);

  return <Panel title="审计日志" desc="登录、页面变更、设置更新、资源上传记录。">
    <div className="mb-3 grid gap-2 md:grid-cols-3"><input value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder="关键字搜索" className="w-full rounded-lg border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm" /><select value={action} onChange={(e) => { setPage(1); setAction(e.target.value); }} className="rounded-lg border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm"><option value="">全部 action</option>{actionOptions.map((it) => <option key={it} value={it}>{it}</option>)}</select><select value={entityType} onChange={(e) => { setPage(1); setEntityType(e.target.value); }} className="rounded-lg border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm"><option value="">全部 entity_type</option>{entityOptions.map((it) => <option key={it} value={it}>{it}</option>)}</select></div>
    <div className="overflow-auto rounded-xl border border-[var(--border)]"><table className="w-full text-sm"><thead><tr className="bg-[var(--bg-soft)] text-left"><th className="px-3 py-2">时间</th><th className="px-3 py-2">行为</th><th className="px-3 py-2">实体</th><th className="px-3 py-2">用户</th><th className="px-3 py-2">metadata</th></tr></thead><tbody>{logs.map((l) => <React.Fragment key={l.id}><tr className="border-t border-[var(--border)]"><td className="px-3 py-2 text-xs text-[var(--muted)]">{l.created_at?.slice(0, 19) || '-'}</td><td className="px-3 py-2">{l.action}</td><td className="px-3 py-2">{l.entity_type}:{l.entity_id || '-'}</td><td className="px-3 py-2">{l.user_email || '-'}</td><td className="px-3 py-2"><button className="rounded border border-[var(--border)] px-2 py-1 text-xs" onClick={() => setExpandedId((v) => v === l.id ? null : l.id)}>{expandedId === l.id ? '收起' : '展开'}</button></td></tr>{expandedId === l.id && <tr className="border-t border-[var(--border)] bg-[var(--bg-soft)]"><td colSpan={5} className="px-3 py-2"><pre className="overflow-auto text-xs">{JSON.stringify(l.metadata_json ? JSON.parse(l.metadata_json) : {}, null, 2)}</pre></td></tr>}</React.Fragment>)}</tbody></table></div>
    <div className="mt-3 flex items-center gap-2 text-sm"><button className="rounded border border-[var(--border)] px-2 py-1" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</button><span>{page} / {pages}</span><button className="rounded border border-[var(--border)] px-2 py-1" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>下一页</button></div>
  </Panel>;
}

function AssetsPanel() {
  const [assets, setAssets] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');

  async function load() { const json = await api('/api/assets'); setAssets(json.assets || []); }
  async function upload(file: File) {
    const form = new FormData(); form.append('file', file);
    const res = await fetch('/api/assets/upload', { method: 'POST', headers: authHeaders(), body: form });
    const json = await res.json() as { error?: string; markdown?: string };
    if (!res.ok) throw new Error(json.error || '上传失败');
    setMessage(`已上传：${json.markdown}`); await load();
  }
  useEffect(() => { load().catch(console.error); }, []);

  const filtered = useMemo(() => assets.filter((a) => String(a.original_filename || '').toLowerCase().includes(query.toLowerCase())), [assets, query]);

  return <Panel title="资源管理" desc="上传图片到 R2，并返回可插入 Markdown 地址。">
    <label className="flex min-h-36 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-[var(--border)] p-6 text-sm text-[var(--muted)]">点击选择图片上传<input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0]).catch((err) => setMessage(err.message))} /></label>
    <div className="mt-3 flex items-center gap-2"><Search size={14} className="text-[var(--muted)]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索文件名" className="w-full rounded-lg border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm" /></div>
    <p className="mt-3 text-sm text-[var(--muted)]">{message || '删除功能待后端接口接入'}</p>
    <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">{filtered.map((asset) => { const md = `![${asset.alt_text || asset.original_filename}](${asset.public_url})`; return <div key={asset.id} className="rounded-xl border border-[var(--border)] p-3"><img src={asset.public_url} alt={asset.alt_text || asset.original_filename} className="h-32 w-full rounded-lg object-cover" /><div className="mt-2 truncate text-xs">{asset.original_filename}</div><div className="mt-1 truncate text-[11px] text-[var(--muted)]">{asset.public_url}</div><button className="mt-2 inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 text-xs" onClick={() => navigator.clipboard.writeText(md)}><Copy size={12} />复制 Markdown</button></div>; })}</div>
  </Panel>;
}

function SettingsPanel() {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [message, setMessage] = useState('');
  useEffect(() => { api('/api/settings').then((json) => setSettings(json.settings || {})).catch(console.error); }, []);
  async function save() { await api('/api/settings', { method: 'PUT', body: JSON.stringify({ settings }) }); setMessage('设置已保存'); }
  const fields = ['site.title', 'site.logo', 'site.footer', 'seo.default_description', 'theme.primary_color', 'theme.mode'];

  return <Panel title="站点设置" desc="核心公开配置与主题设置。">
    <div className="grid gap-3 md:grid-cols-2">{fields.map((key) => <label key={key} className="block text-sm">{key}<input value={settings[key] || ''} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2" /></label>)}</div>
    <div className="mt-4 flex items-center gap-3"><button onClick={save} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white">保存设置</button><span className="text-sm text-[var(--muted)]">{message}</span></div>
  </Panel>;
}

function Panel({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-lg font-semibold">{title}</h2>{desc && <p className="mt-1 text-sm text-[var(--muted)]">{desc}</p>}<div className="mt-5">{children}</div></section>;
}

function Empty({ label }: { label: string }) {
  return <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--muted)]">{label}</div>;
}

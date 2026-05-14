import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Image, Settings, LogOut, Plus, Save, Send } from 'lucide-react';
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

function authHeaders() {
  const token = localStorage.getItem('wiki_token');
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('content-type', headers.get('content-type') || 'application/json');
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
  const [tab, setTab] = useState<'pages' | 'navigation' | 'assets' | 'settings'>('pages');

  const tabs = [
    { id: 'pages', label: '页面', icon: FileText },
    { id: 'navigation', label: '导航树', icon: FileText },
    { id: 'assets', label: '资源', icon: Image },
    { id: 'settings', label: '站点设置', icon: Settings }
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
              <button
                key={item.id}
                onClick={() => setTab(item.id as any)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm ${tab === item.id ? 'bg-[var(--primary-soft)] text-[var(--primary)]' : 'text-[var(--muted)] hover:bg-[var(--bg-soft)]'}`}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <button
          onClick={() => { localStorage.removeItem('wiki_token'); location.href = '/admin/login'; }}
          className="absolute bottom-4 left-4 right-4 flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)]"
        >
          <LogOut size={16} /> 退出登录
        </button>
      </aside>
      <section className="md:pl-64">
        <div className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
          <h1 className="text-xl font-semibold">后台管理</h1>
        </div>
        <div className="p-4 md:p-6">
          {tab === 'pages' && <PagesPanel />}
          {tab === 'navigation' && <NavigationPanel />}
          {tab === 'assets' && <AssetsPanel />}
          {tab === 'settings' && <SettingsPanel />}
        </div>
      </section>
    </main>
  );
}

function PagesPanel() {
  const [pages, setPages] = useState<PageItem[]>([]);
  const [selected, setSelected] = useState<PageItem | null>(null);
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState('');
  const [message, setMessage] = useState('');

  async function loadPages() {
    const json = await api('/api/pages');
    setPages(json.pages);
  }

  async function openPage(id: string) {
    const json = await api(`/api/pages/${id}`);
    setSelected(json.page);
    setContent(json.content || '');
  }

  async function createPage() {
    const json = await api('/api/pages', {
      method: 'POST',
      body: JSON.stringify({ title: '新页面', slug: 'new-page', summary: '' })
    });
    await loadPages();
    await openPage(json.page.id);
  }

  async function saveDraft() {
    if (!selected) return;
    await api(`/api/pages/${selected.id}/draft`, {
      method: 'POST',
      body: JSON.stringify({ ...selected, content })
    });
    setMessage('草稿已保存');
    await loadPages();
  }

  async function publish() {
    if (!selected) return;
    await api(`/api/pages/${selected.id}/publish`, {
      method: 'POST',
      body: JSON.stringify({ ...selected, content })
    });
    setMessage('已发布，前台缓存已刷新');
    await loadPages();
  }

  async function updatePreview(next: string) {
    setContent(next);
    const json = await api('/api/markdown/preview', {
      method: 'POST',
      body: JSON.stringify({ markdown: next })
    });
    setPreview(json.html);
  }

  useEffect(() => { loadPages().catch(console.error); }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">页面</h2>
          <button onClick={createPage} className="inline-flex items-center gap-1 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white"><Plus size={14} />新建</button>
        </div>
        <div className="space-y-2">
          {pages.map((p) => (
            <button key={p.id} onClick={() => openPage(p.id)} className="w-full rounded-xl border border-[var(--border)] p-3 text-left hover:border-[var(--primary)]">
              <div className="text-sm font-medium">{p.title}</div>
              <div className="mt-1 truncate text-xs text-[var(--muted)]">/docs/{p.slug}</div>
              <div className="mt-2 text-xs text-[var(--muted)]">{p.status}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        {!selected ? <Empty label="选择或创建一个页面" /> : (
          <div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm">标题
                <input value={selected.title} onChange={(e) => setSelected({ ...selected, title: e.target.value })} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2" />
              </label>
              <label className="block text-sm">Slug
                <input value={selected.slug} onChange={(e) => setSelected({ ...selected, slug: e.target.value })} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2" />
              </label>
            </div>
            <label className="mt-3 block text-sm">摘要
              <input value={selected.summary || ''} onChange={(e) => setSelected({ ...selected, summary: e.target.value })} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2" />
            </label>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                <CodeMirror value={content} height="620px" extensions={[markdown()]} onChange={updatePreview} basicSetup={{ lineNumbers: true }} />
              </div>
              <div className="max-h-[620px] overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg)] p-5">
                <article className="markdown-body" dangerouslySetInnerHTML={{ __html: preview || '<p class="text-sm opacity-60">预览会显示在这里</p>' }} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button onClick={saveDraft} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm"><Save size={16} />保存草稿</button>
              <button onClick={publish} className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"><Send size={16} />发布</button>
              <span className="text-sm text-[var(--muted)]">{message}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NavigationPanel() {
  const [tree, setTree] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [jsonMode, setJsonMode] = useState('');

  const reload = () => api('/api/navigation').then((json) => { setTree(json.tree || []); setJsonMode(JSON.stringify(json.tree || [], null, 2)); });
  useEffect(() => { reload().catch(console.error); }, []);

  const updateNode = (id: string, updater: (n: any) => any, nodes = tree): any[] => nodes.map((n) => n.id === id ? updater(n) : (n.children ? { ...n, children: updateNode(id, updater, n.children) } : n));
  const deleteNode = (id: string, nodes = tree): any[] => nodes.filter((n) => n.id !== id).map((n) => n.children ? { ...n, children: deleteNode(id, n.children) } : n);

  const save = async () => { await api('/api/navigation', { method: 'PUT', body: JSON.stringify({ tree }) }); setMessage('导航树已保存'); setJsonMode(JSON.stringify(tree, null, 2)); };
  const addRoot = (type: 'section'|'page'|'external') => setTree([...tree, { id: `node-${Date.now()}`, type, title: '新节点', expanded: true, children: type === 'section' ? [] : undefined, slug: type === 'page' ? 'new-page' : undefined, href: type === 'external' ? 'https://' : undefined }]);

  function Node({ node, parent }: { node: any; parent?: any[] }) {
    const list = parent || tree; const idx = list.findIndex((x) => x.id === node.id);
    const move = (dir: number) => { const copy = [...list]; const ni = idx + dir; if (ni < 0 || ni >= copy.length) return; [copy[idx], copy[ni]] = [copy[ni], copy[idx]]; setTree(parent ? updateNode((parent as any)[0]?.__root || '___', (n:any)=>n) : copy); if (parent) setTree((t)=>{const rec=(nodes:any[]):any[]=>nodes.map(n=>n.children===parent?{...n,children:copy}:({...n,children:n.children?rec(n.children):n.children})); return rec(t);}); };
    return <li className="rounded-lg border border-[var(--border)] p-2 text-sm">
      <div className="flex items-center justify-between gap-2"><span>{node.type==='section'?'📁':node.type==='external'?'🔗':'📄'} {node.title}</span>
      <div className="flex gap-1">
        <button onClick={() => setEditing(node)} className="px-2">编辑</button>
        {node.type==='section' && <button onClick={() => setTree(updateNode(node.id, (n:any)=>({ ...n, children:[...(n.children||[]), { id:`node-${Date.now()}`, type:'page', title:'新页面', slug:'new-page' }] })))} className="px-2">添加子项</button>}
        <button onClick={() => move(-1)} className="px-2">上移</button><button onClick={() => move(1)} className="px-2">下移</button>
        <button onClick={() => confirm('确认删除?') && setTree(deleteNode(node.id))} className="px-2 text-red-500">删除</button>
      </div></div>
      {node.type==='section' && node.children?.length ? <ul className="ml-4 mt-2 space-y-2">{node.children.map((c:any)=><Node key={c.id} node={c} parent={node.children} />)}</ul> : null}
    </li>;
  }

  return <Panel title="导航树管理" desc="管理前台左侧 Wiki 导航，支持分组、页面链接、外部链接、拖拽排序和 JSON 导入导出。">
    <div className="mb-3 flex flex-wrap gap-2">
      <button onClick={() => addRoot('section')} className="rounded-xl border px-3 py-2 text-sm">新增分组</button>
      <button onClick={() => addRoot('page')} className="rounded-xl border px-3 py-2 text-sm">新增页面链接</button>
      <button onClick={() => addRoot('external')} className="rounded-xl border px-3 py-2 text-sm">新增外部链接</button>
      <button onClick={save} className="rounded-xl bg-[var(--primary)] px-3 py-2 text-sm text-white">保存</button>
      <button onClick={async()=>{const j=await api('/api/navigation/reset',{method:'POST'});setTree(j.tree);setJsonMode(JSON.stringify(j.tree,null,2));}} className="rounded-xl border px-3 py-2 text-sm">重置为 emby.wiki 默认结构</button>
    </div>
    <ul className="space-y-2">{tree.map((n:any)=><Node key={n.id} node={n} />)}</ul>
    {editing && <div className="mt-4 rounded-xl border p-3 text-sm">
      <div className="grid gap-2 md:grid-cols-2"><input value={editing.title||''} onChange={e=>setEditing({...editing,title:e.target.value})} className="rounded border px-2 py-1" />
      <select value={editing.type} onChange={e=>setEditing({...editing,type:e.target.value})} className="rounded border px-2 py-1"><option value="section">section</option><option value="page">page</option><option value="external">external</option></select>
      {editing.type==='page' && <input value={editing.slug||''} onChange={e=>setEditing({...editing,slug:e.target.value})} className="rounded border px-2 py-1" />}
      {editing.type==='external' && <input value={editing.href||''} onChange={e=>setEditing({...editing,href:e.target.value})} className="rounded border px-2 py-1" />}
      <input value={editing.icon||''} onChange={e=>setEditing({...editing,icon:e.target.value})} className="rounded border px-2 py-1" />
      <label><input type="checkbox" checked={!!editing.expanded} onChange={e=>setEditing({...editing,expanded:e.target.checked})}/> expanded</label>
      <label><input type="checkbox" checked={!!editing.hidden} onChange={e=>setEditing({...editing,hidden:e.target.checked})}/> hidden</label></div>
      <button className="mt-2 rounded border px-3 py-1" onClick={()=>{setTree(updateNode(editing.id,()=>editing));setEditing(null);}}>应用编辑</button>
    </div>}
    <details className="mt-4"><summary>高级 JSON 模式</summary><textarea value={jsonMode} onChange={(e)=>setJsonMode(e.target.value)} className="mt-2 h-56 w-full rounded-xl border p-2 font-mono text-xs" />
    <button className="mt-2 rounded border px-3 py-1" onClick={()=>{try{const parsed=JSON.parse(jsonMode);setTree(parsed);setMessage('JSON 已应用');}catch(e:any){setMessage(`JSON 错误: ${e.message}`);}}}>应用 JSON</button></details>
    <div className="mt-2 text-sm text-[var(--muted)]">{message}</div>
  </Panel>;
}

function AssetsPanel() {
  const [assets, setAssets] = useState<any[]>([]);
  const [message, setMessage] = useState('');

  async function load() {
    const json = await api('/api/assets');
    setAssets(json.assets || []);
  }

  async function upload(file: File) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/assets/upload', { method: 'POST', headers: authHeaders(), body: form });
    const json = await res.json() as { error?: string; markdown?: string };
    if (!res.ok) throw new Error(json.error || '上传失败');
    setMessage(`已上传：${json.markdown}`);
    await load();
  }

  useEffect(() => { load().catch(console.error); }, []);

  return (
    <Panel title="资源管理" desc="上传图片到 R2，并返回可插入 Markdown 的地址。">
      <label className="flex min-h-36 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-[var(--border)] p-6 text-sm text-[var(--muted)]">
        点击选择图片上传
        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0]).catch((err) => setMessage(err.message))} />
      </label>
      <p className="mt-3 text-sm text-[var(--muted)]">{message}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        {assets.map((asset) => (
          <div key={asset.id} className="rounded-xl border border-[var(--border)] p-3">
            <img src={asset.public_url} alt={asset.alt_text || asset.original_filename} className="h-32 w-full rounded-lg object-cover" />
            <div className="mt-2 truncate text-xs">{asset.original_filename}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SettingsPanel() {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    api('/api/settings').then((json) => setSettings(json.settings || {})).catch(console.error);
  }, []);

  async function save() {
    await api('/api/settings', { method: 'PUT', body: JSON.stringify({ settings }) });
    setMessage('设置已保存');
  }

  const keys = useMemo(() => Object.keys(settings).sort(), [settings]);

  return (
    <Panel title="站点设置" desc="网站标题、Logo、SEO、主题色等公开设置。">
      <div className="grid gap-3 md:grid-cols-2">
        {keys.map((key) => (
          <label key={key} className="block text-sm">
            {key}
            <input value={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2" />
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white">保存设置</button>
        <span className="text-sm text-[var(--muted)]">{message}</span>
      </div>
    </Panel>
  );
}

function Panel({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {desc && <p className="mt-1 text-sm text-[var(--muted)]">{desc}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--muted)]">{label}</div>;
}

import React, { useEffect, useState } from 'react';
import { FileText, Image, Settings, LogOut, AlertCircle, CheckCircle2 } from 'lucide-react';
import PagesPanel from './admin/PagesPanel';
import NavigationPanel from './admin/NavigationPanel';
import AssetsPanel from './admin/AssetsPanel';
import SettingsPanel from './admin/SettingsPanel';
import ImportPanel from './admin/ImportPanel';

type Toast = { id: number; type: 'success' | 'error'; message: string };

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (type: Toast['type'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((s) => [...s, { id, type, message }]);
    setTimeout(() => setToasts((s) => s.filter((t) => t.id !== id)), 3000);
  };
  return { toasts, push };
}

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

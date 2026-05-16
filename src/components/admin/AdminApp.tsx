import React, { useEffect, useState } from 'react';
import { FileText, Image, Settings, LogOut, LayoutPanelTop, ShieldCheck, UploadCloud } from 'lucide-react';
import PagesPanel from './admin/PagesPanel';
import NavigationPanel from './admin/NavigationPanel';
import AssetsPanel from './admin/AssetsPanel';
import SettingsPanel from './admin/SettingsPanel';
import ImportPanel from './admin/ImportPanel';
import DashboardPanel from './admin/DashboardPanel';
import VersionsPanel from './admin/VersionsPanel';
import AuditLogsPanel from './admin/AuditLogsPanel';
import ToastView from './admin/ToastView';
import { api } from './admin/api';

type Toast = { id: number; type: 'success' | 'error'; message: string };
type TabId = 'dashboard' | 'pages' | 'navigation' | 'assets' | 'settings' | 'versions' | 'auditLogs' | 'import';

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
  const [tab, setTab] = useState<TabId>('dashboard');
  const { toasts, push } = useToasts();

  useEffect(() => {
    if (!localStorage.getItem('wiki_token')) {
      location.href = '/admin/login';
      return;
    }
    api('/api/settings').catch(() => {});
  }, []);

  const tabs: Array<{ id: TabId; label: string; icon: any }> = [
    { id: 'dashboard', label: '总览', icon: LayoutPanelTop },
    { id: 'pages', label: '页面', icon: FileText },
    { id: 'navigation', label: '导航树', icon: FileText },
    { id: 'assets', label: '资源', icon: Image },
    { id: 'settings', label: '站点设置', icon: Settings },
    { id: 'versions', label: '版本管理', icon: FileText },
    { id: 'auditLogs', label: '审计日志', icon: ShieldCheck },
    { id: 'import', label: 'Wiki.js 导入', icon: UploadCloud }
  ];

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
            return <button key={item.id} onClick={() => setTab(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm ${tab === item.id ? 'bg-[var(--primary-soft)] text-[var(--primary)]' : 'text-[var(--muted)] hover:bg-[var(--bg-soft)]'}`}><Icon size={16} />{item.label}</button>;
          })}
        </nav>
        <button onClick={() => { localStorage.removeItem('wiki_token'); location.href = '/admin/login'; }} className="absolute bottom-4 left-4 right-4 flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)]"><LogOut size={16} /> 退出登录</button>
      </aside>

      <section className="md:pl-64">
        <div className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4"><h1 className="text-xl font-semibold">后台管理</h1></div>
        <div className="p-4 md:p-6">
          {tab === 'dashboard' && <DashboardPanel />}
          {tab === 'pages' && <PagesPanel push={push} />}
          {tab === 'navigation' && <NavigationPanel push={push} />}
          {tab === 'assets' && <AssetsPanel push={push} />}
          {tab === 'settings' && <SettingsPanel push={push} />}
          {tab === 'versions' && <VersionsPanel />}
          {tab === 'auditLogs' && <AuditLogsPanel />}
          {tab === 'import' && <ImportPanel push={push} />}
        </div>
      </section>

      <ToastView toasts={toasts} />
    </main>
  );
}

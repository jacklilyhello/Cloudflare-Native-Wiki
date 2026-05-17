import React, { useEffect, useState } from 'react';
import { api } from './api';
import LoadingButton from './LoadingButton';
import type { ToastPush } from './types';

const FIELDS = ['site_title','site_subtitle','site_description','site_url','logo_url','favicon_url','homepage_slug','default_locale','navigation_mode','show_toc','show_last_updated','enable_search','footer_text','custom_head_html'];

export default function SettingsPanel({ push }: { push: ToastPush }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  useEffect(() => { api('/api/settings').then((d) => {
    const base: Record<string,string> = {};
    for (const f of FIELDS) base[f] = d.settings?.[f] ?? '';
    setSettings(base);
  }).catch((e) => push('error', e.message)); }, []);
  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-lg font-semibold">站点设置</h2><div className="mt-5 grid gap-3 md:grid-cols-2">{FIELDS.map((key) => <label key={key} className="block text-sm">{key}<input value={settings[key] ?? ''} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2" /></label>)}</div><div className="mt-4"><LoadingButton loading={loading} onClick={async () => { try { setLoading(true); await api('/api/settings', { method: 'PUT', body: JSON.stringify({ settings }) }); push('success', '设置已保存'); } catch (e: any) { push('error', `设置保存失败: ${e.message}`); } finally { setLoading(false); } }} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white">保存设置</LoadingButton></div></section>;
}

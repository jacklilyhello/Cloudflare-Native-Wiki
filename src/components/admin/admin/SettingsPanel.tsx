import React, { useEffect, useMemo, useState } from 'react';
import { api, Empty, LoadingButton, NetworkError, Panel } from './shared';
import type { PushToast } from './shared';

type SettingsMap = Record<string, string>;
export default function SettingsPanel({ push }: { push: PushToast }) { const [settings, setSettings] = useState<SettingsMap>({}); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  useEffect(() => { api('/api/settings').then((d: any) => { setSettings(d.settings || {}); push('success','设置加载成功');}).catch((e: any) => {setError(e.message); push('error', e.message);}); }, []);
  const keys = useMemo(() => Object.keys(settings).sort(), [settings]);
  return <Panel title='站点设置'>{error && <NetworkError message={error} />} {!keys.length && !error ? <Empty label='暂无设置项' /> : <><div className='grid gap-3 md:grid-cols-2'>{keys.map((key) => <label key={key} className='block text-sm'>{key}<input value={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} className='mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2' /></label>)}</div><div className='mt-4'><LoadingButton loading={loading} onClick={async () => { if (loading) return; try { setLoading(true); await api('/api/settings', { method: 'PUT', body: JSON.stringify({ settings }) }); push('success', '设置已保存'); } catch (e: any) { push('error', `设置保存失败: ${e.message}`); } finally { setLoading(false); } }} className='rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white'>保存设置</LoadingButton></div></>}</Panel>; }

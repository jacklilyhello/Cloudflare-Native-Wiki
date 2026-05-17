import React, { useEffect, useState } from 'react';
import { api } from './api';

export default function DashboardPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try { setData(await api('/api/admin/dashboard')); }
    catch (e: any) { setError(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  if (loading) return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">加载中...</section>;
  if (error) return <section className="rounded-2xl border border-rose-300 bg-rose-50 p-6 text-sm text-rose-700"><div className="font-semibold">总览加载失败</div><div>status: {error?.status || 500}</div><div>code: {error?.code || 'REQUEST_FAILED'}</div><div>message: {error?.message}</div><div>details: {JSON.stringify(error?.details || {})}</div><button onClick={load} className="mt-3 rounded border px-2 py-1">重试</button></section>;
  const c = data?.counts || {};
  return <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"><h2 className="text-lg font-semibold">总览</h2><div className="grid gap-3 md:grid-cols-4">{[['页面总数',c.total_pages],['已发布',c.published_pages],['草稿',c.draft_pages],['已删除',c.deleted_pages],['资源',c.asset_count],['导航节点',c.navigation_count]].map(([k,v])=><div key={String(k)} className="rounded-xl border p-3"><div className="text-xs text-[var(--muted)]">{k}</div><div className="text-xl font-semibold">{v ?? 0}</div></div>)}</div><div className="rounded-xl border p-3 text-sm">诊断：bad slugs={data?.diagnostics?.bad_slugs || 0} / missing latest={data?.diagnostics?.missing_latest || 0}</div><div className="rounded-xl border p-3 text-xs">build: {data?.build?.commit || 'unknown'} / {data?.build?.branch || 'unknown'} / {data?.build?.url || 'unknown'}</div>{(data?.warnings || []).length > 0 && <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">{data.warnings.map((w: string, i: number) => <div key={i}>⚠️ {w}</div>)}</div>}</section>;
}

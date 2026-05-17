import React, { useEffect, useState } from 'react';
import { api } from './api';

export default function DashboardPanel() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api('/api/admin/dashboard').then(setData).catch(() => null); }, []);
  if (!data) return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">加载中...</section>;
  const c = data.counts || {};
  return <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"><h2 className="text-lg font-semibold">总览</h2><div className="grid gap-3 md:grid-cols-4">{[['页面总数',c.total_pages],['已发布',c.published_pages],['草稿',c.draft_pages],['已删除',c.deleted_pages],['资源',c.asset_count],['导航节点',c.navigation_count]].map(([k,v])=><div key={String(k)} className="rounded-xl border p-3"><div className="text-xs text-[var(--muted)]">{k}</div><div className="text-xl font-semibold">{v ?? 0}</div></div>)}</div><div className="rounded-xl border p-3 text-sm">诊断：bad slugs={data.diagnostics?.bad_slugs || 0} / missing latest={data.diagnostics?.missing_latest || 0}</div></section>;
}

import React, { useEffect, useState } from 'react';
import { api } from './api';

export default function VersionsPanel() {
  const [pages, setPages] = useState<any[]>([]); const [pageId, setPageId] = useState(''); const [versions, setVersions] = useState<any[]>([]);
  useEffect(() => { api('/api/pages').then((d) => setPages(d.pages || [])).catch(() => null); }, []);
  useEffect(() => { if (pageId) api(`/api/pages/${pageId}/versions`).then((d) => setVersions(d.versions || [])); }, [pageId]);
  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"><h2 className="text-lg font-semibold">版本管理</h2><select className="mt-3 rounded border px-3 py-2" value={pageId} onChange={(e)=>setPageId(e.target.value)}><option value="">选择页面</option>{pages.map((p)=><option key={p.id} value={p.id}>{p.title}</option>)}</select><div className="mt-3 space-y-2">{versions.map((v)=><div key={v.id} className="rounded border p-2 text-sm flex items-center justify-between"><span>#{v.version_number} {v.status} {v.created_at}</span><button className="rounded border px-2 py-1" onClick={async()=>{await api(`/api/pages/${pageId}/versions/${v.id}/restore`,{method:'POST'}); const d=await api(`/api/pages/${pageId}/versions`); setVersions(d.versions||[]);}}>回滚到此版本</button></div>)}</div></section>;
}

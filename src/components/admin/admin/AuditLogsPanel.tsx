import React, { useEffect, useState } from 'react';
import { api } from './api';

export default function AuditLogsPanel() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api('/api/admin/audit-logs?page=1&pageSize=50').then((d) => setRows(d.items || [])).catch(() => null); }, []);
  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"><h2 className="text-lg font-semibold">审计日志</h2><div className="mt-3 overflow-auto"><table className="min-w-full text-sm"><thead><tr><th>时间</th><th>操作</th><th>操作者</th><th>对象</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i} className="border-t"><td>{r.time}</td><td>{r.action}</td><td>{r.actor || '-'}</td><td>{r.target_type}:{r.target_id}</td></tr>)}</tbody></table></div></section>;
}

import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export type Toast = { id: number; type: 'success' | 'error'; message: string };
export type PushToast = (t: 'success' | 'error', m: string) => void;

export function authHeaders() { const token = localStorage.getItem('wiki_token'); return token ? { Authorization: `Bearer ${token}` } : undefined; }

export async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set('content-type', headers.get('content-type') || 'application/json');
  const token = localStorage.getItem('wiki_token');
  if (token) headers.set('authorization', `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (res.status === 401) {
    localStorage.removeItem('wiki_token');
    if (location.pathname !== '/admin/login') location.href = '/admin/login';
  }
  if (!res.ok || json?.ok === false) throw new Error(json?.error?.message || json?.error || `Request failed: ${res.status}`);
  return json.data ?? json;
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push: PushToast = (type, message) => {
    const id = Date.now() + Math.random();
    setToasts((s) => [...s, { id, type, message }]);
    setTimeout(() => setToasts((s) => s.filter((t) => t.id !== id)), 3000);
  };
  return { toasts, push };
}

export const LoadingButton = ({ loading, children, ...props }: any) => (
  <button disabled={loading || props.disabled} {...props} className={`${props.className} disabled:cursor-not-allowed disabled:opacity-50`}>
    {loading && <Loader2 size={15} className="mr-2 inline animate-spin" />}
    {children}
  </button>
);

export function Panel({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-lg font-semibold">{title}</h2>{desc && <p className="mt-1 text-sm text-[var(--muted)]">{desc}</p>}<div className="mt-5">{children}</div></section>; }
export function Empty({ label }: { label: string }) { return <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--muted)]">{label}</div>; }

export const ToastView = ({ toasts }: { toasts: Toast[] }) => <div className="fixed right-4 top-4 z-50 space-y-2">{toasts.map((t) => <div key={t.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white shadow ${t.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>{t.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}{t.message}</div>)}</div>;

export function NetworkError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">网络异常：{message}{onRetry && <button className="ml-3 underline" onClick={onRetry}>重试</button>}</div>;
}

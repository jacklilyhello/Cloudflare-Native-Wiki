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
  const isApiError = json?.success === false || json?.ok === false;
  if (!res.ok || isApiError) {
    const message = json?.error?.message || json?.error || 'Request failed';
    const err = new Error(message) as Error & { status?: number; code?: string; details?: unknown };
    err.status = res.status;
    err.code = json?.error?.code || 'REQUEST_FAILED';
    err.details = json?.error?.details;
    throw err;
  }
  return json.data ?? json;
}

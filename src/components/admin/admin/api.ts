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

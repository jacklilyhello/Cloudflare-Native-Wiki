export function createId(prefix: string) {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const value = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${value}`;
}

export async function sha256(input: string | ArrayBuffer) {
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

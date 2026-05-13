export function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers || {})
    }
  });
}

export function error(message: string, status = 400) {
  return json({ error: message }, { status });
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new Error('Invalid JSON body');
  }
}

export function noStoreHeaders() {
  return {
    'cache-control': 'no-store, max-age=0'
  };
}

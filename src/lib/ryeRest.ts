export function ryeRestFetch(path: string, init: RequestInit = {}) {
  const base = process.env.RYE_API_BASE!;
  const key = process.env.RYE_SELL_ANYTHING_API_KEY!;

  if (!base || !key) {
    throw new Error('Missing RYE_API_BASE or RYE_SELL_ANYTHING_API_KEY');
  }

  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}
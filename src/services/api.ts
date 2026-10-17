export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-requested-with': 'projecttrack' }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch { throw new ApiError(0, 'Cannot reach the server. Start it with "npm run dev:api".'); }
  if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('pt:unauthorized'));
  const text = await res.text(); let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON: proxy error page */ }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? (res.status >= 500 ? 'The API is not responding. Check that "npm run dev:api" is running and the database is reachable.' : `Request failed (${res.status}).`));
  return data as T;
}
export const api = {
  get: <T,>(p: string) => request<T>('GET', p),
  post: <T,>(p: string, b?: unknown) => request<T>('POST', p, b ?? {}),
  patch: <T,>(p: string, b: unknown) => request<T>('PATCH', p, b),
  del: <T,>(p: string) => request<T>('DELETE', p),
};
export const qs = (o: Record<string, string | number | undefined | null>) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v)); const s = p.toString(); return s ? `?${s}` : ''; };

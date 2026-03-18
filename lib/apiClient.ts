import { getSupabaseBrowserClient } from './supabaseBrowser';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

const buildHeaders = async (headers?: HeadersInit): Promise<Headers> => {
  const merged = new Headers(headers || {});
  if (!merged.has('Content-Type')) {
    merged.set('Content-Type', 'application/json');
  }

  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    let session = data.session;
    const isExpired =
      typeof session?.expires_at === 'number' && session.expires_at * 1000 <= Date.now() + 10_000;

    if (!session?.access_token || isExpired) {
      const refreshResult = await supabase.auth.refreshSession();
      session = refreshResult.data.session || session;
    }

    const accessToken = session?.access_token;
    if (accessToken) {
      merged.set('Authorization', `Bearer ${accessToken}`);
    }
  }

  return merged;
};

export const apiRequest = async <T>(url: string, init: RequestInit = {}): Promise<T> => {
  const headers = await buildHeaders(init.headers);
  const response = await fetch(url, { ...init, headers });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload && 'error' in payload
        ? String((payload as { error: string }).error)
        : response.statusText || 'Request failed';
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
};

import { getSupabaseBrowserClient } from './supabaseBrowser';
import { clearSessionTokenCookie, setSessionTokenCookie } from './sessionTokenCookie';

const normalizeBaseUrl = (value?: string): string => {
  if (!value) return '';
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const DASHBOARD_ROUTE_PREFIXES = [
  '/api/dashboard/',
  '/api/reports/',
  '/api/ai/',
  '/api/cron/',
  '/api/leads/bulk-actions',
  '/api/service-jobs/bulk-actions',
  '/api/customers/',
];

export const resolveApiUrl = (url: string): string => {
  if (!url || /^https?:\/\//i.test(url)) return url;

  const publicBaseUrl = normalizeBaseUrl(import.meta.env.VITE_PUBLIC_API_BASE_URL as string | undefined);
  const dashboardBaseUrl = normalizeBaseUrl(
    import.meta.env.VITE_DASHBOARD_API_BASE_URL as string | undefined
  );

  if (dashboardBaseUrl && DASHBOARD_ROUTE_PREFIXES.some((prefix) => url.startsWith(prefix))) {
    return `${dashboardBaseUrl}${url}`;
  }

  if (publicBaseUrl && url.startsWith('/api/')) {
    return `${publicBaseUrl}${url}`;
  }

  return url;
};

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
      setSessionTokenCookie(accessToken, session?.expires_at);
      merged.set('Authorization', `Bearer ${accessToken}`);
      merged.set('X-Supabase-Access-Token', accessToken);
    } else {
      clearSessionTokenCookie();
    }
  }

  return merged;
};

export const apiRequest = async <T>(url: string, init: RequestInit = {}): Promise<T> => {
  const headers = await buildHeaders(init.headers);
  const response = await fetch(resolveApiUrl(url), { ...init, headers });

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

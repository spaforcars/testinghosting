import type { VercelRequest, VercelResponse } from '@vercel/node';

export const methodNotAllowed = (res: VercelResponse) =>
  res.status(405).json({ error: 'Method not allowed' });

export const unauthorized = (res: VercelResponse) =>
  res.status(401).json({ error: 'Unauthorized' });

export const forbidden = (res: VercelResponse) =>
  res.status(403).json({ error: 'Forbidden' });

export const badRequest = (res: VercelResponse, error: string) =>
  res.status(400).json({ error });

export const readRouteId = (req: VercelRequest, trailingSegments = 0) => {
  const queryId = req.query?.id;
  if (typeof queryId === 'string' && queryId.trim()) return queryId.trim();
  if (Array.isArray(queryId) && typeof queryId[0] === 'string' && queryId[0].trim()) {
    return queryId[0].trim();
  }

  const path = typeof req.url === 'string' ? req.url.split('?')[0] : '';
  const segments = path.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  const routeIndex = segments.length - 1 - trailingSegments;
  return routeIndex >= 0 ? segments[routeIndex] : '';
};

export const readQueryParam = (req: VercelRequest, key: string) => {
  const value = req.query?.[key];
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
    return value[0].trim();
  }

  const rawQuery = typeof req.url === 'string' ? req.url.split('?')[1] || '' : '';
  return new URLSearchParams(rawQuery).get(key)?.trim() || '';
};

export const serverError = (res: VercelResponse, error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown server error';
  return res.status(500).json({ error: message });
};

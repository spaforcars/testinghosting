import type { VercelRequest } from '@vercel/node';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const readForwardedProto = (req: VercelRequest): string => {
  const header = req.headers['x-forwarded-proto'];
  if (typeof header === 'string' && header.trim()) return header.split(',')[0].trim();
  if (Array.isArray(header) && typeof header[0] === 'string' && header[0].trim()) {
    return header[0].trim();
  }
  return 'https';
};

const readForwardedHost = (req: VercelRequest): string => {
  const header = req.headers['x-forwarded-host'];
  if (typeof header === 'string' && header.trim()) return header.split(',')[0].trim();
  if (Array.isArray(header) && typeof header[0] === 'string' && header[0].trim()) {
    return header[0].trim();
  }

  const host = req.headers.host;
  if (typeof host === 'string' && host.trim()) return host.trim();
  if (Array.isArray(host) && typeof host[0] === 'string' && host[0].trim()) return host[0].trim();
  return '';
};

export const getAppBaseUrl = (req?: VercelRequest): string => {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return trimTrailingSlash(configured);

  if (req) {
    const host = readForwardedHost(req);
    if (host) {
      return `${readForwardedProto(req)}://${host}`;
    }
  }

  return 'http://localhost:3001';
};

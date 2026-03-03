import type { VercelResponse } from '@vercel/node';

export const methodNotAllowed = (res: VercelResponse) =>
  res.status(405).json({ error: 'Method not allowed' });

export const unauthorized = (res: VercelResponse) =>
  res.status(401).json({ error: 'Unauthorized' });

export const forbidden = (res: VercelResponse) =>
  res.status(403).json({ error: 'Forbidden' });

export const badRequest = (res: VercelResponse, error: string) =>
  res.status(400).json({ error });

export const serverError = (res: VercelResponse, error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown server error';
  return res.status(500).json({ error: message });
};

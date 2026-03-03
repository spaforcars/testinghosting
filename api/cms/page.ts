import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCmsPageData, getPromoPlacements } from '../_lib/cms';
import { badRequest, methodNotAllowed, serverError } from '../_lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res);
  }

  try {
    const slug = String(req.query.slug || '').trim();
    if (!slug) return badRequest(res, 'Missing slug query parameter');

    const data = await getCmsPageData(slug);
    const promos = await getPromoPlacements(slug);

    return res.status(200).json({
      data: data || null,
      promos,
    });
  } catch (error) {
    console.error('CMS page route failed:', error);
    return serverError(res, error);
  }
}

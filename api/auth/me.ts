import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext } from '../_lib/auth';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { methodNotAllowed, serverError, unauthorized } from '../_lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res);
  }

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);

    return res.status(200).json({
      userId: auth.userId,
      email: auth.email,
      role: auth.role,
      permissions: Array.from(auth.permissions),
    });
  } catch (error) {
    return serverError(res, error);
  }
}

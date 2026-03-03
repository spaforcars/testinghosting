import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../_lib/auth';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { forbidden, methodNotAllowed, serverError, unauthorized } from '../_lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);
    if (!hasPermission(auth, 'notifications', 'read')) return forbidden(res);

    let query = supabase
      .from('notification_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (req.query.status) {
      query = query.eq('status', String(req.query.status));
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return res.status(200).json({ events: data || [] });
  } catch (error) {
    return serverError(res, error);
  }
}

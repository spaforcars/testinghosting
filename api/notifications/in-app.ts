import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../_lib/auth';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { forbidden, methodNotAllowed, serverError, unauthorized } from '../_lib/http';
import { isFeatureEnabled } from '../_lib/featureFlags';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);
    if (!hasPermission(auth, 'notifications', 'read')) return forbidden(res);

    const opsEnabled = await isFeatureEnabled(supabase, 'ops_v1_enabled', true);
    if (!opsEnabled) return forbidden(res);

    const rawLimit = Number(req.query.limit || 100);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 300) : 100;

    let query = supabase
      .from('in_app_notifications')
      .select('*')
      .eq('recipient_user_id', auth.userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (req.query.unreadOnly === 'true') {
      query = query.is('read_at', null);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return res.status(200).json({ notifications: data || [] });
  } catch (error) {
    return serverError(res, error);
  }
}

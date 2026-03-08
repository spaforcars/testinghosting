import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../../../_lib/auth';
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin';
import { badRequest, forbidden, methodNotAllowed, serverError, unauthorized } from '../../../_lib/http';
import { isFeatureEnabled } from '../../../_lib/featureFlags';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') return methodNotAllowed(res);

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);
    if (!hasPermission(auth, 'notifications', 'read')) return forbidden(res);

    const opsEnabled = await isFeatureEnabled(supabase, 'ops_v1_enabled', true);
    if (!opsEnabled) return forbidden(res);

    const id = String(req.query.id || '');
    if (!id) return badRequest(res, 'notification id is required');

    const { data: notification, error: fetchError } = await supabase
      .from('in_app_notifications')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!notification) return badRequest(res, 'Notification not found');

    const canWriteAny = hasPermission(auth, 'notifications', 'write');
    if (!canWriteAny && notification.recipient_user_id !== auth.userId) {
      return forbidden(res);
    }

    const { data, error } = await supabase
      .from('in_app_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    return res.status(200).json({ notification: data });
  } catch (error) {
    return serverError(res, error);
  }
}

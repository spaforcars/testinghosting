import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../_lib/auth';
import { isFeatureEnabled } from '../_lib/featureFlags';
import { forbidden, methodNotAllowed, serverError, unauthorized } from '../_lib/http';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);
    if (!hasPermission(auth, 'dashboard', 'read')) return forbidden(res);

    const opsEnabled = await isFeatureEnabled(supabase, 'ops_v1_enabled', true);
    if (!opsEnabled) return forbidden(res);

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, full_name, role, is_active')
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    if (error) throw new Error(error.message);

    return res.status(200).json({
      operators: (data || []).map((operator) => ({
        id: operator.id,
        label: operator.full_name || operator.id,
        role: operator.role,
      })),
    });
  } catch (error) {
    return serverError(res, error);
  }
}

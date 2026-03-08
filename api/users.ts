import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from './_lib/auth';
import { getSupabaseAdmin } from './_lib/supabaseAdmin';
import { forbidden, methodNotAllowed, serverError, unauthorized } from './_lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);

    const canRead =
      hasPermission(auth, 'leads', 'write') ||
      hasPermission(auth, 'services', 'write') ||
      hasPermission(auth, 'clients', 'write') ||
      hasPermission(auth, 'users', 'read');

    if (!canRead) return forbidden(res);

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, full_name, role, is_active')
      .eq('is_active', true)
      .in('role', ['super_admin', 'admin', 'staff'])
      .order('full_name', { ascending: true });

    if (error) throw new Error(error.message);

    return res.status(200).json({ users: data || [] });
  } catch (error) {
    return serverError(res, error);
  }
}

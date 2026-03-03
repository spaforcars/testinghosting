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
    if (!hasPermission(auth, 'dashboard', 'read')) return forbidden(res);

    const [
      leadsCountResult,
      queuedLeadsCountResult,
      inServiceCountResult,
      completedCountResult,
      enquiriesTodayResult,
    ] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'lead'),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'in_service'),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase
        .from('enquiries')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    ]);

    return res.status(200).json({
      totalLeads: leadsCountResult.count || 0,
      newLeads: queuedLeadsCountResult.count || 0,
      inService: inServiceCountResult.count || 0,
      completed: completedCountResult.count || 0,
      enquiriesToday: enquiriesTodayResult.count || 0,
    });
  } catch (error) {
    return serverError(res, error);
  }
}

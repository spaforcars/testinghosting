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
    if (!hasPermission(auth, 'dashboard', 'read')) return forbidden(res);

    const opsEnabled = await isFeatureEnabled(supabase, 'ops_v1_enabled', true);
    if (!opsEnabled) return forbidden(res);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const [
      leadsTodayResult,
      clientsTodayResult,
      jobsTodayResult,
      activeCustomersResult,
      unreadNotificationsResult,
    ] = await Promise.all([
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfToday.toISOString())
        .lt('created_at', endOfToday.toISOString()),
      supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfToday.toISOString())
        .lt('created_at', endOfToday.toISOString()),
      supabase
        .from('service_jobs')
        .select('id, client_id, estimated_amount, status, payment_status')
        .gte('scheduled_at', startOfToday.toISOString())
        .lt('scheduled_at', endOfToday.toISOString())
        .neq('status', 'cancelled'),
      supabase
        .from('service_jobs')
        .select('client_id')
        .in('status', ['booked', 'in_service'])
        .not('client_id', 'is', null),
      supabase
        .from('in_app_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_user_id', auth.userId)
        .is('read_at', null),
    ]);

    const expectedRevenueToday = (jobsTodayResult.data || []).reduce((sum, row) => {
      return sum + Number(row.estimated_amount || 0);
    }, 0);

    const activeCustomers = new Set(
      (activeCustomersResult.data || []).map((row) => row.client_id).filter(Boolean)
    ).size;

    return res.status(200).json({
      newLeadsToday: leadsTodayResult.count || 0,
      newCustomersToday: clientsTodayResult.count || 0,
      newCustomersOrLeadsToday: (leadsTodayResult.count || 0) + (clientsTodayResult.count || 0),
      jobsScheduledToday: jobsTodayResult.data?.length || 0,
      activeCustomers,
      expectedRevenueToday,
      unreadNotifications: unreadNotificationsResult.count || 0,
    });
  } catch (error) {
    return serverError(res, error);
  }
}

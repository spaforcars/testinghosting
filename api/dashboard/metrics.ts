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

    const [
      leadsCountResult,
      queuedLeadsCountResult,
      contactedCountResult,
      quotedCountResult,
      bookedCountResult,
      inServiceCountResult,
      completedCountResult,
      enquiriesTodayResult,
      serviceJobsTodayResult,
      billingOutstandingResult,
      unreadNotificationsResult,
    ] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'lead'),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'contacted'),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'quoted'),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'booked'),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'in_service'),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase
        .from('enquiries')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      supabase
        .from('service_jobs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      supabase
        .from('billing_records')
        .select('total_amount, amount_paid, status')
        .in('status', ['sent', 'partially_paid', 'overdue']),
      supabase
        .from('in_app_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_user_id', auth.userId)
        .is('read_at', null),
    ]);

    const billingOutstanding = (billingOutstandingResult.data || []).reduce((sum, row) => {
      return sum + Number(row.total_amount || 0) - Number(row.amount_paid || 0);
    }, 0);

    return res.status(200).json({
      totalLeads: leadsCountResult.count || 0,
      newLeads: queuedLeadsCountResult.count || 0,
      contactedLeads: contactedCountResult.count || 0,
      quotedLeads: quotedCountResult.count || 0,
      bookedLeads: bookedCountResult.count || 0,
      inService: inServiceCountResult.count || 0,
      completed: completedCountResult.count || 0,
      enquiriesToday: enquiriesTodayResult.count || 0,
      serviceJobsToday: serviceJobsTodayResult.count || 0,
      billingOutstanding,
      unreadNotifications: unreadNotificationsResult.count || 0,
    });
  } catch (error) {
    return serverError(res, error);
  }
}

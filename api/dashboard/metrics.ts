import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../_lib/auth';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { forbidden, methodNotAllowed, serverError, unauthorized } from '../_lib/http';
import { isFeatureEnabled } from '../_lib/featureFlags';
import { getCmsPageData } from '../_lib/cms';
import { getBookingSettings } from '../_lib/booking';
import { adaptServicesContent } from '../../lib/contentAdapter';
import { defaultServicesPageContent } from '../../lib/cmsDefaults';
import { estimateServiceAmount } from '../../lib/serviceCatalog';
import { getTimeZoneDateKey, localDateKeyToUtcRange } from '../../lib/timeZone';

const isMissingTableError = (message: string, table: string) =>
  message.includes(`Could not find the table 'public.${table}'`) ||
  new RegExp(`relation ["']?public\\.${table}["']? does not exist`, 'i').test(message);

const getJobEstimatedAmount = (
  row: Record<string, unknown>,
  servicesContent: ReturnType<typeof adaptServicesContent>
) =>
  Number(row.estimated_amount || 0) ||
  estimateServiceAmount(
    servicesContent,
    typeof row.service_catalog_id === 'string' ? row.service_catalog_id : null,
    Array.isArray(row.service_addon_ids)
      ? row.service_addon_ids.filter((item): item is string => typeof item === 'string')
      : null,
    typeof row.service_type === 'string' ? row.service_type : null
  ) ||
  0;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);
    if (!hasPermission(auth, 'dashboard', 'read')) return forbidden(res);

    const opsEnabled = await isFeatureEnabled(supabase, 'ops_v1_enabled', true);
    if (!opsEnabled) return forbidden(res);

    const bookingSettings = await getBookingSettings(supabase);
    const todayKey = getTimeZoneDateKey(new Date(), bookingSettings.timeZone);
    const { start: startOfToday, end: endOfToday } = localDateKeyToUtcRange(todayKey, bookingSettings.timeZone);

    const [
      servicesPage,
      leadsTodayResult,
      clientsTodayResult,
      jobsTodayResult,
      allJobsResult,
      activeCustomersResult,
      unreadNotificationsResult,
    ] = await Promise.all([
      getCmsPageData('services'),
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
        .select('*')
        .gte('scheduled_at', startOfToday.toISOString())
        .lt('scheduled_at', endOfToday.toISOString())
        .neq('status', 'cancelled'),
      supabase
        .from('service_jobs')
        .select('*')
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

    if (leadsTodayResult.error) throw new Error(leadsTodayResult.error.message);
    if (clientsTodayResult.error) throw new Error(clientsTodayResult.error.message);
    if (jobsTodayResult.error) throw new Error(jobsTodayResult.error.message);
    if (allJobsResult.error) throw new Error(allJobsResult.error.message);
    if (activeCustomersResult.error) throw new Error(activeCustomersResult.error.message);

    const unreadNotifications =
      unreadNotificationsResult.error && isMissingTableError(unreadNotificationsResult.error.message, 'in_app_notifications')
        ? 0
        : unreadNotificationsResult.error
          ? (() => {
              throw new Error(unreadNotificationsResult.error.message);
            })()
          : unreadNotificationsResult.count || 0;

    const servicesContent = adaptServicesContent(servicesPage || defaultServicesPageContent);

    const expectedRevenueToday = (jobsTodayResult.data || []).reduce(
      (sum, row) => sum + getJobEstimatedAmount(row, servicesContent),
      0
    );

    const expectedRevenueTotal = (allJobsResult.data || []).reduce(
      (sum, row) => sum + getJobEstimatedAmount(row, servicesContent),
      0
    );

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
      expectedRevenueTotal,
      unreadNotifications,
    });
  } catch (error) {
    return serverError(res, error);
  }
}

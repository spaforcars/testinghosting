import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../_lib/auth';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { forbidden, methodNotAllowed, serverError, unauthorized } from '../_lib/http';
import { isFeatureEnabled } from '../_lib/featureFlags';
import { getCmsPageData } from '../_lib/cms';
import { adaptServicesContent } from '../../lib/contentAdapter';
import { defaultServicesPageContent } from '../../lib/cmsDefaults';
import { estimateServiceAmount } from '../../lib/serviceCatalog';

const toIsoDate = (value: string | undefined, fallback: Date) => {
  if (!value) return fallback.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString();
};

const sumEstimatedAmount = (
  rows: Array<Record<string, unknown>>,
  servicesContent: ReturnType<typeof adaptServicesContent>
) =>
  rows.reduce(
    (sum, row) =>
      sum +
      (Number(row.estimated_amount || 0) ||
        estimateServiceAmount(
          servicesContent,
          typeof row.service_catalog_id === 'string' ? row.service_catalog_id : null,
          Array.isArray(row.service_addon_ids)
            ? row.service_addon_ids.filter((item): item is string => typeof item === 'string')
            : null,
          typeof row.service_type === 'string' ? row.service_type : null
        ) ||
        0),
    0
  );

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);
    if (!hasPermission(auth, 'reports', 'read')) return forbidden(res);

    const reportsEnabled = await isFeatureEnabled(supabase, 'ops_reports_enabled', true);
    if (!reportsEnabled) return forbidden(res);

    const now = new Date();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const fromIso = toIsoDate(String(req.query.dateFrom || ''), thirtyDaysAgo);
    const toIso = toIsoDate(String(req.query.dateTo || ''), now);
    const servicesContent = adaptServicesContent((await getCmsPageData('services')) || defaultServicesPageContent);

    const [
      serviceJobsResult,
      weeklyCompletedJobsResult,
      monthlyCompletedJobsResult,
    ] = await Promise.all([
      supabase
        .from('service_jobs')
        .select('*')
        .gte('created_at', fromIso)
        .lte('created_at', toIso),
      supabase
        .from('service_jobs')
        .select('*')
        .eq('status', 'completed')
        .gte('completed_at', sevenDaysAgo.toISOString())
        .lte('completed_at', now.toISOString()),
      supabase
        .from('service_jobs')
        .select('*')
        .eq('status', 'completed')
        .gte('completed_at', monthStart.toISOString())
        .lte('completed_at', now.toISOString()),
    ]);

    if (serviceJobsResult.error) throw new Error(serviceJobsResult.error.message);
    if (weeklyCompletedJobsResult.error) throw new Error(weeklyCompletedJobsResult.error.message);
    if (monthlyCompletedJobsResult.error) throw new Error(monthlyCompletedJobsResult.error.message);

    const serviceJobs = serviceJobsResult.data || [];
    const weeklyCompletedJobs = weeklyCompletedJobsResult.data || [];
    const monthlyCompletedJobs = monthlyCompletedJobsResult.data || [];

    const jobsByStatus = serviceJobs.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});

    const vehiclesDetailedCount = serviceJobs.filter((item) => item.status === 'completed').length;
    const completedJobsCount = weeklyCompletedJobs.length;

    return res.status(200).json({
      summary: {
        dateFrom: fromIso,
        dateTo: toIso,
        weeklyEstimatedRevenue: sumEstimatedAmount(weeklyCompletedJobs, servicesContent),
        monthlyEstimatedRevenue: sumEstimatedAmount(monthlyCompletedJobs, servicesContent),
        vehiclesDetailedCount,
        completedJobsCount,
      },
      jobsByStatus,
      csvRows: {
        jobs: serviceJobs.map((job) => ({
          id: job.id,
          clientName: job.client_name,
          vehicle: [job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(' '),
          serviceType: job.service_type,
          status: job.status,
          estimatedAmount:
            Number(job.estimated_amount || 0) ||
            estimateServiceAmount(
              servicesContent,
              job.service_catalog_id,
              job.service_addon_ids,
              job.service_type
            ) ||
            0,
          paymentStatus: job.payment_status,
          scheduledAt: job.scheduled_at,
          completedAt: job.completed_at,
          createdAt: job.created_at,
        })),
        leads: [],
        billing: [],
      },
    });
  } catch (error) {
    return serverError(res, error);
  }
}

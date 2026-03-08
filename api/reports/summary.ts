import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../_lib/auth';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { forbidden, methodNotAllowed, serverError, unauthorized } from '../_lib/http';
import { isFeatureEnabled } from '../_lib/featureFlags';

const toIsoDate = (value: string | undefined, fallback: Date) => {
  if (!value) return fallback.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString();
};

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
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const fromIso = toIsoDate(String(req.query.dateFrom || ''), thirtyDaysAgo);
    const toIso = toIsoDate(String(req.query.dateTo || ''), now);

    const [
      leadsResult,
      serviceJobsResult,
      billingResult,
    ] = await Promise.all([
      supabase
        .from('leads')
        .select('*')
        .gte('created_at', fromIso)
        .lte('created_at', toIso),
      supabase
        .from('service_jobs')
        .select('*')
        .gte('created_at', fromIso)
        .lte('created_at', toIso),
      supabase
        .from('billing_records')
        .select('*')
        .gte('created_at', fromIso)
        .lte('created_at', toIso),
    ]);

    if (leadsResult.error) throw new Error(leadsResult.error.message);
    if (serviceJobsResult.error) throw new Error(serviceJobsResult.error.message);
    if (billingResult.error) throw new Error(billingResult.error.message);

    const leads = leadsResult.data || [];
    const serviceJobs = serviceJobsResult.data || [];
    const billingRecords = billingResult.data || [];

    const leadsByStatus = leads.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});

    const jobsByStatus = serviceJobs.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});

    const billingByStatus = billingRecords.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});

    const outstandingAmount = billingRecords
      .filter((item) => ['sent', 'partially_paid', 'overdue'].includes(item.status))
      .reduce((sum, item) => sum + Number(item.total_amount || 0) - Number(item.amount_paid || 0), 0);

    const overdueCount = billingRecords.filter((item) => item.status === 'overdue').length;

    return res.status(200).json({
      summary: {
        dateFrom: fromIso,
        dateTo: toIso,
        totalLeads: leads.length,
        qualifiedLeads: (leadsByStatus.quoted || 0) + (leadsByStatus.booked || 0),
        bookedLeads: leadsByStatus.booked || 0,
        totalServiceJobs: serviceJobs.length,
        completedJobs: jobsByStatus.completed || 0,
        totalBillingRecords: billingRecords.length,
        overdueCount,
        outstandingAmount,
      },
      leadsByStatus,
      jobsByStatus,
      billingByStatus,
      csvRows: {
        leads: leads.map((lead) => ({
          id: lead.id,
          name: lead.name,
          email: lead.email,
          serviceType: lead.service_type,
          status: lead.status,
          sourcePage: lead.source_page,
          createdAt: lead.created_at,
        })),
        jobs: serviceJobs.map((job) => ({
          id: job.id,
          clientName: job.client_name,
          serviceType: job.service_type,
          status: job.status,
          scheduledAt: job.scheduled_at,
          createdAt: job.created_at,
        })),
        billing: billingRecords.map((item) => ({
          id: item.id,
          recordNumber: item.record_number,
          status: item.status,
          totalAmount: item.total_amount,
          amountPaid: item.amount_paid,
          dueAt: item.due_at,
          createdAt: item.created_at,
        })),
      },
    });
  } catch (error) {
    return serverError(res, error);
  }
}

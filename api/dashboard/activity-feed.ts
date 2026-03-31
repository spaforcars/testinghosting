import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../_lib/auth';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { forbidden, methodNotAllowed, serverError, unauthorized } from '../_lib/http';
import { isFeatureEnabled } from '../_lib/featureFlags';
import { fetchDashboardAiRuns, fetchDashboardEnquiries, fetchDashboardJobs, fetchDashboardNotifications } from '../_lib/dashboardData';

const readString = (value: unknown) => (typeof value === 'string' ? value : '');
const readRecord = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const buildMessageSnippet = (enquiry: Record<string, unknown>) => {
  const message = readString(enquiry.message).replace(/\s+/g, ' ').trim();
  return message.length > 90 ? `${message.slice(0, 87)}...` : message;
};
const isFleetProposal = (enquiry: Record<string, unknown>) => {
  const sourcePage = readString(enquiry.source_page);
  const serviceType = readString(enquiry.service_type).toLowerCase();
  const metadata = readRecord(enquiry.metadata);
  return sourcePage === 'fleet' || serviceType.includes('fleet proposal') || Boolean(readString(metadata.companyName));
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);
    if (!hasPermission(auth, 'dashboard', 'read')) return forbidden(res);

    const opsEnabled = await isFeatureEnabled(supabase, 'ops_v1_enabled', true);
    if (!opsEnabled) return forbidden(res);

    const [recentLeadsResult, recentJobs, recentNotifications, recentAiRuns, recentEnquiries] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(8),
      fetchDashboardJobs(supabase, { limit: 12 }),
      fetchDashboardNotifications(supabase, auth.userId, { limit: 8 }),
      fetchDashboardAiRuns(supabase, { limit: 8 }),
      fetchDashboardEnquiries(supabase, { limit: 8 }),
    ]);

    if (recentLeadsResult.error) throw new Error(recentLeadsResult.error.message);

    const items = [
      ...((recentLeadsResult.data || []) as Array<Record<string, unknown>>).map((lead) => ({
        id: `lead:${readString(lead.id)}`,
        kind: 'lead',
        title: `${readString(lead.name) || 'Lead'} entered the queue`,
        subtitle: readString(lead.service_type) || 'New lead',
        meta: readString(lead.status) || 'lead',
        createdAt: readString(lead.created_at),
        targetId: readString(lead.id),
      })),
      ...recentJobs.map((job) => ({
        id: `job:${readString(job.id)}`,
        kind: job.payment_status === 'paid' ? 'payment' : 'job',
        title:
          job.payment_status === 'paid'
            ? `${readString(job.client_name)} was marked paid`
            : `${readString(job.client_name)} has a service job`,
        subtitle: readString(job.service_type) || 'Service job update',
        meta: `${job.ui_status} | ${job.payment_status}`,
        createdAt: readString(job.updated_at) || readString(job.created_at),
        targetId: readString(job.id),
      })),
      ...recentEnquiries.map((enquiry) => {
        const metadata = readRecord(enquiry.metadata);
        const companyName = readString(metadata.companyName);
        const title = isFleetProposal(enquiry)
          ? `${companyName || readString(enquiry.name) || 'Fleet prospect'} requested a fleet proposal`
          : `${readString(enquiry.name) || 'Customer'} sent a message`;
        return {
          id: `enquiry:${readString(enquiry.id)}`,
          kind: 'enquiry',
          title,
          subtitle: buildMessageSnippet(enquiry),
          meta: readString(enquiry.source_page) || 'enquiry',
          createdAt: readString(enquiry.created_at),
          targetId: readString(enquiry.id),
        };
      }),
      ...recentNotifications.map((notification) => ({
        id: `notification:${readString(notification.id)}`,
        kind: 'notification',
        title: readString(notification.title) || 'Notification',
        subtitle: readString(notification.message),
        meta: readString(notification.category) || 'notification',
        createdAt: readString(notification.created_at),
        targetId: readString(notification.id),
      })),
      ...recentAiRuns.map((run) => ({
        id: `ai:${run.id}`,
        kind: 'ai',
        title: `${run.feature_name.replace(/_/g, ' ')} ${run.status === 'review_required' ? 'needs review' : 'updated'}`,
        subtitle: `${run.entity_type} | ${run.entity_id}`,
        meta: run.status,
        createdAt: run.updated_at || run.created_at,
        targetId: run.id,
      })),
    ]
      .filter((item) => item.createdAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 18);

    return res.status(200).json({ items });
  } catch (error) {
    return serverError(res, error);
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../_lib/auth';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { forbidden, methodNotAllowed, serverError, unauthorized } from '../_lib/http';
import { isFeatureEnabled } from '../_lib/featureFlags';
import { getBookingSettings } from '../_lib/booking';
import {
  fetchDashboardAiRuns,
  fetchDashboardJobs,
  fetchDashboardNotifications,
  getDayLabel,
  getTimeZoneDateKey,
} from '../_lib/dashboardData';

const readString = (value: unknown) => (typeof value === 'string' ? value : '');

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
    const timeZone = bookingSettings.timeZone;
    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfWindow = new Date(startOfToday);
    endOfWindow.setDate(endOfWindow.getDate() + 7);

    const [upcomingJobs, recentLeadsResult, notifications, reviewRuns] = await Promise.all([
      fetchDashboardJobs(supabase, {
        limit: 180,
        scheduledFrom: startOfToday.toISOString(),
        scheduledTo: endOfWindow.toISOString(),
      }),
      supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(80),
      fetchDashboardNotifications(supabase, auth.userId, { limit: 8, unreadOnly: true }),
      fetchDashboardAiRuns(supabase, { limit: 12, reviewOnly: true }),
    ]);

    if (recentLeadsResult.error) throw new Error(recentLeadsResult.error.message);

    const leads = recentLeadsResult.data || [];
    const localTodayKey = getTimeZoneDateKey(now, timeZone);
    const todaySchedule = upcomingJobs.filter(
      (job) => getTimeZoneDateKey(readString(job.scheduled_at), timeZone) === localTodayKey
    );
    const nextUp = upcomingJobs
      .filter((job) => getTimeZoneDateKey(readString(job.scheduled_at), timeZone) !== localTodayKey)
      .slice(0, 8);
    const overdueUnpaid = upcomingJobs.filter((job) => {
      const scheduledAt = readString(job.scheduled_at);
      return (
        scheduledAt &&
        new Date(scheduledAt).getTime() < now.getTime() &&
        job.ui_status === 'scheduled' &&
        job.payment_status !== 'paid'
      );
    });
    const leadsNeedingFollowUp = leads.filter((lead) =>
      ['lead', 'contacted', 'quoted'].includes(readString(lead.status))
    );
    const openRequests = leads
      .filter(
        (lead) =>
          readString(lead.booking_mode) === 'request' &&
          ['lead', 'contacted', 'quoted'].includes(readString(lead.status))
      )
      .slice(0, 8);

    const unpaidJobs = upcomingJobs.filter(
      (job) => job.payment_status !== 'paid' && job.ui_status !== 'cancelled'
    );

    const urgentActions = [
      ...overdueUnpaid.slice(0, 4).map((job) => ({
        id: `job:${readString(job.id)}`,
        kind: 'job',
        urgency: 'high',
        title: `${readString(job.client_name)} payment follow-up`,
        subtitle: `${readString(job.service_type)} | ${readString(job.scheduled_at)}`,
        actionLabel: 'Open job',
        targetId: readString(job.id),
      })),
      ...openRequests.slice(0, 3).map((lead) => ({
        id: `lead:${readString(lead.id)}`,
        kind: 'lead',
        urgency: 'medium',
        title: `${readString(lead.name)} is waiting for confirmation`,
        subtitle: readString(lead.service_type) || 'Booking request lead',
        actionLabel: 'Prepare booking',
        targetId: readString(lead.id),
      })),
      ...reviewRuns.slice(0, 3).map((run) => ({
        id: `ai:${run.id}`,
        kind: 'ai',
        urgency: run.status === 'failed' ? 'high' : 'medium',
        title: `${run.feature_name.replace(/_/g, ' ')} needs review`,
        subtitle: `${run.entity_type} | ${run.entity_id}`,
        actionLabel: 'Review AI run',
        targetId: run.id,
      })),
      ...notifications.slice(0, 2).map((notification) => ({
        id: `notification:${readString(notification.id)}`,
        kind: 'notification',
        urgency: 'low',
        title: readString(notification.title) || 'Unread notification',
        subtitle: readString(notification.message),
        actionLabel: 'Mark read',
        targetId: readString(notification.id),
      })),
    ].slice(0, 10);

    return res.status(200).json({
      summary: {
        urgentActionCount: urgentActions.length,
        overdueUnpaidCount: overdueUnpaid.length,
        leadsNeedingFollowUpCount: leadsNeedingFollowUp.length,
        openRequestCount: openRequests.length,
        aiReviewCount: reviewRuns.length,
        unreadNotificationCount: notifications.length,
        expectedRevenueToday: todaySchedule.reduce((sum, job) => sum + Number(job.estimated_amount || 0), 0),
        expectedRevenueTotal: upcomingJobs.reduce((sum, job) => sum + Number(job.estimated_amount || 0), 0),
        unpaidRevenueTotal: unpaidJobs.reduce((sum, job) => sum + Number(job.estimated_amount || 0), 0),
      },
      urgentActions,
      todaySchedule: todaySchedule.slice(0, 8).map((job) => ({
        id: readString(job.id),
        clientName: readString(job.client_name),
        serviceType: readString(job.service_type),
        scheduledAt: readString(job.scheduled_at) || null,
        dayLabel: getDayLabel(readString(job.scheduled_at), timeZone),
        uiStatus: job.ui_status,
        paymentStatus: job.payment_status,
        estimatedAmount: Number(job.estimated_amount || 0),
        bookingSource: readString(job.booking_source) || null,
        pickupRequested: Boolean(job.pickup_requested),
        notes: readString(job.notes) || null,
      })),
      nextUp: nextUp.map((job) => ({
        id: readString(job.id),
        clientName: readString(job.client_name),
        serviceType: readString(job.service_type),
        scheduledAt: readString(job.scheduled_at) || null,
        dayLabel: getDayLabel(readString(job.scheduled_at), timeZone),
        uiStatus: job.ui_status,
        paymentStatus: job.payment_status,
        estimatedAmount: Number(job.estimated_amount || 0),
        pickupRequested: Boolean(job.pickup_requested),
      })),
      openRequests: openRequests.map((lead) => ({
        id: readString(lead.id),
        name: readString(lead.name),
        phone: readString(lead.phone) || null,
        serviceType: readString(lead.service_type) || null,
        createdAt: readString(lead.created_at),
        bookingMode: readString(lead.booking_mode) || null,
        status: readString(lead.status),
        intakeMetadata:
          lead.intake_metadata && typeof lead.intake_metadata === 'object' ? lead.intake_metadata : {},
      })),
      revenueFocus: {
        unpaidRevenueTotal: unpaidJobs.reduce((sum, job) => sum + Number(job.estimated_amount || 0), 0),
        highestValueUnpaidJobs: unpaidJobs
          .slice()
          .sort((a, b) => Number(b.estimated_amount || 0) - Number(a.estimated_amount || 0))
          .slice(0, 5)
          .map((job) => ({
            id: readString(job.id),
            clientName: readString(job.client_name),
            serviceType: readString(job.service_type),
            estimatedAmount: Number(job.estimated_amount || 0),
            scheduledAt: readString(job.scheduled_at) || null,
            paymentStatus: job.payment_status,
          })),
      },
      unreadNotifications: notifications.slice(0, 6),
      aiReviewRuns: reviewRuns.slice(0, 6),
    });
  } catch (error) {
    return serverError(res, error);
  }
}

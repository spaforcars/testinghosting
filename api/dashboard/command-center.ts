import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../_lib/auth';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { forbidden, methodNotAllowed, serverError, unauthorized } from '../_lib/http';
import { isFeatureEnabled } from '../_lib/featureFlags';
import { getBookingSettings } from '../_lib/booking';
import {
  fetchDashboardAiRuns,
  fetchDashboardEnquiries,
  fetchDashboardJobs,
  fetchDashboardNotifications,
  getDayLabel,
  getTimeZoneDateKey,
} from '../_lib/dashboardData';
import { getLeadOperatorMeta } from '../_lib/operatorWorkflow';
import {
  formatDateTimeInTimeZone,
  localDateKeyToUtcRange,
  shiftTimeZoneDateKey,
} from '../../lib/timeZone';

const readString = (value: unknown) => (typeof value === 'string' ? value : '');
const readRecord = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const buildMessageSnippet = (enquiry: Record<string, unknown>) => {
  const message = readString(enquiry.message).replace(/\s+/g, ' ').trim();
  return message.length > 110 ? `${message.slice(0, 107)}...` : message;
};
const isFleetProposal = (enquiry: Record<string, unknown>) => {
  const sourcePage = readString(enquiry.source_page);
  const serviceType = readString(enquiry.service_type).toLowerCase();
  const metadata = readRecord(enquiry.metadata);
  return (
    sourcePage === 'fleet' ||
    serviceType.includes('fleet proposal') ||
    Boolean(readString(metadata.companyName))
  );
};
const isMessageEnquiry = (enquiry: Record<string, unknown>) => {
  if (isFleetProposal(enquiry)) return false;
  const sourcePage = readString(enquiry.source_page);
  const metadata = readRecord(enquiry.metadata);
  if (sourcePage === 'contact' || readString(metadata.type) === 'contact_form') return true;
  if (readString(enquiry.booking_mode)) return false;
  return sourcePage !== 'booking';
};

const readAgingState = (value: unknown): 'fresh' | 'needs_follow_up' | 'urgent' =>
  value === 'urgent' || value === 'needs_follow_up' ? value : 'fresh';

const bucketUrgency = (states: Array<'fresh' | 'needs_follow_up' | 'urgent'>) =>
  states.includes('urgent') ? 'urgent' : states.includes('needs_follow_up') ? 'needs_follow_up' : 'fresh';

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
    const todayKey = getTimeZoneDateKey(now, timeZone);
    const { start: startOfToday } = localDateKeyToUtcRange(todayKey, timeZone);
    const { start: endOfWindow } = localDateKeyToUtcRange(shiftTimeZoneDateKey(todayKey, 7, timeZone), timeZone);

    const [upcomingJobs, recentLeadsResult, recentEnquiries, notifications, reviewRuns] = await Promise.all([
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
      fetchDashboardEnquiries(supabase, { limit: 60 }),
      fetchDashboardNotifications(supabase, auth.userId, { limit: 8, unreadOnly: true }),
      fetchDashboardAiRuns(supabase, { limit: 12, reviewOnly: true }),
    ]);

    if (recentLeadsResult.error) throw new Error(recentLeadsResult.error.message);

    const leads = recentLeadsResult.data || [];
    const hydratedLeads = leads.map((lead) => ({
      ...lead,
      operatorMeta: getLeadOperatorMeta(lead as never, now),
    }));
    const leadIdByEnquiryId = new Map(
      leads
        .map((lead) => [readString(lead.enquiry_id), readString(lead.id)] as const)
        .filter(([enquiryId, leadId]) => enquiryId && leadId)
    );
    const localTodayKey = getTimeZoneDateKey(now, timeZone);
    const todaySchedule = upcomingJobs.filter(
      (job) => getTimeZoneDateKey(readString(job.scheduled_at), timeZone) === localTodayKey
    );
    const nextUp = upcomingJobs
      .filter((job) => getTimeZoneDateKey(readString(job.scheduled_at), timeZone) !== localTodayKey)
      .slice(0, 8);
    const overdueUnpaid = upcomingJobs.filter((job) => {
      return Boolean(job.needs_payment_follow_up);
    });
    const leadsNeedingFollowUp = hydratedLeads.filter((lead) => lead.operatorMeta.agingState !== 'fresh');
    const openRequests = hydratedLeads
      .filter(
        (lead) =>
          readString(lead.booking_mode) === 'request' &&
          ['lead', 'contacted', 'quoted'].includes(readString(lead.status))
      )
      .slice(0, 8);
    const fleetProposals = recentEnquiries.filter(isFleetProposal).slice(0, 5);
    const messageEnquiries = recentEnquiries.filter(isMessageEnquiry).slice(0, 6);
    const unreadCustomerMessages = recentEnquiries.filter((enquiry) => isMessageEnquiry(enquiry) || isFleetProposal(enquiry));
    const unassignedJobs = upcomingJobs.filter((job) => Boolean(job.is_unassigned));

    const unpaidJobs = upcomingJobs.filter(
      (job) => job.payment_status !== 'paid' && job.ui_status !== 'cancelled'
    );

    const followUpBuckets = [
      {
        id: 'unassigned_jobs',
        label: 'Unassigned jobs',
        count: unassignedJobs.length,
        urgency: bucketUrgency(unassignedJobs.map((job) => readAgingState(job.aging_state))),
        primaryActionLabel: 'Open jobs',
        targetTab: 'jobs',
        targetView: 'unassigned',
        items: unassignedJobs.slice(0, 4).map((job) => ({
          id: readString(job.id),
          kind: 'job',
          title: readString(job.client_name) || 'Unassigned job',
          subtitle: `${readString(job.service_type)} | ${getDayLabel(readString(job.scheduled_at), timeZone)}`,
          agingState: readAgingState(job.aging_state),
          targetId: readString(job.id),
          actionLabel: 'Open job',
        })),
      },
      {
        id: 'open_request_bookings',
        label: 'Open request bookings',
        count: openRequests.length,
        urgency: bucketUrgency(openRequests.map((lead) => lead.operatorMeta.agingState)),
        primaryActionLabel: 'Open leads',
        targetTab: 'leads',
        targetView: 'request_only',
        items: openRequests.slice(0, 4).map((lead) => ({
          id: readString(lead.id),
          kind: 'lead',
          title: readString(lead.name) || 'Booking request',
          subtitle: readString(lead.service_type) || 'Request booking',
          agingState: lead.operatorMeta.agingState,
          targetId: readString(lead.id),
          actionLabel: 'Prepare booking',
        })),
      },
      {
        id: 'past_due_unpaid_jobs',
        label: 'Past-due unpaid jobs',
        count: overdueUnpaid.length,
        urgency: bucketUrgency(overdueUnpaid.map((job) => readAgingState(job.aging_state))),
        primaryActionLabel: 'Open payments',
        targetTab: 'payments',
        targetView: 'unpaid',
        items: overdueUnpaid.slice(0, 4).map((job) => ({
          id: readString(job.id),
          kind: 'job',
          title: `${readString(job.client_name)} payment follow-up`,
          subtitle: `${readString(job.service_type)} | ${getDayLabel(readString(job.scheduled_at), timeZone)}`,
          agingState: readAgingState(job.aging_state),
          targetId: readString(job.id),
          actionLabel: 'Mark paid',
        })),
      },
      {
        id: 'unread_customer_messages',
        label: 'Unread customer messages',
        count: unreadCustomerMessages.length,
        urgency: unreadCustomerMessages.some((enquiry) => {
          const createdAt = new Date(readString(enquiry.created_at));
          return !Number.isNaN(createdAt.getTime()) && now.getTime() - createdAt.getTime() > 24 * 3_600_000;
        })
          ? 'urgent'
          : unreadCustomerMessages.length
            ? 'needs_follow_up'
            : 'fresh',
        primaryActionLabel: 'Open leads',
        targetTab: 'leads',
        targetView: 'messages',
        items: unreadCustomerMessages.slice(0, 4).map((enquiry) => {
          const createdAt = new Date(readString(enquiry.created_at));
          const agingState =
            !Number.isNaN(createdAt.getTime()) && now.getTime() - createdAt.getTime() > 24 * 3_600_000
              ? 'urgent'
              : !Number.isNaN(createdAt.getTime()) && now.getTime() - createdAt.getTime() > 4 * 3_600_000
                ? 'needs_follow_up'
                : 'fresh';
          return {
            id: readString(enquiry.id),
            kind: 'enquiry',
            title: readString(enquiry.name) || 'Customer message',
            subtitle: buildMessageSnippet(enquiry),
            agingState,
            targetId: readString(enquiry.id),
            actionLabel: 'Open enquiry',
          };
        }),
      },
      {
        id: 'ai_review_required',
        label: 'AI review required',
        count: reviewRuns.length,
        urgency: reviewRuns.some((run) => run.status === 'failed') ? 'urgent' : reviewRuns.length ? 'needs_follow_up' : 'fresh',
        primaryActionLabel: 'Open inbox',
        targetTab: 'notifications',
        targetView: 'ai_review',
        items: reviewRuns.slice(0, 4).map((run) => ({
          id: run.id,
          kind: 'ai',
          title: run.feature_name.replace(/_/g, ' '),
          subtitle: `${run.entity_type} | ${run.entity_id}`,
          agingState: run.status === 'failed' ? 'urgent' : 'needs_follow_up',
          targetId: run.id,
          actionLabel: 'Review',
        })),
      },
    ];

    const urgentActions = [
      ...overdueUnpaid.slice(0, 4).map((job) => ({
        id: `job:${readString(job.id)}`,
        kind: 'job',
        urgency: 'high',
        title: `${readString(job.client_name)} payment follow-up`,
        subtitle: `${readString(job.service_type)} | ${formatDateTimeInTimeZone(readString(job.scheduled_at), {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }, timeZone)}`,
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
      ...fleetProposals.slice(0, 2).map((enquiry) => {
        const metadata = readRecord(enquiry.metadata);
        const companyName = readString(metadata.companyName) || readString(enquiry.name) || 'Fleet prospect';
        const volume = readString(metadata.volume);
        return {
          id: `enquiry:${readString(enquiry.id)}`,
          kind: 'enquiry',
          urgency: 'medium',
          title: `${companyName} requested fleet pricing`,
          subtitle: volume ? `${volume} | ${buildMessageSnippet(enquiry)}` : buildMessageSnippet(enquiry),
          actionLabel: 'Open lead queue',
          targetId: readString(enquiry.id),
        };
      }),
      ...messageEnquiries.slice(0, 2).map((enquiry) => ({
        id: `enquiry:${readString(enquiry.id)}`,
        kind: 'enquiry',
        urgency: 'low',
        title: `${readString(enquiry.name) || 'Customer'} sent a message`,
        subtitle: buildMessageSnippet(enquiry),
        actionLabel: 'Review enquiry',
        targetId: readString(enquiry.id),
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
        fleetProposalCount: fleetProposals.length,
        messageEnquiryCount: messageEnquiries.length,
        aiReviewCount: reviewRuns.length,
        unreadNotificationCount: notifications.length,
        expectedRevenueToday: todaySchedule.reduce((sum, job) => sum + Number(job.estimated_amount || 0), 0),
        expectedRevenueTotal: upcomingJobs.reduce((sum, job) => sum + Number(job.estimated_amount || 0), 0),
        unpaidRevenueTotal: unpaidJobs.reduce((sum, job) => sum + Number(job.estimated_amount || 0), 0),
      },
      followUpBuckets,
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
      fleetProposals: fleetProposals.map((enquiry) => {
        const metadata = readRecord(enquiry.metadata);
        return {
          id: readString(enquiry.id),
          leadId: leadIdByEnquiryId.get(readString(enquiry.id)) || null,
          name: readString(enquiry.name),
          email: readString(enquiry.email) || null,
          phone: readString(enquiry.phone) || null,
          sourcePage: readString(enquiry.source_page) || 'fleet',
          serviceType: readString(enquiry.service_type) || null,
          createdAt: readString(enquiry.created_at),
          messageSnippet: buildMessageSnippet(enquiry),
          companyName: readString(metadata.companyName) || null,
          fleetVolume: readString(metadata.volume) || null,
        };
      }),
      messageEnquiries: messageEnquiries.map((enquiry) => ({
        id: readString(enquiry.id),
        leadId: leadIdByEnquiryId.get(readString(enquiry.id)) || null,
        name: readString(enquiry.name),
        email: readString(enquiry.email) || null,
        phone: readString(enquiry.phone) || null,
        sourcePage: readString(enquiry.source_page) || 'contact',
        serviceType: readString(enquiry.service_type) || null,
        createdAt: readString(enquiry.created_at),
        messageSnippet: buildMessageSnippet(enquiry),
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

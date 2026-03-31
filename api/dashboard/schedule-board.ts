import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../_lib/auth';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { forbidden, methodNotAllowed, serverError, unauthorized } from '../_lib/http';
import { isFeatureEnabled } from '../_lib/featureFlags';
import { getBookingSettings } from '../_lib/booking';
import { listCalendarTimeBlocks } from '../_lib/calendarBlocks';
import { fetchDashboardJobs, getDayLabel, getTimeZoneDateKey } from '../_lib/dashboardData';

const readString = (value: unknown) => (typeof value === 'string' ? value : '');

const parseBooleanFilter = (value: unknown) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
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

    const bookingSettings = await getBookingSettings(supabase);
    const timeZone = bookingSettings.timeZone;
    const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : null;
    const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : null;
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const paymentStatus = typeof req.query.paymentStatus === 'string' ? req.query.paymentStatus : null;
    const bookingSource = typeof req.query.bookingSource === 'string' ? req.query.bookingSource : null;
    const assigneeId = typeof req.query.assigneeId === 'string' ? req.query.assigneeId : null;
    const pickupRequested = parseBooleanFilter(req.query.pickupRequested);
    const search = typeof req.query.search === 'string' ? req.query.search : null;
    const unassignedOnly = parseBooleanFilter(req.query.unassignedOnly) === true;
    const overdueOnly = parseBooleanFilter(req.query.overdueOnly) === true;
    const needsPaymentFollowUp = parseBooleanFilter(req.query.needsPaymentFollowUp) === true;

    const jobs = await fetchDashboardJobs(supabase, {
      limit: dateFrom || dateTo ? 260 : 1000,
      scheduledFrom: dateFrom,
      scheduledTo: dateTo,
      search,
      status: status || 'all',
      paymentStatus:
        paymentStatus === 'paid' || paymentStatus === 'unpaid' ? paymentStatus : 'all',
      bookingSource: bookingSource || 'all',
      pickupRequested,
      assigneeId: assigneeId || 'all',
      unassignedOnly,
      overdueOnly,
      needsPaymentFollowUp,
      sortMode: 'operator',
    });
    const calendarBlocks = await listCalendarTimeBlocks(supabase, {
      startAt: dateFrom,
      endAt: dateTo,
    });

    const assigneeIds = Array.from(
      new Set(jobs.map((job) => readString(job.assignee_id)).filter(Boolean))
    );
    const assigneeResult = assigneeIds.length
      ? await supabase
          .from('user_profiles')
          .select('id, full_name')
          .in('id', assigneeIds)
      : { data: [], error: null };
    if (assigneeResult.error) throw new Error(assigneeResult.error.message);

    const assigneeNameLookup = new Map(
      ((assigneeResult.data || []) as Array<Record<string, unknown>>).map((profile) => [
        readString(profile.id),
        readString(profile.full_name),
      ])
    );

    const groupsMap = new Map<
      string,
      {
        key: string;
        label: string;
        date: string | null;
        jobs: Array<Record<string, unknown>>;
      }
    >();

    for (const job of jobs) {
      const scheduledAt = readString(job.scheduled_at);
      const dateKey = scheduledAt ? getTimeZoneDateKey(scheduledAt, timeZone) : 'unscheduled';
      const existing = groupsMap.get(dateKey) || {
        key: dateKey,
        label: scheduledAt ? getDayLabel(scheduledAt, timeZone) : 'Unscheduled',
        date: scheduledAt || null,
        jobs: [],
      };
      existing.jobs.push({
        id: readString(job.id),
        clientId: readString(job.client_id) || null,
        clientName: readString(job.client_name),
        serviceType: readString(job.service_type),
        scheduledAt: scheduledAt || null,
        scheduledEndAt: readString(job.scheduled_end_at) || null,
        uiStatus: job.ui_status,
        paymentStatus: job.payment_status,
        estimatedAmount: Number(job.estimated_amount || 0),
        bookingSource: readString(job.booking_source) || null,
        bookingReference: readString(job.booking_reference) || null,
        pickupRequested: Boolean(job.pickup_requested),
        notes: readString(job.notes) || null,
        vehicleLabel: [job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ') || '-',
        assigneeId: readString(job.assignee_id) || null,
        assigneeLabel:
          assigneeNameLookup.get(readString(job.assignee_id)) || readString(job.assignee_id) || 'Unassigned',
        agingState: readString(job.aging_state) || 'fresh',
        followUpReason: readString(job.follow_up_reason) || null,
        isUnassigned: Boolean(job.is_unassigned),
        isOverdue: Boolean(job.is_overdue),
        needsPaymentFollowUp: Boolean(job.needs_payment_follow_up),
        aiMetadata: job.ai_metadata && typeof job.ai_metadata === 'object' ? job.ai_metadata : {},
      });
      groupsMap.set(dateKey, existing);
    }

    const groups = Array.from(groupsMap.values()).sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    return res.status(200).json({
      timeZone,
      summary: {
        totalJobs: jobs.length,
        unpaidJobs: jobs.filter((job) => job.payment_status !== 'paid').length,
        pickupJobs: jobs.filter((job) => Boolean(job.pickup_requested)).length,
        completedJobs: jobs.filter((job) => job.ui_status === 'completed').length,
      },
      blocks: calendarBlocks,
      filters: {
        assignees: [
          { id: 'all', label: 'All assignees', count: jobs.length },
          ...assigneeIds.map((id) => ({
            id,
            label: assigneeNameLookup.get(id) || id,
            count: jobs.filter((job) => readString(job.assignee_id) === id).length,
          })),
        ],
      },
      groups: groups.map((group) => ({
        ...group,
        summary: {
          totalJobs: group.jobs.length,
          unpaidJobs: group.jobs.filter((job) => job.paymentStatus !== 'paid').length,
          pickupJobs: group.jobs.filter((job) => job.pickupRequested).length,
        },
      })),
    });
  } catch (error) {
    return serverError(res, error);
  }
}


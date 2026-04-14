import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBookingSettings } from '../_lib/booking';
import {
  createDailyOpsSummaryEntityId,
  getDailyOpsSummaryData,
  getTodayDateKeyForTimeZone,
  shouldSendDailyOpsSummaryNow,
} from '../_lib/dailyOpsSummary';
import {
  getOpsEmailsEnabled,
  getOpsNotificationRecipients,
  getRetryDelayMinutes,
  sendDailyOpsSummaryEmail,
} from '../_lib/notifications';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { serverError } from '../_lib/http';
import { writeAuditLog } from '../_lib/audit';
import { getAppBaseUrl } from '../_lib/appBaseUrl';

const hasCronAccess = (req: VercelRequest): boolean => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const headerSecret = req.headers['x-cron-secret'];
  return headerSecret === secret;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!hasCronAccess(req)) {
    return res.status(401).json({ error: 'Unauthorized cron request' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const bookingSettings = await getBookingSettings(supabase);
    const now = new Date();

    if (!(await getOpsEmailsEnabled(supabase))) {
      return res.status(200).json({ skipped: 'alerts_disabled' });
    }

    if (!shouldSendDailyOpsSummaryNow(now, bookingSettings.timeZone, 7, 0)) {
      return res.status(200).json({
        skipped: 'outside_send_window',
        timeZone: bookingSettings.timeZone,
      });
    }

    const summaryDateKey = getTodayDateKeyForTimeZone(now, bookingSettings.timeZone);
    const entityId = createDailyOpsSummaryEntityId(summaryDateKey);

    const { data: existingEvent } = await supabase
      .from('notification_events')
      .select('id, status')
      .eq('event_type', 'daily_ops_summary')
      .eq('entity_id', entityId)
      .maybeSingle();

    if (existingEvent) {
      return res.status(200).json({
        skipped: 'already_recorded',
        eventId: existingEvent.id,
        status: existingEvent.status,
        summaryDateKey,
      });
    }

    const recipients = await getOpsNotificationRecipients(supabase);
    const summaryData = await getDailyOpsSummaryData(supabase, {
      localDateKey: summaryDateKey,
      timeZone: bookingSettings.timeZone,
    });

    const { data: event, error: eventError } = await supabase
      .from('notification_events')
      .insert({
        event_type: 'daily_ops_summary',
        entity_id: entityId,
        metadata: {
          summaryDateKey,
          timeZone: bookingSettings.timeZone,
          scheduledJobsCount: summaryData.scheduledJobs.length,
          requestLeadsCount: summaryData.requestLeads.length,
        },
        provider: 'resend',
        status: 'queued',
        attempt_count: 0,
      })
      .select('*')
      .single();

    if (eventError || !event) throw new Error(eventError?.message || 'Failed to create summary notification event');

    const sendResult = await sendDailyOpsSummaryEmail({
      to: recipients,
      summaryDateKey,
      timeZone: bookingSettings.timeZone,
      scheduledJobs: summaryData.scheduledJobs,
      requestLeads: summaryData.requestLeads,
      dashboardLink: `${getAppBaseUrl(req)}/#/dashboard`,
    });

    if (sendResult.success) {
      await supabase
        .from('notification_events')
        .update({
          status: 'sent',
          attempt_count: 1,
          sent_at: new Date().toISOString(),
          provider_message_id: sendResult.providerId || null,
          last_error: null,
          next_retry_at: null,
        })
        .eq('id', event.id);
    } else {
      await supabase
        .from('notification_events')
        .update({
          status: 'failed',
          attempt_count: 1,
          last_error: sendResult.error || 'Daily ops summary failed',
          next_retry_at: new Date(Date.now() + getRetryDelayMinutes(1) * 60_000).toISOString(),
        })
        .eq('id', event.id);
    }

    await writeAuditLog(supabase, {
      action: sendResult.success ? 'daily_summary_sent' : 'daily_summary_failed',
      module: 'notifications',
      entityType: 'notification_event',
      entityId: event.id,
      details: {
        summaryDateKey,
        recipients,
        scheduledJobs: summaryData.scheduledJobs.length,
        requestLeads: summaryData.requestLeads.length,
        result: sendResult.success ? 'sent' : sendResult.error || 'failed',
      },
    });

    return res.status(200).json({
      status: sendResult.success ? 'sent' : 'failed',
      summaryDateKey,
      scheduledJobs: summaryData.scheduledJobs.length,
      requestLeads: summaryData.requestLeads.length,
      error: sendResult.success ? null : sendResult.error || 'Daily ops summary failed',
    });
  } catch (error) {
    return serverError(res, error);
  }
}

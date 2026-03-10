import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { getRetryDelayMinutes, parseDefaultRecipients, sendEnquiryAlertEmail } from '../_lib/notifications';
import { serverError } from '../_lib/http';
import { writeAuditLog } from '../_lib/audit';
import { createUniqueInAppNotification } from '../_lib/inAppNotifications';

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
    const { data: alertsSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'enquiry_alerts_enabled')
      .maybeSingle();

    const nowDate = new Date();
    const now = nowDate.toISOString();
    let remindersCreated = 0;

    const next24Hours = new Date(nowDate.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const startOfToday = new Date(nowDate);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const { data: reminderJobs, error: reminderJobsError } = await supabase
      .from('service_jobs')
      .select('id, client_name, service_type, scheduled_at, assignee_id')
      .not('assignee_id', 'is', null)
      .neq('status', 'cancelled')
      .not('scheduled_at', 'is', null)
      .lte('scheduled_at', next24Hours);

    if (reminderJobsError) throw new Error(reminderJobsError.message);

    for (const job of reminderJobs || []) {
      const scheduledAt = job.scheduled_at ? new Date(job.scheduled_at) : null;
      if (!scheduledAt) continue;

      if (scheduledAt >= nowDate && scheduledAt <= new Date(next24Hours)) {
        const created = await createUniqueInAppNotification(supabase, job.assignee_id, {
          category: 'appointment_reminder_24h',
          title: 'Appointment reminder: tomorrow / next 24h',
          message: `${job.client_name} | ${job.service_type} at ${scheduledAt.toLocaleString()}`,
          entityType: 'service_job',
          entityId: job.id,
          metadata: { reminderType: '24h', scheduledAt: job.scheduled_at },
        });
        if (created) remindersCreated += 1;
      }

      if (nowDate.getHours() < 12 && scheduledAt >= startOfToday && scheduledAt < endOfToday) {
        const created = await createUniqueInAppNotification(supabase, job.assignee_id, {
          category: 'appointment_reminder_same_day',
          title: 'Appointment reminder: today',
          message: `${job.client_name} | ${job.service_type} at ${scheduledAt.toLocaleString()}`,
          entityType: 'service_job',
          entityId: job.id,
          metadata: { reminderType: 'same_day', scheduledAt: job.scheduled_at },
        });
        if (created) remindersCreated += 1;
      }
    }

    if (alertsSetting?.value === false) {
      return res.status(200).json({ processed: 0, sent: 0, failed: 0, remindersCreated, skipped: 'alerts_disabled' });
    }

    const { data: events, error } = await supabase
      .from('notification_events')
      .select('*')
      .in('status', ['failed', 'queued'])
      .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
      .lt('attempt_count', 4)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw new Error(error.message);
    if (!events?.length) {
      return res.status(200).json({ processed: 0, sent: 0, failed: 0 });
    }

    const recipientsRows = await supabase
      .from('admin_notification_recipients')
      .select('email')
      .eq('enabled', true);
    const recipients = recipientsRows.data?.length
      ? recipientsRows.data.map((row) => row.email)
      : parseDefaultRecipients();

    let sent = 0;
    let failed = 0;

    for (const event of events) {
      const { data: enquiry } = await supabase
        .from('enquiries')
        .select('*')
        .eq('id', event.entity_id)
        .maybeSingle();

      if (!enquiry) {
        failed += 1;
        await supabase
          .from('notification_events')
          .update({
            status: 'failed',
            attempt_count: (event.attempt_count || 0) + 1,
            last_error: 'Enquiry not found for notification event',
          })
          .eq('id', event.id);
        await writeAuditLog(supabase, {
          action: 'retry_failed',
          module: 'notifications',
          entityType: 'notification_event',
          entityId: event.id,
          details: { reason: 'enquiry_not_found', enquiryId: event.entity_id },
        });
        continue;
      }

      const nextAttempt = (event.attempt_count || 0) + 1;
      const result = await sendEnquiryAlertEmail(recipients, {
        enquiryId: enquiry.id,
        name: enquiry.name,
        email: enquiry.email,
        phone: enquiry.phone,
        message: enquiry.message,
        serviceType: enquiry.service_type,
        sourcePage: enquiry.source_page,
        createdAt: enquiry.created_at,
      });

      if (result.success) {
        sent += 1;
        await supabase
          .from('notification_events')
          .update({
            status: 'sent',
            attempt_count: nextAttempt,
            sent_at: new Date().toISOString(),
            provider_message_id: result.providerId || null,
            last_error: null,
            next_retry_at: null,
          })
          .eq('id', event.id);

        await writeAuditLog(supabase, {
          action: 'retry_sent',
          module: 'notifications',
          entityType: 'notification_event',
          entityId: event.id,
          details: { enquiryId: enquiry.id, providerMessageId: result.providerId || null },
        });
      } else {
        failed += 1;
        const retryAfter = getRetryDelayMinutes(nextAttempt);
        const nextRetryAt = new Date(Date.now() + retryAfter * 60_000).toISOString();
        await supabase
          .from('notification_events')
          .update({
            status: 'failed',
            attempt_count: nextAttempt,
            last_error: result.error || 'Retry failed',
            next_retry_at: nextRetryAt,
          })
          .eq('id', event.id);

        await writeAuditLog(supabase, {
          action: 'retry_failed',
          module: 'notifications',
          entityType: 'notification_event',
          entityId: event.id,
          details: { enquiryId: enquiry.id, error: result.error || 'Retry failed' },
        });
      }
    }

    return res.status(200).json({
      processed: events.length,
      sent,
      failed,
      remindersCreated,
    });
  } catch (error) {
    return serverError(res, error);
  }
}

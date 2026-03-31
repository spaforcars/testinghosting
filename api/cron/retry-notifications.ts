import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBookingSettings } from '../_lib/booking';
import { getDailyOpsSummaryData } from '../_lib/dailyOpsSummary';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import {
  getOpsEmailsEnabled,
  getOpsNotificationRecipients,
  getRetryDelayMinutes,
  sendBookingReminderEmail,
  sendDailyOpsSummaryEmail,
  sendEnquiryAlertEmail,
} from '../_lib/notifications';
import { serverError } from '../_lib/http';
import { writeAuditLog } from '../_lib/audit';
import { createUniqueInAppNotification } from '../_lib/inAppNotifications';
import {
  formatDateTimeInTimeZone,
  getTimeZoneDateKey,
  getTimeZoneParts,
  localDateKeyToUtcRange,
} from '../../lib/timeZone';

const hasCronAccess = (req: VercelRequest): boolean => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const headerSecret = req.headers['x-cron-secret'];
  return headerSecret === secret;
};

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const readString = (value: unknown) => (typeof value === 'string' ? value : '');

const updateNotificationEvent = async (
  supabase: ReturnType<typeof getSupabaseAdmin>,
  eventId: string,
  options: {
    attemptCount: number;
    success: boolean;
    providerId?: string;
    error?: string;
  }
) => {
  if (options.success) {
    await supabase
      .from('notification_events')
      .update({
        status: 'sent',
        attempt_count: options.attemptCount,
        sent_at: new Date().toISOString(),
        provider_message_id: options.providerId || null,
        last_error: null,
        next_retry_at: null,
      })
      .eq('id', eventId);
    return;
  }

  await supabase
    .from('notification_events')
    .update({
      status: 'failed',
      attempt_count: options.attemptCount,
      last_error: options.error || 'Retry failed',
      next_retry_at: new Date(Date.now() + getRetryDelayMinutes(options.attemptCount) * 60_000).toISOString(),
    })
    .eq('id', eventId);
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
    const nowDate = new Date();
    const now = nowDate.toISOString();
    let remindersCreated = 0;
    let customerRemindersSent = 0;

    const next24Hours = new Date(nowDate.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const todayKey = getTimeZoneDateKey(nowDate, bookingSettings.timeZone);
    const { start: startOfToday, end: endOfToday } = localDateKeyToUtcRange(todayKey, bookingSettings.timeZone);
    const localNowParts = getTimeZoneParts(nowDate, bookingSettings.timeZone);

    const { data: reminderJobs, error: reminderJobsError } = await supabase
      .from('service_jobs')
      .select('id, client_id, client_name, service_type, scheduled_at, assignee_id, booking_source, booking_reference')
      .neq('status', 'cancelled')
      .not('scheduled_at', 'is', null)
      .lte('scheduled_at', next24Hours);

    if (reminderJobsError) throw new Error(reminderJobsError.message);

    for (const job of reminderJobs || []) {
      const scheduledAt = job.scheduled_at ? new Date(job.scheduled_at) : null;
      if (!scheduledAt) continue;

      if (scheduledAt >= nowDate && scheduledAt <= new Date(next24Hours)) {
        if (job.assignee_id) {
          const created = await createUniqueInAppNotification(supabase, job.assignee_id, {
            category: 'appointment_reminder_24h',
            title: 'Appointment reminder: tomorrow / next 24h',
            message: `${job.client_name} | ${job.service_type} at ${formatDateTimeInTimeZone(scheduledAt, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            }, bookingSettings.timeZone)}`,
            entityType: 'service_job',
            entityId: job.id,
            metadata: { reminderType: '24h', scheduledAt: job.scheduled_at },
          });
          if (created) remindersCreated += 1;
        }

        if (job.booking_source === 'public' && job.client_id && job.booking_reference) {
          const { data: existingReminder } = await supabase
            .from('job_timeline_events')
            .select('id')
            .eq('service_job_id', job.id)
            .eq('event_type', 'customer_reminder_24h_sent')
            .limit(1)
            .maybeSingle();

          if (!existingReminder) {
            const { data: client } = await supabase
              .from('clients')
              .select('name, email')
              .eq('id', job.client_id)
              .maybeSingle();

            if (client?.email) {
              const result = await sendBookingReminderEmail({
                to: client.email,
                customerName: client.name || job.client_name,
                bookingReference: job.booking_reference,
                serviceName: job.service_type,
                scheduledAt: job.scheduled_at,
                timeZone: bookingSettings.timeZone,
              });

              if (result.success) {
                customerRemindersSent += 1;
                await supabase.from('job_timeline_events').insert({
                  service_job_id: job.id,
                  client_id: job.client_id,
                  event_type: 'customer_reminder_24h_sent',
                  note: '24-hour booking reminder email sent to customer',
                  metadata: {
                    bookingReference: job.booking_reference,
                    scheduledAt: job.scheduled_at,
                  },
                  created_by: null,
                });
              }
            }
          }
        }
      }

      if ((localNowParts?.hour ?? 24) < 12 && scheduledAt >= startOfToday && scheduledAt < endOfToday) {
        if (job.assignee_id) {
          const created = await createUniqueInAppNotification(supabase, job.assignee_id, {
            category: 'appointment_reminder_same_day',
            title: 'Appointment reminder: today',
            message: `${job.client_name} | ${job.service_type} at ${formatDateTimeInTimeZone(scheduledAt, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            }, bookingSettings.timeZone)}`,
            entityType: 'service_job',
            entityId: job.id,
            metadata: { reminderType: 'same_day', scheduledAt: job.scheduled_at },
          });
          if (created) remindersCreated += 1;
        }
      }
    }

    if (!(await getOpsEmailsEnabled(supabase))) {
      return res.status(200).json({
        processed: 0,
        sent: 0,
        failed: 0,
        remindersCreated,
        customerRemindersSent,
        skipped: 'alerts_disabled',
      });
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
      return res.status(200).json({ processed: 0, sent: 0, failed: 0, remindersCreated, customerRemindersSent });
    }

    const recipients = await getOpsNotificationRecipients(supabase);
    let sent = 0;
    let failed = 0;

    for (const event of events) {
      const nextAttempt = (event.attempt_count || 0) + 1;

      if (event.event_type === 'enquiry_created') {
        const { data: enquiry } = await supabase
          .from('enquiries')
          .select('*')
          .eq('id', event.entity_id)
          .maybeSingle();

        if (!enquiry) {
          failed += 1;
          await updateNotificationEvent(supabase, event.id, {
            attemptCount: nextAttempt,
            success: false,
            error: 'Enquiry not found for notification event',
          });
          await writeAuditLog(supabase, {
            action: 'retry_failed',
            module: 'notifications',
            entityType: 'notification_event',
            entityId: event.id,
            details: { reason: 'enquiry_not_found', enquiryId: event.entity_id },
          });
          continue;
        }

        const metadata = toRecord(enquiry.metadata);
        const vehicle = toRecord(metadata.vehicle);
        const timing = toRecord(metadata.timing);
        const pickup = toRecord(metadata.pickup);
        const addOnTitles = Array.isArray(metadata.selectedAddOnTitles)
          ? metadata.selectedAddOnTitles.filter((item): item is string => typeof item === 'string')
          : [];
        const assets = Array.isArray(metadata.assets) ? metadata.assets : [];

        const result = await sendEnquiryAlertEmail(recipients, {
          enquiryId: enquiry.id,
          name: enquiry.name,
          email: enquiry.email,
          phone: enquiry.phone,
          message: enquiry.message,
          serviceType: enquiry.service_type,
          sourcePage: enquiry.source_page,
          createdAt: enquiry.created_at,
          bookingReference: enquiry.booking_reference,
          bookingMode: enquiry.booking_mode,
          bookingStatus: enquiry.status,
          scheduledAt: readString(timing.scheduledAt) || null,
          timeZone: readString(timing.timeZone) || bookingSettings.timeZone,
          preferredSummary:
            [readString(timing.preferredDate), readString(timing.preferredDateTo), readString(timing.preferredTimeWindow)]
              .filter(Boolean)
              .join(' | ') || null,
          vehicleType: readString(vehicle.type) || null,
          vehicleMake: readString(vehicle.make) || null,
          vehicleModel: readString(vehicle.model) || null,
          vehicleYear: typeof vehicle.year === 'number' ? vehicle.year : null,
          vehicleDescription: readString(vehicle.description) || null,
          pickupRequested: Boolean(pickup.requested),
          issueDetails: readString(metadata.issueDetails) || null,
          notes: readString(metadata.notes) || null,
          addOnTitles,
          assetCount: assets.length,
        });

        await updateNotificationEvent(supabase, event.id, {
          attemptCount: nextAttempt,
          success: result.success,
          providerId: result.providerId,
          error: result.error,
        });

        if (result.success) {
          sent += 1;
          await writeAuditLog(supabase, {
            action: 'retry_sent',
            module: 'notifications',
            entityType: 'notification_event',
            entityId: event.id,
            details: { enquiryId: enquiry.id, providerMessageId: result.providerId || null },
          });
        } else {
          failed += 1;
          await writeAuditLog(supabase, {
            action: 'retry_failed',
            module: 'notifications',
            entityType: 'notification_event',
            entityId: event.id,
            details: { enquiryId: enquiry.id, error: result.error || 'Retry failed' },
          });
        }
        continue;
      }

      if (event.event_type === 'daily_ops_summary') {
        const metadata = toRecord(event.metadata);
        const summaryDateKey = readString(metadata.summaryDateKey);
        if (!summaryDateKey) {
          failed += 1;
          await updateNotificationEvent(supabase, event.id, {
            attemptCount: nextAttempt,
            success: false,
            error: 'Missing summaryDateKey metadata',
          });
          continue;
        }

        const summaryData = await getDailyOpsSummaryData(supabase, {
          localDateKey: summaryDateKey,
          timeZone: bookingSettings.timeZone,
        });
        const result = await sendDailyOpsSummaryEmail({
          to: recipients,
          summaryDateKey,
          timeZone: bookingSettings.timeZone,
          scheduledJobs: summaryData.scheduledJobs,
          requestLeads: summaryData.requestLeads,
          dashboardLink: `${process.env.APP_BASE_URL || 'http://localhost:3001'}/#/dashboard`,
        });

        await updateNotificationEvent(supabase, event.id, {
          attemptCount: nextAttempt,
          success: result.success,
          providerId: result.providerId,
          error: result.error,
        });

        if (result.success) {
          sent += 1;
        } else {
          failed += 1;
        }

        await writeAuditLog(supabase, {
          action: result.success ? 'retry_sent' : 'retry_failed',
          module: 'notifications',
          entityType: 'notification_event',
          entityId: event.id,
          details: {
            summaryDateKey,
            scheduledJobs: summaryData.scheduledJobs.length,
            requestLeads: summaryData.requestLeads.length,
            error: result.success ? null : result.error || 'Retry failed',
          },
        });
        continue;
      }

      failed += 1;
      await updateNotificationEvent(supabase, event.id, {
        attemptCount: nextAttempt,
        success: false,
        error: `Unsupported notification event type: ${event.event_type}`,
      });
    }

    return res.status(200).json({
      processed: events.length,
      sent,
      failed,
      remindersCreated,
      customerRemindersSent,
    });
  } catch (error) {
    return serverError(res, error);
  }
}

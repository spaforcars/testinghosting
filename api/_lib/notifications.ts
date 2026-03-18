import type { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export interface EnquiryAlertPayload {
  enquiryId: string;
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  serviceType?: string | null;
  sourcePage: string;
  createdAt: string;
  bookingReference?: string | null;
  bookingMode?: 'instant' | 'request' | null;
  bookingStatus?: string | null;
  scheduledAt?: string | null;
  timeZone?: string | null;
  preferredSummary?: string | null;
  vehicleType?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleYear?: number | null;
  vehicleDescription?: string | null;
  pickupRequested?: boolean;
  issueDetails?: string | null;
  notes?: string | null;
  addOnTitles?: string[];
  assetCount?: number;
  dashboardUrl?: string;
  manageLink?: string;
}

interface EmailResult {
  success: boolean;
  providerId?: string;
  error?: string;
}

interface CustomerBookingEmailBase {
  to: string;
  customerName: string;
  bookingReference: string;
  serviceName: string;
  manageLink?: string;
}

interface BookingConfirmationPayload extends CustomerBookingEmailBase {
  scheduledAt: string;
  timeZone: string;
  pickupRequested?: boolean;
}

interface BookingRequestAcknowledgementPayload extends CustomerBookingEmailBase {
  responseSla: string;
  preferredSummary?: string;
  pickupRequested?: boolean;
}

interface BookingReminderPayload extends CustomerBookingEmailBase {
  scheduledAt: string;
  timeZone: string;
}

export interface DailyOpsScheduledJobSummary {
  id: string;
  clientName: string;
  serviceType: string;
  scheduledAt: string;
  bookingReference?: string | null;
  pickupRequested?: boolean;
  vehicleLabel?: string | null;
  notes?: string | null;
}

export interface DailyOpsRequestLeadSummary {
  id: string;
  customerName: string;
  serviceType: string;
  createdAt: string;
  bookingReference?: string | null;
  preferredSummary?: string | null;
  issueDetails?: string | null;
  pickupRequested?: boolean;
  email?: string | null;
  phone?: string | null;
}

export interface DailyOpsSummaryPayload {
  to: string | string[];
  summaryDateKey: string;
  timeZone: string;
  scheduledJobs: DailyOpsScheduledJobSummary[];
  requestLeads: DailyOpsRequestLeadSummary[];
  dashboardLink?: string;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatMultiline = (value: string) => escapeHtml(value).replace(/\n/g, '<br />');

const absoluteAppUrl = (path = '') => {
  const baseUrl = (process.env.APP_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
  const cleanPath = path ? `/${path.replace(/^\/+/, '')}` : '';
  return `${baseUrl}${cleanPath}`;
};

const getMailer = () => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL;

  if (!apiKey) {
    return { error: 'Missing RESEND_API_KEY' } as const;
  }
  if (!from) {
    return { error: 'Missing ALERT_FROM_EMAIL' } as const;
  }

  return { resend: new Resend(apiKey), from } as const;
};

const formatScheduledAt = (scheduledAt: string, timeZone: string) => {
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return scheduledAt;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};

const formatDateKey = (dateKey: string, timeZone: string) => {
  const date = new Date(`${dateKey}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const renderRows = (rows: Array<[label: string, value: string | number | boolean | null | undefined]>) =>
  rows
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 0;font-weight:600;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:6px 0;">${escapeHtml(String(value))}</td></tr>`
    )
    .join('');

const sendEmail = async (payload: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<EmailResult> => {
  const mailer = getMailer();
  if ('error' in mailer) return { success: false, error: mailer.error };

  const { data, error } = await mailer.resend.emails.send({
    from: mailer.from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, providerId: data?.id };
};

const parseRecipients = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

export const parseDefaultRecipients = (): string[] => {
  const raw = process.env.DEFAULT_ALERT_RECIPIENTS || '';
  return parseRecipients(raw);
};

export const getOpsNotificationRecipients = async (supabase: SupabaseClient): Promise<string[]> => {
  const { data: opsSetting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'ops_notification_email')
    .maybeSingle();

  const directRecipients = parseRecipients(opsSetting?.value);
  if (directRecipients.length) {
    return directRecipients;
  }

  const envRecipients = parseRecipients(process.env.OPS_NOTIFICATION_EMAIL || '');
  if (envRecipients.length) {
    return envRecipients;
  }

  const { data: recipients } = await supabase
    .from('admin_notification_recipients')
    .select('email')
    .eq('enabled', true);

  if (recipients?.length) {
    return recipients.map((row) => row.email).filter(Boolean);
  }

  return parseDefaultRecipients();
};

export const getOpsEmailsEnabled = async (supabase: SupabaseClient): Promise<boolean> => {
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'enquiry_alerts_enabled')
    .maybeSingle();
  return data?.value !== false;
};

export const sendEnquiryAlertEmail = async (
  recipients: string[],
  payload: EnquiryAlertPayload
): Promise<EmailResult> => {
  if (!recipients.length) {
    return { success: false, error: 'No notification recipients configured' };
  }

  const isBookingAlert = Boolean(payload.bookingReference || payload.bookingMode);
  const appUrl = absoluteAppUrl();
  const dashboardUrl =
    payload.dashboardUrl || `${appUrl}/#/dashboard?enquiry=${encodeURIComponent(payload.enquiryId)}`;
  const bookingModeLabel =
    payload.bookingMode === 'instant'
      ? 'Confirmed booking'
      : payload.bookingMode === 'request'
        ? 'Booking request'
        : 'Website enquiry';
  const subject = isBookingAlert
    ? `${
        payload.bookingMode === 'instant' ? 'New Confirmed Booking' : 'New Booking Request'
      }: ${payload.serviceType || payload.sourcePage} - ${payload.name}`
    : `New Enquiry: ${payload.serviceType || payload.sourcePage} - ${payload.name}`;
  const vehicleLabel = [payload.vehicleYear, payload.vehicleMake, payload.vehicleModel]
    .filter(Boolean)
    .join(' ');

  return sendEmail({
    to: recipients,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;">
        <h2 style="margin:0 0 16px 0;color:#111827;">${escapeHtml(bookingModeLabel)}</h2>
        <p style="margin:0 0 12px 0;">A customer submitted a website request.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${renderRows([
            ['Customer', payload.name],
            ['Email', payload.email],
            ['Phone', payload.phone || '-'],
            ['Booking Ref', payload.bookingReference || ''],
            ['Service', payload.serviceType || '-'],
            ['Add-ons', payload.addOnTitles?.join(', ') || ''],
            ['Status', payload.bookingStatus || ''],
            ['Appointment', payload.scheduledAt ? formatScheduledAt(payload.scheduledAt, payload.timeZone || 'America/Toronto') : ''],
            ['Preferred timing', payload.preferredSummary || ''],
            ['Vehicle profile', payload.vehicleType || ''],
            ['Vehicle', vehicleLabel || ''],
            ['Vehicle details', payload.vehicleDescription || ''],
            ['Pickup request', payload.pickupRequested ? 'Requested' : isBookingAlert ? 'No' : ''],
            ['Uploaded photos', typeof payload.assetCount === 'number' ? payload.assetCount : ''],
            ['Source Page', payload.sourcePage],
            ['Submitted At', payload.createdAt],
          ])}
        </table>
        ${
          payload.issueDetails
            ? `<div style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:8px;">
                <div style="font-weight:600;margin-bottom:6px;">Issue details</div>
                <div>${formatMultiline(payload.issueDetails)}</div>
              </div>`
            : ''
        }
        ${
          payload.notes
            ? `<div style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:8px;">
                <div style="font-weight:600;margin-bottom:6px;">Notes</div>
                <div>${formatMultiline(payload.notes)}</div>
              </div>`
            : ''
        }
        ${
          payload.message && !isBookingAlert
            ? `<div style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:8px;">
                <div style="font-weight:600;margin-bottom:6px;">Message</div>
                <div>${formatMultiline(payload.message)}</div>
              </div>`
            : ''
        }
        <div style="margin-top:20px;display:flex;gap:12px;flex-wrap:wrap;">
          <a href="${dashboardUrl}" style="background:#f97316;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;">Open dashboard</a>
          ${
            payload.manageLink
              ? `<a href="${payload.manageLink}" style="background:#111827;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;">Customer manage link</a>`
              : ''
          }
        </div>
      </div>
    `,
  });
};

export const sendBookingConfirmationEmail = async (
  payload: BookingConfirmationPayload
): Promise<EmailResult> =>
  sendEmail({
    to: payload.to,
    subject: `Booking confirmed: ${payload.serviceName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;">
        <h2 style="margin:0 0 12px 0;color:#111827;">Your Spa for Cars booking is confirmed</h2>
        <p style="margin:0 0 12px 0;">Hi ${escapeHtml(payload.customerName)}, your appointment has been confirmed.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${renderRows([
            ['Booking Ref', payload.bookingReference],
            ['Service', payload.serviceName],
            ['Appointment', formatScheduledAt(payload.scheduledAt, payload.timeZone)],
            ['Pickup request', payload.pickupRequested ? 'Requested' : 'No'],
          ])}
        </table>
        ${
          payload.manageLink
            ? `<p style="margin-top:20px;"><a href="${payload.manageLink}" style="background:#f97316;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;">Manage booking</a></p>`
            : ''
        }
      </div>
    `,
  });

export const sendBookingRequestAcknowledgementEmail = async (
  payload: BookingRequestAcknowledgementPayload
): Promise<EmailResult> =>
  sendEmail({
    to: payload.to,
    subject: `Booking request received: ${payload.serviceName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;">
        <h2 style="margin:0 0 12px 0;color:#111827;">We received your booking request</h2>
        <p style="margin:0 0 12px 0;">Hi ${escapeHtml(payload.customerName)}, we'll review the request and follow up ${escapeHtml(payload.responseSla)}.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${renderRows([
            ['Booking Ref', payload.bookingReference],
            ['Service', payload.serviceName],
            ['Preferred timing', payload.preferredSummary || ''],
            ['Pickup request', payload.pickupRequested ? 'Requested' : 'No'],
          ])}
        </table>
        ${
          payload.manageLink
            ? `<p style="margin-top:20px;"><a href="${payload.manageLink}" style="background:#f97316;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;">Review or update request</a></p>`
            : ''
        }
      </div>
    `,
  });

export const sendBookingRescheduledEmail = async (
  payload: BookingConfirmationPayload
): Promise<EmailResult> =>
  sendEmail({
    to: payload.to,
    subject: `Booking updated: ${payload.serviceName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;">
        <h2 style="margin:0 0 12px 0;color:#111827;">Your booking has been updated</h2>
        <p style="margin:0 0 12px 0;">Hi ${escapeHtml(payload.customerName)}, your new appointment time is ${escapeHtml(formatScheduledAt(payload.scheduledAt, payload.timeZone))}.</p>
        <p style="margin:0 0 12px 0;">Reference: ${escapeHtml(payload.bookingReference)}</p>
        ${
          payload.manageLink
            ? `<p style="margin-top:20px;"><a href="${payload.manageLink}" style="background:#f97316;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;">Manage booking</a></p>`
            : ''
        }
      </div>
    `,
  });

export const sendBookingCancellationEmail = async (
  payload: CustomerBookingEmailBase
): Promise<EmailResult> =>
  sendEmail({
    to: payload.to,
    subject: `Booking cancelled: ${payload.serviceName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;">
        <h2 style="margin:0 0 12px 0;color:#111827;">Your booking has been cancelled</h2>
        <p style="margin:0 0 12px 0;">Hi ${escapeHtml(payload.customerName)}, your Spa for Cars booking for ${escapeHtml(payload.serviceName)} has been cancelled.</p>
        <p style="margin:0;">Reference: ${escapeHtml(payload.bookingReference)}</p>
      </div>
    `,
  });

export const sendBookingReminderEmail = async (
  payload: BookingReminderPayload
): Promise<EmailResult> =>
  sendEmail({
    to: payload.to,
    subject: `Reminder: ${payload.serviceName} tomorrow`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;">
        <h2 style="margin:0 0 12px 0;color:#111827;">Appointment reminder</h2>
        <p style="margin:0 0 12px 0;">Hi ${escapeHtml(payload.customerName)}, this is a reminder for your appointment on ${escapeHtml(formatScheduledAt(payload.scheduledAt, payload.timeZone))}.</p>
        <p style="margin:0;">Reference: ${escapeHtml(payload.bookingReference)}</p>
        ${
          payload.manageLink
            ? `<p style="margin-top:20px;"><a href="${payload.manageLink}" style="background:#f97316;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;">Manage booking</a></p>`
            : ''
        }
      </div>
    `,
  });

export const sendDailyOpsSummaryEmail = async (
  payload: DailyOpsSummaryPayload
): Promise<EmailResult> => {
  const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
  if (!recipients.filter(Boolean).length) {
    return { success: false, error: 'No notification recipients configured' };
  }

  const scheduledJobsHtml = payload.scheduledJobs.length
    ? payload.scheduledJobs
        .map(
          (job) => `
            <tr>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(formatScheduledAt(job.scheduledAt, payload.timeZone))}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(job.clientName)}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(job.serviceType)}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(job.vehicleLabel || '-')}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(job.bookingReference || '-')}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${job.pickupRequested ? 'Requested' : 'No'}</td>
            </tr>
          `
        )
        .join('')
    : `<tr><td colspan="6" style="padding:10px;border-bottom:1px solid #e5e7eb;">No scheduled jobs today.</td></tr>`;

  const requestLeadsHtml = payload.requestLeads.length
    ? payload.requestLeads
        .map(
          (lead) => `
            <tr>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(lead.customerName)}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(lead.serviceType)}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(lead.preferredSummary || '-')}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(lead.bookingReference || '-')}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${lead.pickupRequested ? 'Requested' : 'No'}</td>
            </tr>
          `
        )
        .join('')
    : `<tr><td colspan="5" style="padding:10px;border-bottom:1px solid #e5e7eb;">No open request bookings.</td></tr>`;

  return sendEmail({
    to: payload.to,
    subject: `Daily Ops Summary: ${formatDateKey(payload.summaryDateKey, payload.timeZone)}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:760px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;">
        <h2 style="margin:0 0 12px 0;color:#111827;">Daily operations summary</h2>
        <p style="margin:0 0 12px 0;">${escapeHtml(formatDateKey(payload.summaryDateKey, payload.timeZone))} in ${escapeHtml(payload.timeZone)}</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin:16px 0;">
          <div style="padding:12px 14px;border-radius:10px;background:#f9fafb;border:1px solid #e5e7eb;">
            <div style="font-size:12px;text-transform:uppercase;color:#6b7280;">Scheduled jobs</div>
            <div style="font-size:24px;font-weight:700;color:#111827;">${payload.scheduledJobs.length}</div>
          </div>
          <div style="padding:12px 14px;border-radius:10px;background:#f9fafb;border:1px solid #e5e7eb;">
            <div style="font-size:12px;text-transform:uppercase;color:#6b7280;">Open requests</div>
            <div style="font-size:24px;font-weight:700;color:#111827;">${payload.requestLeads.length}</div>
          </div>
        </div>
        <h3 style="margin:24px 0 12px 0;color:#111827;">Today's scheduled jobs</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#f9fafb;text-align:left;">
              <th style="padding:8px;border-bottom:1px solid #e5e7eb;">Time</th>
              <th style="padding:8px;border-bottom:1px solid #e5e7eb;">Customer</th>
              <th style="padding:8px;border-bottom:1px solid #e5e7eb;">Service</th>
              <th style="padding:8px;border-bottom:1px solid #e5e7eb;">Vehicle</th>
              <th style="padding:8px;border-bottom:1px solid #e5e7eb;">Booking Ref</th>
              <th style="padding:8px;border-bottom:1px solid #e5e7eb;">Pickup</th>
            </tr>
          </thead>
          <tbody>
            ${scheduledJobsHtml}
          </tbody>
        </table>
        <h3 style="margin:24px 0 12px 0;color:#111827;">Open request bookings</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#f9fafb;text-align:left;">
              <th style="padding:8px;border-bottom:1px solid #e5e7eb;">Customer</th>
              <th style="padding:8px;border-bottom:1px solid #e5e7eb;">Service</th>
              <th style="padding:8px;border-bottom:1px solid #e5e7eb;">Preferred timing</th>
              <th style="padding:8px;border-bottom:1px solid #e5e7eb;">Booking Ref</th>
              <th style="padding:8px;border-bottom:1px solid #e5e7eb;">Pickup</th>
            </tr>
          </thead>
          <tbody>
            ${requestLeadsHtml}
          </tbody>
        </table>
        <p style="margin-top:20px;">
          <a href="${payload.dashboardLink || `${absoluteAppUrl()}/#/dashboard`}" style="background:#f97316;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;">Open dashboard</a>
        </p>
      </div>
    `,
  });
};

export const getRetryDelayMinutes = (attemptCount: number): number => {
  if (attemptCount <= 1) return 1;
  if (attemptCount === 2) return 5;
  return 30;
};

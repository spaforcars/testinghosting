import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getLocalDateKey, localDateStringToUtcRange } from './booking';
import type {
  DailyOpsRequestLeadSummary,
  DailyOpsScheduledJobSummary,
} from './notifications';

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const readString = (value: unknown) => (typeof value === 'string' ? value : '');

const formatDeterministicUuid = (hex: string) => {
  const normalized = hex.slice(0, 32).padEnd(32, '0');
  return [
    normalized.slice(0, 8),
    normalized.slice(8, 12),
    `5${normalized.slice(13, 16)}`,
    `8${normalized.slice(17, 20)}`,
    normalized.slice(20, 32),
  ].join('-');
};

export const createDailyOpsSummaryEntityId = (localDateKey: string) =>
  formatDeterministicUuid(
    crypto.createHash('sha256').update(`daily_ops_summary:${localDateKey}`).digest('hex')
  );

export const shouldSendDailyOpsSummaryNow = (
  now: Date,
  timeZone: string,
  targetHour = 7,
  targetMinute = 0
) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  const hour = Number(lookup.get('hour') || '0');
  const minute = Number(lookup.get('minute') || '0');
  return hour === targetHour && minute >= targetMinute && minute < targetMinute + 10;
};

export const getDailyOpsSummaryData = async (
  supabase: SupabaseClient,
  options: { localDateKey: string; timeZone: string }
): Promise<{
  summaryDateKey: string;
  scheduledJobs: DailyOpsScheduledJobSummary[];
  requestLeads: DailyOpsRequestLeadSummary[];
}> => {
  const { start, end } = localDateStringToUtcRange(options.localDateKey, options.timeZone);

  const { data: serviceJobs, error: jobsError } = await supabase
    .from('service_jobs')
    .select('id, client_name, service_type, scheduled_at, booking_reference, pickup_requested, vehicle_make, vehicle_model, vehicle_year, notes, status')
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', start.toISOString())
    .lt('scheduled_at', end.toISOString())
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: true });

  if (jobsError) throw new Error(jobsError.message);

  const scheduledJobs: DailyOpsScheduledJobSummary[] = (serviceJobs || []).map((job) => ({
    id: job.id,
    clientName: job.client_name,
    serviceType: job.service_type,
    scheduledAt: job.scheduled_at,
    bookingReference: job.booking_reference,
    pickupRequested: Boolean(job.pickup_requested),
    vehicleLabel: [job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ') || null,
    notes: job.notes || null,
  }));

  const { data: requestLeads, error: requestLeadsError } = await supabase
    .from('leads')
    .select('id, name, email, phone, service_type, booking_mode, status, intake_metadata, created_at')
    .eq('booking_mode', 'request')
    .order('created_at', { ascending: true });

  if (requestLeadsError) throw new Error(requestLeadsError.message);

  const openRequestStatuses = new Set(['lead', 'contacted', 'quoted']);
  const requestLeadSummaries: DailyOpsRequestLeadSummary[] = (requestLeads || [])
    .filter((lead) => openRequestStatuses.has(lead.status))
    .map((lead) => {
      const intake = toRecord(lead.intake_metadata);
      return {
        id: lead.id,
        customerName: lead.name,
        serviceType: lead.service_type || 'General service',
        createdAt: lead.created_at,
        bookingReference: readString(intake.bookingReference) || null,
        preferredSummary: readString(intake.preferredSummary) || null,
        issueDetails: readString(intake.issueDetails) || null,
        pickupRequested: Boolean(intake.pickupRequested),
        email: lead.email || null,
        phone: lead.phone || null,
      };
    });

  return {
    summaryDateKey: options.localDateKey,
    scheduledJobs,
    requestLeads: requestLeadSummaries,
  };
};

export const getTodayDateKeyForTimeZone = (now: Date, timeZone: string) =>
  getLocalDateKey(now, timeZone);

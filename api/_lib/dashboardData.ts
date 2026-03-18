import type { SupabaseClient } from '@supabase/supabase-js';
import { listAiRuns } from './ai';
import { getCmsPageData } from './cms';
import { mapJobToUiStatus, mapJobUiStatusToInternal } from './dashboardStatus';
import { defaultServicesPageContent } from '../../lib/cmsDefaults';
import { adaptServicesContent } from '../../lib/contentAdapter';
import { estimateServiceAmount } from '../../lib/serviceCatalog';

export const isMissingTableError = (message: string, table: string) =>
  message.includes(`Could not find the table 'public.${table}'`) ||
  new RegExp(`relation ["']?public\\.${table}["']? does not exist`, 'i').test(message);

export const isMissingColumnError = (message: string, column: string) =>
  message.includes(`Could not find the '${column}' column`) ||
  new RegExp(`column\\s+(?:[a-z0-9_]+\\.)?${column}\\s+does not exist`, 'i').test(message);

const readString = (value: unknown) => (typeof value === 'string' ? value : '');

const readStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const readLegacyPaymentStatus = (details: unknown): 'paid' | 'unpaid' | null => {
  if (!details || typeof details !== 'object') return null;
  const record = details as Record<string, unknown>;
  const paymentStatus = record.payment_status;
  if (!paymentStatus || typeof paymentStatus !== 'object') return null;
  const nextValue = (paymentStatus as Record<string, unknown>).to;
  return nextValue === 'paid' || nextValue === 'unpaid' ? nextValue : null;
};

const loadPaymentStatusOverrides = async (supabase: SupabaseClient, jobIds: string[]) => {
  if (!jobIds.length) return new Map<string, 'paid' | 'unpaid'>();

  const { data, error } = await supabase
    .from('audit_logs')
    .select('entity_id, details, created_at')
    .eq('module', 'services')
    .eq('entity_type', 'service_job')
    .in('entity_id', jobIds)
    .order('created_at', { ascending: false });

  if (error || !data?.length) return new Map<string, 'paid' | 'unpaid'>();

  const overrides = new Map<string, 'paid' | 'unpaid'>();
  for (const row of data) {
    if (overrides.has(row.entity_id)) continue;
    const paymentStatus = readLegacyPaymentStatus(row.details);
    if (paymentStatus) overrides.set(row.entity_id, paymentStatus);
  }

  return overrides;
};

export const getDashboardServicesContent = async () =>
  adaptServicesContent((await getCmsPageData('services')) || defaultServicesPageContent);

export const getEnrichedJobAmount = (
  row: Record<string, unknown>,
  servicesContent: ReturnType<typeof adaptServicesContent>
) =>
  Number(row.estimated_amount || 0) ||
  estimateServiceAmount(
    servicesContent,
    readString(row.service_catalog_id) || null,
    readStringArray(row.service_addon_ids),
    readString(row.service_type) || null
  ) ||
  0;

export type DashboardJob = Record<string, unknown> & {
  ui_status: ReturnType<typeof mapJobToUiStatus>;
  payment_status: 'paid' | 'unpaid';
  estimated_amount: number;
};

export const fetchDashboardJobs = async (
  supabase: SupabaseClient,
  options: {
    limit?: number;
    scheduledFrom?: string | null;
    scheduledTo?: string | null;
    search?: string | null;
    status?: string | null;
    paymentStatus?: 'paid' | 'unpaid' | 'all' | null;
    bookingSource?: string | 'all' | null;
    pickupRequested?: boolean | null;
    assigneeId?: string | 'all' | null;
  } = {}
) => {
  const servicesContent = await getDashboardServicesContent();
  let query = supabase
    .from('service_jobs')
    .select('*')
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(options.limit || 200);

  if (options.scheduledFrom) query = query.gte('scheduled_at', options.scheduledFrom);
  if (options.scheduledTo) query = query.lte('scheduled_at', options.scheduledTo);
  if (options.status && options.status !== 'all') {
    const internalStatuses = mapJobUiStatusToInternal(options.status);
    if (internalStatuses.length > 1) {
      query = query.in('status', internalStatuses);
    } else if (internalStatuses[0]) {
      query = query.eq('status', internalStatuses[0]);
    }
  }
  if (options.search) {
    const escaped = String(options.search).trim().replace(/,/g, ' ').replace(/%/g, '');
    if (escaped) {
      query = query.or(
        `client_name.ilike.%${escaped}%,service_type.ilike.%${escaped}%,notes.ilike.%${escaped}%,vehicle_make.ilike.%${escaped}%,vehicle_model.ilike.%${escaped}%`
      );
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const paymentOverrides = await loadPaymentStatusOverrides(
    supabase,
    (data || []).map((job) => readString(job.id)).filter(Boolean)
  );

  const hydrated = ((data || []) as Array<Record<string, unknown>>).map((job) => ({
    ...job,
    estimated_amount: getEnrichedJobAmount(job, servicesContent),
    payment_status:
      (readString(job.payment_status) === 'paid' || readString(job.payment_status) === 'unpaid'
        ? (readString(job.payment_status) as 'paid' | 'unpaid')
        : paymentOverrides.get(readString(job.id)) || 'unpaid'),
    ui_status: mapJobToUiStatus(readString(job.status) || null),
  })) as DashboardJob[];

  return hydrated.filter((job) => {
    if (options.paymentStatus && options.paymentStatus !== 'all' && job.payment_status !== options.paymentStatus) {
      return false;
    }
    if (typeof options.pickupRequested === 'boolean' && Boolean(job.pickup_requested) !== options.pickupRequested) {
      return false;
    }
    if (options.bookingSource && options.bookingSource !== 'all' && readString(job.booking_source) !== options.bookingSource) {
      return false;
    }
    if (options.assigneeId && options.assigneeId !== 'all' && readString(job.assignee_id) !== options.assigneeId) {
      return false;
    }
    return true;
  });
};

export const fetchDashboardNotifications = async (
  supabase: SupabaseClient,
  userId: string,
  options: { limit?: number; unreadOnly?: boolean } = {}
) => {
  let query = supabase
    .from('in_app_notifications')
    .select('*')
    .eq('recipient_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(options.limit || 25);

  if (options.unreadOnly) {
    query = query.is('read_at', null);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingTableError(error.message, 'in_app_notifications')) {
      return [];
    }
    throw new Error(error.message);
  }

  return (data || []) as Array<Record<string, unknown>>;
};

export const fetchDashboardAiRuns = async (
  supabase: SupabaseClient,
  options: { limit?: number; reviewOnly?: boolean } = {}
) => {
  try {
    const runs = await listAiRuns(supabase, { limit: options.limit || 25 });
    return options.reviewOnly
      ? runs.filter((run) => run.status === 'review_required' || run.status === 'failed')
      : runs;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isMissingTableError(message, 'ai_runs')) {
      return [];
    }
    throw error;
  }
};

export const getTimeZoneDateKey = (value: string | Date, timeZone: string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
};

export const getDayLabel = (value: string | Date, timeZone: string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unscheduled';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

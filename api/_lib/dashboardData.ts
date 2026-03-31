import type { SupabaseClient } from '@supabase/supabase-js';
import { listAiRuns } from './ai';
import { getCmsPageData } from './cms';
import { mapJobToUiStatus, mapJobUiStatusToInternal } from './dashboardStatus';
import { compareOperatorJobs, getJobOperatorMeta } from './operatorWorkflow';
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
  id: string;
  lead_id?: string | null;
  client_id?: string | null;
  client_name: string;
  service_type: string;
  status: string;
  scheduled_at?: string | null;
  created_at: string;
  completed_at?: string | null;
  notes?: string | null;
  booking_source?: string | null;
  pickup_requested?: boolean | null;
  assignee_id?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: number | null;
  ui_status: ReturnType<typeof mapJobToUiStatus>;
  payment_status: 'paid' | 'unpaid';
  estimated_amount: number;
  aging_state: 'fresh' | 'needs_follow_up' | 'urgent';
  follow_up_reason: string;
  is_unassigned: boolean;
  is_overdue: boolean;
  needs_payment_follow_up: boolean;
};

export const loadAssigneeNameLookup = async (supabase: SupabaseClient, assigneeIds: string[]) => {
  const uniqueIds = Array.from(new Set(assigneeIds.filter(Boolean)));
  if (!uniqueIds.length) return new Map<string, string>();

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .in('id', uniqueIds);

  if (error) throw new Error(error.message);

  return new Map(
    ((data || []) as Array<Record<string, unknown>>).map((profile) => [
      readString(profile.id),
      readString(profile.full_name),
    ])
  );
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
    clientId?: string | null;
    leadId?: string | null;
    unassignedOnly?: boolean;
    overdueOnly?: boolean;
    needsPaymentFollowUp?: boolean;
    sortMode?: 'scheduled' | 'operator';
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
  if (options.clientId) query = query.eq('client_id', options.clientId);
  if (options.leadId) query = query.eq('lead_id', options.leadId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const paymentOverrides = await loadPaymentStatusOverrides(
    supabase,
    (data || []).map((job) => readString(job.id)).filter(Boolean)
  );

  const hydrated = ((data || []) as Array<Record<string, unknown>>).map((job) => {
    const normalizedJob = {
      ...job,
      estimated_amount: getEnrichedJobAmount(job, servicesContent),
      payment_status:
        (readString(job.payment_status) === 'paid' || readString(job.payment_status) === 'unpaid'
          ? (readString(job.payment_status) as 'paid' | 'unpaid')
          : paymentOverrides.get(readString(job.id)) || 'unpaid'),
      ui_status: mapJobToUiStatus(readString(job.status) || null),
    } as DashboardJob;
    const operatorMeta = getJobOperatorMeta(normalizedJob);
    return {
      ...normalizedJob,
      aging_state: operatorMeta.agingState,
      follow_up_reason: operatorMeta.followUpReason,
      is_unassigned: operatorMeta.isUnassigned,
      is_overdue: operatorMeta.isOverdue,
      needs_payment_follow_up: operatorMeta.needsPaymentFollowUp,
    } as DashboardJob;
  });

  const filtered = hydrated.filter((job) => {
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
    if (options.unassignedOnly && !job.is_unassigned) {
      return false;
    }
    if (options.overdueOnly && !job.is_overdue) {
      return false;
    }
    if (options.needsPaymentFollowUp && !job.needs_payment_follow_up) {
      return false;
    }
    return true;
  });

  return filtered.sort((left, right) => {
    if (options.sortMode === 'operator') {
      return compareOperatorJobs(
        {
          scheduled_at: left.scheduled_at as string | null | undefined,
          agingState: left.aging_state,
          followUpReason: left.follow_up_reason,
          isUnassigned: left.is_unassigned,
          isOverdue: left.is_overdue,
          needsPaymentFollowUp: left.needs_payment_follow_up,
        },
        {
          scheduled_at: right.scheduled_at as string | null | undefined,
          agingState: right.aging_state,
          followUpReason: right.follow_up_reason,
          isUnassigned: right.is_unassigned,
          isOverdue: right.is_overdue,
          needsPaymentFollowUp: right.needs_payment_follow_up,
        }
      );
    }
    const leftScheduledAt = readString(left.scheduled_at);
    const rightScheduledAt = readString(right.scheduled_at);
    const leftTime = leftScheduledAt ? new Date(leftScheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
    const rightTime = rightScheduledAt ? new Date(rightScheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return readString(right.created_at).localeCompare(readString(left.created_at));
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

export const fetchDashboardEnquiries = async (
  supabase: SupabaseClient,
  options: { limit?: number; sourcePages?: string[] } = {}
) => {
  let query = supabase.from('enquiries').select('*').order('created_at', { ascending: false }).limit(options.limit || 25);

  if (options.sourcePages?.length === 1) {
    query = query.eq('source_page', options.sourcePages[0]);
  } else if (options.sourcePages?.length) {
    query = query.in('source_page', options.sourcePages);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingTableError(error.message, 'enquiries')) {
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

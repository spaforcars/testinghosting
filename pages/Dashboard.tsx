import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Bot,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clipboard,
  CircleDollarSign,
  LayoutDashboard,
  LayoutGrid,
  MessageSquareText,
  Moon,
  RefreshCw,
  SunMedium,
  TableProperties,
  Users,
  Wrench,
} from 'lucide-react';
import AuthGate from '../components/AuthGate';
import { ApiError, apiRequest } from '../lib/apiClient';
import { useCmsPage } from '../hooks/useCmsPage';
import { adaptServicesContent } from '../lib/contentAdapter';
import { defaultServicesPageContent } from '../lib/cmsDefaults';
import {
  buildServiceLabel,
  estimateServiceAmount,
  findOfferingByTitle,
  getAddOnOfferings,
  getOfferingById,
  getPrimaryOfferings,
  groupOfferingsByCategory,
  resolveServiceDisplay,
} from '../lib/serviceCatalog';
import type { ServiceOffering } from '../types/cms';
import type { AiDraft, AiFeatureState, AiRun, AiSuggestion } from '../types/ai';
import type {
  ClientRecord,
  CustomerVehicle,
  InAppNotification,
  JobPaymentStatus,
  JobUiStatus,
  Lead,
  LeadUiStatus,
  ServiceJob,
} from '../types/platform';

type DashboardTab =
  | 'overview'
  | 'leads'
  | 'jobs'
  | 'customers'
  | 'payments'
  | 'notifications'
  | 'copilot'
  | 'reports';

type AuthMeResponse = {
  userId: string;
  email?: string;
  role: string;
  permissions: string[];
};

type MetricsResponse = {
  newLeadsToday: number;
  newCustomersToday: number;
  newCustomersOrLeadsToday: number;
  jobsScheduledToday: number;
  activeCustomers: number;
  expectedRevenueToday: number;
  expectedRevenueTotal: number;
  unreadNotifications: number;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type LeadsResponse = {
  leads: Lead[];
  pagination: Pagination;
};

type JobsResponse = {
  serviceJobs: ServiceJob[];
  pagination: Pagination;
};

type ClientsResponse = {
  clients: ClientRecord[];
  pagination: Pagination;
};

type NotificationsResponse = {
  notifications: InAppNotification[];
};

type AiRunsResponse = {
  runs: AiRun[];
};

type AiSuggestionResponse = {
  suggestion: AiSuggestion;
};

type CommandCenterJob = {
  id: string;
  clientName: string;
  serviceType: string;
  scheduledAt?: string | null;
  dayLabel?: string | null;
  uiStatus: JobUiStatus;
  paymentStatus: JobPaymentStatus;
  estimatedAmount: number;
  bookingSource?: string | null;
  bookingReference?: string | null;
  pickupRequested?: boolean;
  notes?: string | null;
};

type CommandCenterOpenRequest = {
  id: string;
  name: string;
  phone?: string | null;
  serviceType?: string | null;
  createdAt: string;
  bookingMode?: string | null;
  status: string;
  intakeMetadata?: Record<string, unknown>;
};

type CommandCenterResponse = {
  summary: {
    urgentActionCount: number;
    overdueUnpaidCount: number;
    leadsNeedingFollowUpCount: number;
    openRequestCount: number;
    aiReviewCount: number;
    unreadNotificationCount: number;
    expectedRevenueToday: number;
    expectedRevenueTotal: number;
    unpaidRevenueTotal: number;
  };
  urgentActions: Array<{
    id: string;
    kind: 'job' | 'lead' | 'ai' | 'notification';
    urgency: 'high' | 'medium' | 'low';
    title: string;
    subtitle: string;
    actionLabel: string;
    targetId: string;
  }>;
  todaySchedule: CommandCenterJob[];
  nextUp: CommandCenterJob[];
  openRequests: CommandCenterOpenRequest[];
  revenueFocus: {
    unpaidRevenueTotal: number;
    highestValueUnpaidJobs: Array<{
      id: string;
      clientName: string;
      serviceType: string;
      estimatedAmount: number;
      scheduledAt?: string | null;
      paymentStatus: JobPaymentStatus;
    }>;
  };
  unreadNotifications: InAppNotification[];
  aiReviewRuns: AiRun[];
};

type OpsChatResponse = {
  answer: string;
  supportingFacts: string[];
  followUpQuestions: string[];
  mode: 'ai' | 'fallback';
  warning?: string | null;
};

type OpsChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  supportingFacts?: string[];
  followUpQuestions?: string[];
  mode?: 'ai' | 'fallback';
  warning?: string | null;
};

type ClientDetailsResponse = {
  client: ClientRecord;
  vehicles: CustomerVehicle[];
  serviceJobs: ServiceJob[];
  leads: Lead[];
  timelineEvents: Array<{
    id: string;
    event_type: string;
    note?: string | null;
    created_at: string;
  }>;
  billingRecords: Array<Record<string, unknown>>;
};

type ReportsResponse = {
  summary: {
    dateFrom: string;
    dateTo: string;
    weeklyEstimatedRevenue: number;
    monthlyEstimatedRevenue: number;
    vehiclesDetailedCount: number;
    completedJobsCount: number;
  };
  jobsByStatus: Record<string, number>;
  csvRows: {
    jobs: Array<Record<string, unknown>>;
    leads: Array<Record<string, unknown>>;
    billing: Array<Record<string, unknown>>;
  };
};

type ActivityFeedResponse = {
  items: Array<{
    id: string;
    kind: 'lead' | 'job' | 'payment' | 'notification' | 'ai';
    title: string;
    subtitle: string;
    meta: string;
    createdAt: string;
    targetId: string;
  }>;
};

type ScheduleBoardJob = {
  id: string;
  clientName: string;
  serviceType: string;
  scheduledAt?: string | null;
  scheduledEndAt?: string | null;
  uiStatus: JobUiStatus;
  paymentStatus: JobPaymentStatus;
  estimatedAmount: number;
  bookingSource?: string | null;
  bookingReference?: string | null;
  pickupRequested: boolean;
  notes?: string | null;
  vehicleLabel: string;
  assigneeId?: string | null;
  assigneeLabel: string;
  aiMetadata?: Record<string, unknown>;
};

type ScheduleBoardResponse = {
  summary: {
    totalJobs: number;
    unpaidJobs: number;
    pickupJobs: number;
    completedJobs: number;
  };
  filters: {
    assignees: Array<{ id: string; label: string; count: number }>;
  };
  groups: Array<{
    key: string;
    label: string;
    date?: string | null;
    jobs: ScheduleBoardJob[];
  }>;
};

type LeadFormState = {
  name: string;
  phone: string;
  email: string;
  serviceType: string;
  serviceCatalogId: string;
  serviceAddonIds: string[];
  customServiceType: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  status: LeadUiStatus;
};

type JobFormState = {
  clientId: string;
  clientName: string;
  serviceType: string;
  serviceCatalogId: string;
  serviceAddonIds: string[];
  customServiceType: string;
  scheduledAt: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  estimatedAmount: string;
  paymentStatus: JobPaymentStatus;
  notes: string;
};

const tabs: Array<{ id: DashboardTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Daily Overview', icon: LayoutDashboard },
  { id: 'leads', label: 'New Customers / Leads', icon: Users },
  { id: 'jobs', label: 'Appointments / Jobs', icon: CalendarDays },
  { id: 'customers', label: 'Customer Database', icon: Users },
  { id: 'payments', label: 'Payments', icon: CircleDollarSign },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'copilot', label: 'Ops Copilot', icon: Bot },
  { id: 'reports', label: 'Reports', icon: Wrench },
];

const opsCopilotPromptSuggestions = [
  'How many pending jobs do we have this week?',
  'Who has already paid and what service did they book?',
  'Show me note highlights for unpaid customers.',
  'Who requested pickup or drop-off recently?',
  'How much expected revenue do we have in total?',
] as const;

const createOpsChatMessageId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const dashboardThemeStorageKey = 'spa-dashboard-theme';

const getInitialDashboardTheme = (): DashboardTheme => {
  if (typeof window === 'undefined') return 'light';

  const stored = window.localStorage.getItem(dashboardThemeStorageKey);
  if (stored === 'light' || stored === 'dark') return stored;

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const initialOpsChatMessage: OpsChatMessage = {
  id: 'ops-copilot-welcome',
  role: 'assistant',
  content:
    'Ask about pending schedules, paid and unpaid jobs, customer notes, pickup requests, lead messages, or expected revenue. Answers are grounded in the live dashboard data.',
  supportingFacts: [
    'Structured answers come from current jobs, leads, clients, and payment state.',
    'If AI is unavailable, the copilot falls back to a direct metrics summary.',
  ],
  followUpQuestions: [...opsCopilotPromptSuggestions],
  mode: 'fallback',
};

type SchedulePreset = 'today' | 'tomorrow' | 'this_week' | 'next_7_days';
type ScheduleViewMode = 'board' | 'table';
type DashboardTheme = 'light' | 'dark';

const emptyMetrics: MetricsResponse = {
  newLeadsToday: 0,
  newCustomersToday: 0,
  newCustomersOrLeadsToday: 0,
  jobsScheduledToday: 0,
  activeCustomers: 0,
  expectedRevenueToday: 0,
  expectedRevenueTotal: 0,
  unreadNotifications: 0,
};

const emptyLeadForm: LeadFormState = {
  name: '',
  phone: '',
  email: '',
  serviceType: '',
  serviceCatalogId: '',
  serviceAddonIds: [],
  customServiceType: '',
  vehicleMake: '',
  vehicleModel: '',
  vehicleYear: '',
  status: 'new_lead',
};

const emptyJobForm: JobFormState = {
  clientId: '',
  clientName: '',
  serviceType: '',
  serviceCatalogId: '',
  serviceAddonIds: [],
  customServiceType: '',
  scheduledAt: '',
  vehicleMake: '',
  vehicleModel: '',
  vehicleYear: '',
  estimatedAmount: '',
  paymentStatus: 'unpaid',
  notes: '',
};

const qs = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    search.set(key, String(value));
  });
  const output = search.toString();
  return output ? `?${output}` : '';
};

const currency = (value?: number | null) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(value || 0));

const fmtDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const fmtDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' });
};

const fmtTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

const fmtRelative = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const diffMs = date.getTime() - Date.now();
  const diffHours = Math.round(diffMs / 3_600_000);
  if (Math.abs(diffHours) < 24) {
    return diffHours === 0
      ? 'Now'
      : diffHours > 0
        ? `in ${diffHours}h`
        : `${Math.abs(diffHours)}h ago`;
  }
  const diffDays = Math.round(diffHours / 24);
  return diffDays > 0 ? `in ${diffDays}d` : `${Math.abs(diffDays)}d ago`;
};

const isoDateTimeLocal = (date: Date) => {
  const clone = new Date(date);
  clone.setMinutes(clone.getMinutes() - clone.getTimezoneOffset());
  return clone.toISOString();
};

const getSchedulePresetRange = (preset: SchedulePreset) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);

  if (preset === 'today') {
    end.setDate(end.getDate() + 1);
  } else if (preset === 'tomorrow') {
    start.setDate(start.getDate() + 1);
    end.setDate(start.getDate() + 1);
  } else if (preset === 'this_week') {
    end.setDate(end.getDate() + 7);
  } else {
    end.setDate(end.getDate() + 8);
  }

  return {
    dateFrom: isoDateTimeLocal(start),
    dateTo: isoDateTimeLocal(end),
  };
};

const schedulePresetLabel: Record<SchedulePreset, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  this_week: 'This Week',
  next_7_days: 'Next 7 Days',
};

const vehicleLabel = (vehicle: {
  vehicle_year?: number | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
}) => {
  const year = vehicle.vehicle_year ?? vehicle.year;
  const make = vehicle.vehicle_make ?? vehicle.make;
  const model = vehicle.vehicle_model ?? vehicle.model;
  const label = [year, make, model].filter(Boolean).join(' ');
  return label || '-';
};

type LeadDraftComposer = {
  channel: AiDraft['channel'];
  subject?: string;
  body: string;
};

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const readMetaString = (value: unknown) => (typeof value === 'string' ? value : '');

const readMetaStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const getLeadIntakeMetadata = (lead: Lead) => toRecord(lead.intake_metadata);

const getLeadPreferredSummary = (lead: Lead) => readMetaString(getLeadIntakeMetadata(lead).preferredSummary);

const getLeadIssueDetails = (lead: Lead) => readMetaString(getLeadIntakeMetadata(lead).issueDetails);

const getLeadNotes = (lead: Lead) => readMetaString(getLeadIntakeMetadata(lead).notes);

const getLeadPickupRequested = (lead: Lead) => Boolean(getLeadIntakeMetadata(lead).pickupRequested);

const getLeadPickupAddressSummary = (lead: Lead) => {
  const address = toRecord(getLeadIntakeMetadata(lead).pickupAddress);
  return [address.addressLine1, address.city, address.province, address.postalCode]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(', ');
};

const getLeadPhotoCount = (lead: Lead) => readMetaStringArray(getLeadIntakeMetadata(lead).assetPaths).length;

const getLeadBookingReference = (lead: Lead) => readMetaString(getLeadIntakeMetadata(lead).bookingReference);

const getLeadAiStaffNotes = (lead: Lead) =>
  readMetaStringArray(getLeadIntakeMetadata(lead).aiStaffNotes);

const buildLeadConversionNotes = (lead: Lead, serviceDisplay: string) => {
  const lines = [
    serviceDisplay !== '-' ? `Requested: ${serviceDisplay}` : '',
    getLeadPreferredSummary(lead) ? `Preferred timing: ${getLeadPreferredSummary(lead)}` : '',
    getLeadIssueDetails(lead) ? `Issue details: ${getLeadIssueDetails(lead)}` : '',
    getLeadNotes(lead) ? `Customer notes: ${getLeadNotes(lead)}` : '',
    getLeadPickupRequested(lead)
      ? `Pickup requested${getLeadPickupAddressSummary(lead) ? ` | ${getLeadPickupAddressSummary(lead)}` : ''}`
      : '',
    getLeadBookingReference(lead) ? `Booking reference: ${getLeadBookingReference(lead)}` : '',
  ].filter(Boolean);

  return lines.join('\n');
};

const jobStatusLabel: Record<JobUiStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const badgeClass = (status: string) => {
  const classes: Record<string, string> = {
    new_lead: 'bg-blue-50 text-blue-700 border-blue-200',
    booked: 'bg-amber-50 text-amber-700 border-amber-200',
    service_completed: 'bg-green-50 text-green-700 border-green-200',
    closed_lost: 'bg-red-50 text-red-700 border-red-200',
    scheduled: 'bg-amber-50 text-amber-700 border-amber-200',
    completed: 'bg-green-50 text-green-700 border-green-200',
    cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
    unpaid: 'bg-red-50 text-red-700 border-red-200',
    paid: 'bg-green-50 text-green-700 border-green-200',
  };
  return classes[status] || 'bg-gray-100 text-gray-700 border-gray-200';
};

const StatusBadge: React.FC<{ status: string; label?: string }> = ({ status, label }) => (
  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(status)}`}>
    {label || status}
  </span>
);

const readAiFeatureState = (metadata: unknown, key: string): AiFeatureState | null => {
  const value = toRecord(toRecord(metadata)[key]);
  if (!Object.keys(value).length) return null;

  return {
    feature: readMetaString(value.feature) as AiFeatureState['feature'],
    summary: readMetaString(value.summary),
    recommendations: Array.isArray(value.recommendations)
      ? value.recommendations
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
          .map((item) => {
            const priority: AiFeatureState['recommendations'][number]['priority'] =
              item.priority === 'high' || item.priority === 'low' ? item.priority : 'medium';
            const kind: AiFeatureState['recommendations'][number]['kind'] =
              item.kind === 'service' ||
              item.kind === 'upsell' ||
              item.kind === 'risk' ||
              item.kind === 'prep' ||
              item.kind === 'follow_up'
                ? item.kind
                : 'next_step';

            return {
              title: readMetaString(item.title),
              detail: readMetaString(item.detail),
              priority,
              kind,
            };
          })
          .filter((item) => item.title && item.detail)
      : [],
    missingInfo: readMetaStringArray(value.missingInfo),
    drafts: Array.isArray(value.drafts)
      ? value.drafts
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
          .map((item) => {
            const channel: AiDraft['channel'] =
              item.channel === 'email' ||
              item.channel === 'sms' ||
              item.channel === 'whatsapp' ||
              item.channel === 'internal'
                ? item.channel
                : 'internal';

            return {
              label: readMetaString(item.label) || 'Draft',
              channel,
              tone: readMetaString(item.tone) || 'neutral',
              subject: readMetaString(item.subject) || undefined,
              body: readMetaString(item.body),
            };
          })
          .filter((draft) => draft.body)
      : [],
    confidence: typeof value.confidence === 'number' ? value.confidence : 0,
    warnings: readMetaStringArray(value.warnings),
    recommendedNextAction: readMetaString(value.recommendedNextAction) || undefined,
    urgency:
      value.urgency === 'high' || value.urgency === 'low' ? value.urgency : value.urgency === 'medium' ? 'medium' : undefined,
    actions: Array.isArray(value.actions)
      ? value.actions
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
          .map((item) => {
            const type: NonNullable<AiFeatureState['actions']>[number]['type'] =
              item.type === 'update_lead_status' ||
              item.type === 'set_lead_service_recommendation' ||
              item.type === 'append_lead_note' ||
              item.type === 'append_job_note'
                ? item.type
                : 'append_lead_note';

            return {
              type,
              label: readMetaString(item.label) || 'Apply suggestion',
              status: readMetaString(item.status) || undefined,
              serviceCatalogId: readMetaString(item.serviceCatalogId) || undefined,
              serviceType: readMetaString(item.serviceType) || undefined,
              serviceAddonIds: readMetaStringArray(item.serviceAddonIds),
              note: readMetaString(item.note) || undefined,
            };
          })
      : [],
    runId: readMetaString(value.runId),
    promptVersion: readMetaString(value.promptVersion) || undefined,
    status: readMetaString(value.status) as AiFeatureState['status'],
    approvalStatus:
      value.approvalStatus === 'applied' || value.approvalStatus === 'dismissed'
        ? value.approvalStatus
        : 'pending',
    updatedAt: readMetaString(value.updatedAt),
    appliedAt: readMetaString(value.appliedAt) || undefined,
    dismissedAt: readMetaString(value.dismissedAt) || undefined,
  };
};

const isFulfilled = <T,>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> =>
  result.status === 'fulfilled';

const settledErrorMessage = (result: PromiseSettledResult<unknown>) =>
  result.status === 'rejected'
    ? result.reason instanceof ApiError
      ? result.reason.message
      : result.reason instanceof Error
        ? result.reason.message
        : 'Failed to load dashboard data'
    : null;

const formatConfidence = (value?: number | null) =>
  `${Math.round(Math.max(0, Math.min(1, Number(value || 0))) * 100)}%`;

const exportCsv = (filename: string, rows: Array<Record<string, unknown>>) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => `"${String(row[header] ?? '').replace(/"/g, '""')}"`)
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthMeResponse | null>(null);
  const [metrics, setMetrics] = useState<MetricsResponse>(emptyMetrics);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [aiRuns, setAiRuns] = useState<AiRun[]>([]);
  const [reports, setReports] = useState<ReportsResponse | null>(null);
  const [commandCenter, setCommandCenter] = useState<CommandCenterResponse | null>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedResponse['items']>([]);
  const [scheduleBoard, setScheduleBoard] = useState<ScheduleBoardResponse | null>(null);
  const [leadPagination, setLeadPagination] = useState<Pagination | null>(null);
  const [jobPagination, setJobPagination] = useState<Pagination | null>(null);
  const [clientPagination, setClientPagination] = useState<Pagination | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientDetails, setSelectedClientDetails] = useState<ClientDetailsResponse | null>(null);
  const [selectedScheduleJobId, setSelectedScheduleJobId] = useState<string | null>(null);
  const [customerNotes, setCustomerNotes] = useState('');
  const [leadForm, setLeadForm] = useState<LeadFormState>(emptyLeadForm);
  const [jobForm, setJobForm] = useState<JobFormState>(emptyJobForm);
  const [submittingLead, setSubmittingLead] = useState(false);
  const [submittingJob, setSubmittingJob] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [aiBusyKey, setAiBusyKey] = useState<string | null>(null);
  const [leadDraftComposer, setLeadDraftComposer] = useState<Record<string, LeadDraftComposer>>({});
  const [dailyBrief, setDailyBrief] = useState<AiSuggestion | null>(null);
  const [weeklyBrief, setWeeklyBrief] = useState<AiSuggestion | null>(null);
  const [copiedDraftKey, setCopiedDraftKey] = useState<string | null>(null);
  const [opsChatInput, setOpsChatInput] = useState('');
  const [opsChatSubmitting, setOpsChatSubmitting] = useState(false);
  const [opsChatMessages, setOpsChatMessages] = useState<OpsChatMessage[]>([initialOpsChatMessage]);
  const [search, setSearch] = useState('');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [dashboardTheme, setDashboardTheme] = useState<DashboardTheme>(getInitialDashboardTheme);
  const [showDashboardChrome, setShowDashboardChrome] = useState(true);
  const [schedulePreset, setSchedulePreset] = useState<SchedulePreset>('this_week');
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<'all' | JobUiStatus>('all');
  const [schedulePaymentFilter, setSchedulePaymentFilter] = useState<'all' | JobPaymentStatus>('all');
  const [scheduleBookingSourceFilter, setScheduleBookingSourceFilter] = useState<'all' | 'public' | 'ops'>('all');
  const [schedulePickupFilter, setSchedulePickupFilter] = useState<'all' | 'pickup' | 'standard'>('all');
  const [scheduleAssigneeFilter, setScheduleAssigneeFilter] = useState('all');
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [scheduleViewMode, setScheduleViewMode] = useState<ScheduleViewMode>('board');
  const [collapsedScheduleGroups, setCollapsedScheduleGroups] = useState<Record<string, boolean>>({});
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const { data: servicesCmsData } = useCmsPage('services', defaultServicesPageContent);
  const servicesContent = useMemo(
    () => adaptServicesContent(servicesCmsData),
    [servicesCmsData]
  );
  const primaryServiceOfferings = useMemo(
    () => getPrimaryOfferings(servicesContent),
    [servicesContent]
  );
  const addOnServiceOfferings = useMemo(
    () => getAddOnOfferings(servicesContent),
    [servicesContent]
  );
  const groupedPrimaryServiceOfferings = useMemo(
    () => groupOfferingsByCategory(primaryServiceOfferings),
    [primaryServiceOfferings]
  );

  const resolveSelectedAddOns = useCallback(
    (serviceAddonIds: string[]) =>
      serviceAddonIds
        .map((id) => getOfferingById(servicesContent, id))
        .filter(Boolean) as ServiceOffering[],
    [servicesContent]
  );

  const buildCatalogServicePayload = useCallback(
    (serviceCatalogId: string, serviceAddonIds: string[], customServiceType: string) => {
      if (!serviceCatalogId || serviceCatalogId === 'custom') {
        return {
          serviceType: customServiceType.trim(),
          serviceCatalogId: null,
          serviceAddonIds: [] as string[],
        };
      }

      const primaryOffering = getOfferingById(servicesContent, serviceCatalogId);
      if (!primaryOffering) {
        return {
          serviceType: customServiceType.trim(),
          serviceCatalogId: null,
          serviceAddonIds: [] as string[],
        };
      }

      const addOns = resolveSelectedAddOns(serviceAddonIds);
      return {
        serviceType: buildServiceLabel(primaryOffering, addOns, primaryOffering.title),
        serviceCatalogId: primaryOffering.id,
        serviceAddonIds: addOns.map((offering) => offering.id),
      };
    },
    [resolveSelectedAddOns, servicesContent]
  );

  const getPrefillAmount = useCallback(
    (serviceCatalogId: string, serviceAddonIds: string[]) => {
      if (!serviceCatalogId || serviceCatalogId === 'custom') return '';

      const primaryOffering = getOfferingById(servicesContent, serviceCatalogId);
      if (!primaryOffering?.fixedPriceAmount) return '';

      const addOns = resolveSelectedAddOns(serviceAddonIds);
      if (addOns.some((offering) => typeof offering.fixedPriceAmount !== 'number')) return '';

      const total =
        primaryOffering.fixedPriceAmount +
        addOns.reduce((sum, offering) => sum + Number(offering.fixedPriceAmount || 0), 0);

      return String(total);
    },
    [resolveSelectedAddOns, servicesContent]
  );

  const syncLeadServiceSelection = useCallback(
    (
      updates: Partial<Pick<LeadFormState, 'serviceCatalogId' | 'serviceAddonIds' | 'customServiceType'>>
    ) => {
      setLeadForm((current) => {
        const next = { ...current, ...updates };
        const payload = buildCatalogServicePayload(
          next.serviceCatalogId,
          next.serviceAddonIds,
          next.customServiceType
        );
        return {
          ...next,
          serviceType: payload.serviceType,
        };
      });
    },
    [buildCatalogServicePayload]
  );

  const syncJobServiceSelection = useCallback(
    (
      updates: Partial<Pick<JobFormState, 'serviceCatalogId' | 'serviceAddonIds' | 'customServiceType'>>
    ) => {
      setJobForm((current) => {
        const next = { ...current, ...updates };
        const payload = buildCatalogServicePayload(
          next.serviceCatalogId,
          next.serviceAddonIds,
          next.customServiceType
        );
        return {
          ...next,
          serviceType: payload.serviceType,
          estimatedAmount: getPrefillAmount(next.serviceCatalogId, next.serviceAddonIds),
        };
      });
    },
    [buildCatalogServicePayload, getPrefillAmount]
  );

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId) || null,
    [leads, selectedLeadId]
  );

  const selectedScheduleJob = useMemo(
    () =>
      scheduleBoard?.groups
        .flatMap((group) => group.jobs)
        .find((job) => job.id === selectedScheduleJobId) || null,
    [scheduleBoard, selectedScheduleJobId]
  );

  useEffect(() => {
    if (!scheduleBoard) return;
    setCollapsedScheduleGroups((current) => {
      const next: Record<string, boolean> = {};
      scheduleBoard.groups.forEach((group) => {
        next[group.key] = current[group.key] ?? false;
      });
      return next;
    });
  }, [scheduleBoard]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(dashboardThemeStorageKey, dashboardTheme);
  }, [dashboardTheme]);

  const getLeadServiceDisplay = useCallback(
    (lead: Lead) =>
      resolveServiceDisplay(
        servicesContent,
        lead.service_catalog_id,
        lead.service_addon_ids,
        lead.service_type
      ),
    [servicesContent]
  );

  const getJobServiceDisplay = useCallback(
    (job: ServiceJob) =>
      resolveServiceDisplay(
        servicesContent,
        job.service_catalog_id,
        job.service_addon_ids,
        job.service_type
      ),
    [servicesContent]
  );

  const getJobEstimatedAmount = useCallback(
    (job: ServiceJob) => {
      const storedAmount =
        typeof job.estimated_amount === 'number' && Number.isFinite(job.estimated_amount)
          ? job.estimated_amount
          : null;

      if (storedAmount && storedAmount > 0) return storedAmount;

      return (
        estimateServiceAmount(
          servicesContent,
          job.service_catalog_id,
          job.service_addon_ids,
          job.service_type
        ) || 0
      );
    },
    [servicesContent]
  );

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) =>
      [client.name, client.phone, client.email, client.company_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [clients, search]);

  const upcomingNotifications = useMemo(
    () => notifications.filter((item) => !item.read_at),
    [notifications]
  );

  const reviewRequiredRuns = useMemo(
    () => aiRuns.filter((run) => run.status === 'review_required' || run.status === 'failed'),
    [aiRuns]
  );

  const unpaidPaymentJobs = useMemo(
    () =>
      jobs
        .filter((job) => (job.payment_status || 'unpaid') !== 'paid')
        .sort((a, b) => Number(getJobEstimatedAmount(b)) - Number(getJobEstimatedAmount(a))),
    [getJobEstimatedAmount, jobs]
  );

  const paidPaymentJobs = useMemo(
    () =>
      jobs
        .filter((job) => (job.payment_status || 'unpaid') === 'paid')
        .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')),
    [jobs]
  );

  const unreadInboxNotifications = useMemo(
    () => notifications.filter((notification) => !notification.read_at),
    [notifications]
  );

  const readInboxNotifications = useMemo(
    () => notifications.filter((notification) => Boolean(notification.read_at)),
    [notifications]
  );

  const tabCounts = useMemo(
    () => ({
      overview: commandCenter?.summary.urgentActionCount || 0,
      leads: leadPagination?.total || leads.length,
      jobs: scheduleBoard?.summary.totalJobs || jobPagination?.total || jobs.length,
      customers: clientPagination?.total || clients.length,
      payments: unpaidPaymentJobs.length,
      notifications: upcomingNotifications.length + reviewRequiredRuns.length,
      copilot: 0,
      reports: 0,
    }),
    [
      clientPagination?.total,
      clients.length,
      commandCenter?.summary.urgentActionCount,
      jobPagination?.total,
      jobs.length,
      leadPagination?.total,
      leads.length,
      reviewRequiredRuns.length,
      scheduleBoard?.summary.totalJobs,
      unpaidPaymentJobs.length,
      upcomingNotifications.length,
    ]
  );

  const loadClientDetails = useCallback(async (clientId: string) => {
    const data = await apiRequest<ClientDetailsResponse>(`/api/clients/${clientId}`);
    setSelectedClientDetails(data);
    setCustomerNotes(data.client.notes || '');
  }, []);

  const loadScheduleBoard = useCallback(async () => {
    const range = getSchedulePresetRange(schedulePreset);
    const data = await apiRequest<ScheduleBoardResponse>(
      `/api/dashboard/schedule-board${qs({
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        status: scheduleStatusFilter,
        paymentStatus: schedulePaymentFilter,
        bookingSource: scheduleBookingSourceFilter,
        pickupRequested:
          schedulePickupFilter === 'pickup'
            ? 'true'
            : schedulePickupFilter === 'standard'
              ? 'false'
              : undefined,
        assigneeId: scheduleAssigneeFilter,
        search: scheduleSearch || undefined,
      })}`
    );
    setScheduleBoard(data);
    setSelectedScheduleJobId((current) => {
      if (current && data.groups.some((group) => group.jobs.some((job) => job.id === current))) {
        return current;
      }
      return data.groups[0]?.jobs[0]?.id || null;
    });
  }, [
    scheduleAssigneeFilter,
    scheduleBookingSourceFilter,
    schedulePaymentFilter,
    schedulePickupFilter,
    schedulePreset,
    scheduleSearch,
    scheduleStatusFilter,
  ]);

  const loadDashboard = useCallback(async () => {
    setError(null);
    const authData = await apiRequest<AuthMeResponse>('/api/auth/me');
    setAuth(authData);

    const [
      metricsResult,
      leadsResult,
      jobsResult,
      clientsResult,
      notificationsResult,
      reportsResult,
      aiRunsResult,
      commandCenterResult,
      activityFeedResult,
    ] =
      await Promise.allSettled([
        apiRequest<MetricsResponse>('/api/dashboard/metrics'),
        apiRequest<LeadsResponse>(`/api/leads${qs({ page: 1, pageSize: 50 })}`),
        apiRequest<JobsResponse>(`/api/service-jobs${qs({ page: 1, pageSize: 50 })}`),
        apiRequest<ClientsResponse>(`/api/clients${qs({ page: 1, pageSize: 50 })}`),
        apiRequest<NotificationsResponse>('/api/notifications/in-app?limit=25'),
        apiRequest<ReportsResponse>('/api/reports/summary'),
        apiRequest<AiRunsResponse>('/api/ai/runs?limit=30'),
        apiRequest<CommandCenterResponse>('/api/dashboard/command-center'),
        apiRequest<ActivityFeedResponse>('/api/dashboard/activity-feed'),
      ]);

    if (isFulfilled(metricsResult)) {
      setMetrics(metricsResult.value);
    }
    if (isFulfilled(leadsResult)) {
      setLeads(leadsResult.value.leads);
      setLeadPagination(leadsResult.value.pagination);
    }
    if (isFulfilled(jobsResult)) {
      setJobs(jobsResult.value.serviceJobs);
      setJobPagination(jobsResult.value.pagination);
    }
    if (isFulfilled(clientsResult)) {
      setClients(clientsResult.value.clients);
      setClientPagination(clientsResult.value.pagination);
      if (!selectedClientId && clientsResult.value.clients.length) {
        setSelectedClientId(clientsResult.value.clients[0].id);
      }
    }
    if (isFulfilled(notificationsResult)) {
      setNotifications(notificationsResult.value.notifications);
    }
    if (isFulfilled(reportsResult)) {
      setReports(reportsResult.value);
    } else {
      setReports(null);
    }
    if (isFulfilled(aiRunsResult)) {
      setAiRuns(aiRunsResult.value.runs);
    }
    if (isFulfilled(commandCenterResult)) {
      setCommandCenter(commandCenterResult.value);
    } else {
      setCommandCenter(null);
    }
    if (isFulfilled(activityFeedResult)) {
      setActivityFeed(activityFeedResult.value.items);
    } else {
      setActivityFeed([]);
    }

    const partialFailures = [
      metricsResult,
      leadsResult,
      jobsResult,
      clientsResult,
      notificationsResult,
      reportsResult,
      aiRunsResult,
      commandCenterResult,
      activityFeedResult,
    ]
      .map(settledErrorMessage)
      .filter((message): message is string => Boolean(message));

    if (partialFailures.length) {
      setError(partialFailures[0]);
    }
    setLastRefreshedAt(new Date().toISOString());
  }, [selectedClientId]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        if (!mounted) return;
        setLoading(true);
        await loadDashboard();
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Failed to load dashboard';
        if (mounted) setError(message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [loadDashboard]);

  useEffect(() => {
    if (!selectedClientId) return;
    loadClientDetails(selectedClientId).catch((err) => {
      const message = err instanceof ApiError ? err.message : 'Failed to load customer details';
      setError(message);
    });
  }, [loadClientDetails, selectedClientId]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setScheduleLoading(true);
        const data = await apiRequest<ScheduleBoardResponse>(
          `/api/dashboard/schedule-board${qs({
            dateFrom: getSchedulePresetRange(schedulePreset).dateFrom,
            dateTo: getSchedulePresetRange(schedulePreset).dateTo,
            status: scheduleStatusFilter,
            paymentStatus: schedulePaymentFilter,
            bookingSource: scheduleBookingSourceFilter,
            pickupRequested:
              schedulePickupFilter === 'pickup'
                ? 'true'
                : schedulePickupFilter === 'standard'
                  ? 'false'
                  : undefined,
            assigneeId: scheduleAssigneeFilter,
            search: scheduleSearch || undefined,
          })}`
        );
        if (!mounted) return;
        setScheduleBoard(data);
        setSelectedScheduleJobId((current) => {
          if (current && data.groups.some((group) => group.jobs.some((job) => job.id === current))) {
            return current;
          }
          return data.groups[0]?.jobs[0]?.id || null;
        });
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Failed to load schedule board';
        if (mounted) setError(message);
      } finally {
        if (mounted) setScheduleLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [
    scheduleAssigneeFilter,
    scheduleBookingSourceFilter,
    schedulePaymentFilter,
    schedulePickupFilter,
    schedulePreset,
    scheduleSearch,
    scheduleStatusFilter,
  ]);

  const refreshAll = async () => {
    try {
      setRefreshing(true);
      await loadDashboard();
      await loadScheduleBoard();
      if (selectedClientId) {
        await loadClientDetails(selectedClientId);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Refresh failed';
      setError(message);
    } finally {
      setRefreshing(false);
    }
  };

  const prepareJobFromLead = (lead: Lead) => {
    const matchedOffering =
      getOfferingById(servicesContent, lead.service_catalog_id) || findOfferingByTitle(servicesContent, lead.service_type);
    const serviceCatalogId = matchedOffering?.id || (lead.service_type ? 'custom' : '');
    const serviceAddonIds = lead.service_addon_ids || [];
    const customServiceType = matchedOffering ? '' : lead.service_type || '';
    const serviceDisplay = getLeadServiceDisplay(lead);
    const intakeNotes = buildLeadConversionNotes(lead, serviceDisplay);

    setSelectedLeadId(lead.id);
    setActiveTab('jobs');
    setJobForm({
      clientId: '',
      clientName: lead.name,
      serviceType: lead.service_type || '',
      serviceCatalogId,
      serviceAddonIds,
      customServiceType,
      scheduledAt: '',
      vehicleMake: lead.vehicle_make || '',
      vehicleModel: lead.vehicle_model || '',
      vehicleYear: lead.vehicle_year ? String(lead.vehicle_year) : '',
      estimatedAmount: getPrefillAmount(serviceCatalogId, serviceAddonIds),
      paymentStatus: 'unpaid',
      notes: intakeNotes,
    });
  };

  const submitLead = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSubmittingLead(true);
      setError(null);
      const servicePayload = buildCatalogServicePayload(
        leadForm.serviceCatalogId,
        leadForm.serviceAddonIds,
        leadForm.customServiceType
      );
      await apiRequest('/api/leads', {
        method: 'POST',
        body: JSON.stringify({
          name: leadForm.name,
          phone: leadForm.phone,
          email: leadForm.email || undefined,
          serviceType: servicePayload.serviceType,
          serviceCatalogId: servicePayload.serviceCatalogId,
          serviceAddonIds: servicePayload.serviceAddonIds,
          sourcePage: 'dashboard',
          status: leadForm.status,
          vehicleMake: leadForm.vehicleMake || null,
          vehicleModel: leadForm.vehicleModel || null,
          vehicleYear: leadForm.vehicleYear ? Number(leadForm.vehicleYear) : null,
        }),
      });
      setLeadForm(emptyLeadForm);
      await refreshAll();
      setActiveTab('leads');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create lead');
    } finally {
      setSubmittingLead(false);
    }
  };

  const updateLeadStatus = async (leadId: string, status: LeadUiStatus) => {
    try {
      await apiRequest(`/api/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await refreshAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update lead');
    }
  };

  const submitJob = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSubmittingJob(true);
      setError(null);
      const jobServicePayload = buildCatalogServicePayload(
        jobForm.serviceCatalogId,
        jobForm.serviceAddonIds,
        jobForm.customServiceType
      );

      if (selectedLead) {
        const selectedLeadServiceDisplay = getLeadServiceDisplay(selectedLead);
        const selectedLeadNotes = buildLeadConversionNotes(selectedLead, selectedLeadServiceDisplay);
        await apiRequest(`/api/leads/${selectedLead.id}/convert`, {
          method: 'POST',
          body: JSON.stringify({
            client: {
              name: selectedLead.name,
              email: selectedLead.email || undefined,
              phone: selectedLead.phone || undefined,
              notes: selectedLeadNotes || undefined,
            },
            serviceJob: {
              clientName: jobForm.clientName || selectedLead.name,
              serviceType: jobServicePayload.serviceType || selectedLead.service_type || 'Detailing',
              serviceCatalogId: jobServicePayload.serviceCatalogId,
              serviceAddonIds: jobServicePayload.serviceAddonIds,
              status: 'scheduled',
              scheduledAt: jobForm.scheduledAt ? new Date(jobForm.scheduledAt).toISOString() : null,
              notes: jobForm.notes || null,
              vehicleMake: jobForm.vehicleMake || null,
              vehicleModel: jobForm.vehicleModel || null,
              vehicleYear: jobForm.vehicleYear ? Number(jobForm.vehicleYear) : null,
              estimatedAmount: jobForm.estimatedAmount ? Number(jobForm.estimatedAmount) : 0,
              paymentStatus: jobForm.paymentStatus,
            },
          }),
        });
        setSelectedLeadId(null);
      } else {
        await apiRequest('/api/service-jobs', {
          method: 'POST',
          body: JSON.stringify({
            clientId: jobForm.clientId || null,
            clientName: jobForm.clientName,
            serviceType: jobServicePayload.serviceType,
            serviceCatalogId: jobServicePayload.serviceCatalogId,
            serviceAddonIds: jobServicePayload.serviceAddonIds,
            status: 'scheduled',
            scheduledAt: jobForm.scheduledAt ? new Date(jobForm.scheduledAt).toISOString() : null,
            vehicleMake: jobForm.vehicleMake || null,
            vehicleModel: jobForm.vehicleModel || null,
            vehicleYear: jobForm.vehicleYear ? Number(jobForm.vehicleYear) : null,
            estimatedAmount: jobForm.estimatedAmount ? Number(jobForm.estimatedAmount) : 0,
            paymentStatus: jobForm.paymentStatus,
            notes: jobForm.notes || null,
          }),
        });
      }

      setJobForm(emptyJobForm);
      await refreshAll();
      setActiveTab('jobs');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save appointment');
    } finally {
      setSubmittingJob(false);
    }
  };

  const updateJob = async (jobId: string, updates: Partial<{ status: JobUiStatus; paymentStatus: JobPaymentStatus }>) => {
    try {
      await apiRequest('/api/service-jobs', {
        method: 'PATCH',
        body: JSON.stringify({
          id: jobId,
          status: updates.status,
          paymentStatus: updates.paymentStatus,
        }),
      });
      await refreshAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update job');
    }
  };

  const saveCustomerNotes = async () => {
    if (!selectedClientId) return;
    try {
      setSavingCustomer(true);
      await apiRequest(`/api/clients/${selectedClientId}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: customerNotes }),
      });
      await refreshAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save customer');
    } finally {
      setSavingCustomer(false);
    }
  };

  const markNotificationRead = async (notificationId: string) => {
    try {
      await apiRequest(`/api/notifications/in-app/${notificationId}/read`, { method: 'PATCH' });
      await refreshAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to mark notification as read');
    }
  };

  const runLeadCopilot = async (leadId: string) => {
    try {
      setAiBusyKey(`lead-copilot:${leadId}`);
      setError(null);
      await apiRequest<AiSuggestionResponse>(`/api/ai/leads/${leadId}/copilot`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await refreshAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate AI copilot summary');
    } finally {
      setAiBusyKey(null);
    }
  };

  const runLeadReplyDraft = async (leadId: string) => {
    try {
      setAiBusyKey(`lead-reply:${leadId}`);
      setError(null);
      const response = await apiRequest<AiSuggestionResponse>(`/api/ai/leads/${leadId}/reply-draft`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const preferredDraft = response.suggestion.drafts.find((draft) => draft.channel === 'email') || response.suggestion.drafts[0];
      if (preferredDraft) {
        setLeadDraftComposer((current) => ({
          ...current,
          [leadId]: {
            channel: preferredDraft.channel,
            subject: preferredDraft.subject,
            body: preferredDraft.body,
          },
        }));
      }
      await refreshAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate AI reply draft');
    } finally {
      setAiBusyKey(null);
    }
  };

  const runJobWorkBrief = async (jobId: string) => {
    try {
      setAiBusyKey(`job-brief:${jobId}`);
      setError(null);
      await apiRequest<AiSuggestionResponse>(`/api/ai/jobs/${jobId}/work-brief`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await refreshAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate job work brief');
    } finally {
      setAiBusyKey(null);
    }
  };

  const runJobAftercareDraft = async (jobId: string) => {
    try {
      setAiBusyKey(`job-aftercare:${jobId}`);
      setError(null);
      await apiRequest<AiSuggestionResponse>(`/api/ai/jobs/${jobId}/aftercare-draft`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await refreshAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate aftercare draft');
    } finally {
      setAiBusyKey(null);
    }
  };

  const runManagerBrief = async (scope: 'daily' | 'weekly') => {
    try {
      setAiBusyKey(`manager-brief:${scope}`);
      setError(null);
      const response = await apiRequest<AiSuggestionResponse>('/api/ai/daily-brief', {
        method: 'POST',
        body: JSON.stringify({ scope }),
      });
      if (scope === 'daily') {
        setDailyBrief(response.suggestion);
      } else {
        setWeeklyBrief(response.suggestion);
      }
      await refreshAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate manager brief');
    } finally {
      setAiBusyKey(null);
    }
  };

  const applyAiRun = async (runId: string, actionIndex = 0) => {
    try {
      setAiBusyKey(`apply-run:${runId}:${actionIndex}`);
      setError(null);
      await apiRequest(`/api/ai/runs/${runId}/apply`, {
        method: 'POST',
        body: JSON.stringify({ actionIndex }),
      });
      await refreshAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to apply AI suggestion');
    } finally {
      setAiBusyKey(null);
    }
  };

  const dismissAiRunAction = async (runId: string) => {
    try {
      setAiBusyKey(`dismiss-run:${runId}`);
      setError(null);
      await apiRequest(`/api/ai/runs/${runId}/dismiss`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await refreshAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to dismiss AI run');
    } finally {
      setAiBusyKey(null);
    }
  };

  const copyDraftToClipboard = async (leadId: string) => {
    const draft = leadDraftComposer[leadId];
    if (!draft?.body || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(
        draft.subject ? `Subject: ${draft.subject}\n\n${draft.body}` : draft.body
      );
      setCopiedDraftKey(leadId);
      window.setTimeout(() => setCopiedDraftKey((current) => (current === leadId ? null : current)), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy draft');
    }
  };

  const submitOpsChatQuestion = async (questionOverride?: string) => {
    const question = (questionOverride ?? opsChatInput).trim();
    if (!question || opsChatSubmitting) return;

    const userMessage: OpsChatMessage = {
      id: createOpsChatMessageId(),
      role: 'user',
      content: question,
    };

    const history = opsChatMessages
      .slice(-6)
      .map(({ role, content }) => ({ role, content }));

    setOpsChatSubmitting(true);
    setError(null);
    setOpsChatMessages((current) => [...current, userMessage]);
    setOpsChatInput('');

    try {
      const response = await apiRequest<OpsChatResponse>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ question, history }),
      });

      setOpsChatMessages((current) => [
        ...current,
        {
          id: createOpsChatMessageId(),
          role: 'assistant',
          content: response.answer,
          supportingFacts: response.supportingFacts,
          followUpQuestions: response.followUpQuestions,
          mode: response.mode,
          warning: response.warning || null,
        },
      ]);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to ask ops copilot';
      setError(message);
      setOpsChatMessages((current) => [
        ...current,
        {
          id: createOpsChatMessageId(),
          role: 'assistant',
          content:
            'I could not answer that question right now. Refresh the dashboard data and try again.',
          supportingFacts: [message],
          followUpQuestions: [],
          mode: 'fallback',
          warning: message,
        },
      ]);
    } finally {
      setOpsChatSubmitting(false);
    }
  };

  const openSchedulePreset = (preset: SchedulePreset, extras?: Partial<{
    status: 'all' | JobUiStatus;
    paymentStatus: 'all' | JobPaymentStatus;
    bookingSource: 'all' | 'public' | 'ops';
    pickup: 'all' | 'pickup' | 'standard';
  }>) => {
    setActiveTab('jobs');
    setSchedulePreset(preset);
    if (extras?.status) setScheduleStatusFilter(extras.status);
    if (extras?.paymentStatus) setSchedulePaymentFilter(extras.paymentStatus);
    if (extras?.bookingSource) setScheduleBookingSourceFilter(extras.bookingSource);
    if (extras?.pickup) setSchedulePickupFilter(extras.pickup);
  };

  const handleCommandCenterAction = (action: CommandCenterResponse['urgentActions'][number]) => {
    if (action.kind === 'lead') {
      const lead = leads.find((item) => item.id === action.targetId);
      setActiveTab('leads');
      if (lead) {
        prepareJobFromLead(lead);
      }
      return;
    }

    if (action.kind === 'job') {
      setActiveTab('jobs');
      setSelectedScheduleJobId(action.targetId);
      return;
    }

    if (action.kind === 'notification') {
      void markNotificationRead(action.targetId);
      return;
    }

    if (action.kind === 'ai') {
      setActiveTab('notifications');
    }
  };

  const toggleScheduleGroup = useCallback((groupKey: string) => {
    setCollapsedScheduleGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }));
  }, []);

  const setAllScheduleGroupsCollapsed = useCallback(
    (collapsed: boolean) => {
      setCollapsedScheduleGroups(
        (scheduleBoard?.groups || []).reduce<Record<string, boolean>>((accumulator, group) => {
          accumulator[group.key] = collapsed;
          return accumulator;
        }, {})
      );
    },
    [scheduleBoard]
  );

  const sortedJobs = useMemo(
    () =>
      [...jobs]
        .filter((job) => job.ui_status !== 'cancelled')
        .sort((a, b) => (a.scheduled_at || '').localeCompare(b.scheduled_at || '')),
    [jobs]
  );

  const isDarkMode = dashboardTheme === 'dark';

  return (
    <AuthGate title="Operations Dashboard">
      <div className={`dashboard-shell mx-auto max-w-[92rem] space-y-6 px-4 py-6 sm:px-6 lg:px-8 ${isDarkMode ? 'dashboard-shell--dark' : ''}`}>
        <div className="dashboard-header sticky top-3 z-20 space-y-4 rounded-[32px] border border-neutral-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(255,249,244,0.96)_38%,rgba(248,250,252,0.98)_100%)] p-5 shadow-[0_24px_90px_rgba(15,23,42,0.10)] backdrop-blur">
          {showDashboardChrome ? (
            <>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-mclaren">Internal Operations</p>
                  <h1 className="mt-2 font-display text-4xl font-semibold uppercase text-brand-black">Service Dashboard</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
                    Command center for intake, scheduling, customer history, payment follow-up, AI review, and day-of-service execution.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="dashboard-header-card rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm shadow-sm">
                    <div className="font-semibold text-brand-black">{auth?.email || 'Signed in'}</div>
                    <div className="text-gray-500">Role: {auth?.role || '-'}</div>
                  </div>
                  <div className="dashboard-header-card rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm shadow-sm">
                    <div className="font-semibold text-brand-black">{lastRefreshedAt ? fmtTime(lastRefreshedAt) : 'Not synced yet'}</div>
                    <div className="text-gray-500">Last refresh</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDashboardTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
                    className="dashboard-theme-toggle inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-brand-black hover:text-brand-black"
                  >
                    {isDarkMode ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    {isDarkMode ? 'Light mode' : 'Dark mode'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('leads')}
                    className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-brand-mclaren hover:text-brand-mclaren"
                  >
                    <Users className="h-4 w-4" />
                    New lead
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('copilot')}
                    className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-brand-mclaren hover:text-brand-mclaren"
                  >
                    <Bot className="h-4 w-4" />
                    Open copilot
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDashboardChrome(false)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-brand-black hover:text-brand-black"
                  >
                    <ChevronUp className="h-4 w-4" />
                    Hide bar
                  </button>
                  <button
                    type="button"
                    onClick={refreshAll}
                    className="inline-flex items-center gap-2 rounded-2xl bg-brand-mclaren px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-mclaren-dark"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                <InsightCard
                  eyebrow="Today"
                  title={`${metrics.jobsScheduledToday} scheduled ${metrics.jobsScheduledToday === 1 ? 'job' : 'jobs'}`}
                  body={
                    <>
                      <span className="font-semibold text-brand-black">{metrics.activeCustomers}</span> active customers are in service, and
                      <span className="font-semibold text-brand-black"> {metrics.newCustomersOrLeadsToday}</span> new leads or customers came in today.
                    </>
                  }
                  detail="Open today's schedule"
                  onClick={() => openSchedulePreset('today', { status: 'all' })}
                />
                <InsightCard
                  eyebrow="Attention Queue"
                  title={`${commandCenter?.summary.urgentActionCount || 0} items need attention`}
                  body={
                    <>
                      <span className="font-semibold text-brand-black">{commandCenter?.summary.openRequestCount || 0}</span> booking requests are still open,
                      <span className="font-semibold text-brand-black"> {metrics.unreadNotifications}</span> notifications are unread, and
                      <span className="font-semibold text-brand-black"> {commandCenter?.summary.aiReviewCount || reviewRequiredRuns.length}</span> AI items still need review.
                    </>
                  }
                  detail="Go to daily overview"
                  onClick={() => setActiveTab('overview')}
                />
                <InsightCard
                  eyebrow="Revenue Outlook"
                  title={currency(metrics.expectedRevenueToday)}
                  body={
                    <>
                      Today's expected revenue is shown above, while the booked pipeline currently sits at
                      <span className="font-semibold text-brand-black"> {currency(metrics.expectedRevenueTotal)}</span>.
                      Unpaid follow-up is
                      <span className="font-semibold text-brand-black"> {currency(commandCenter?.summary.unpaidRevenueTotal || 0)}</span>.
                    </>
                  }
                  detail="Open payment follow-up"
                  accent
                  onClick={() => setActiveTab('payments')}
                />
              </div>

              <div className="dashboard-tabrail flex flex-wrap gap-2 rounded-[24px] border border-neutral-200/70 bg-white/70 p-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = tab.id === activeTab;
                  const count = tabCounts[tab.id];
                  const showCount = ['overview', 'leads', 'payments', 'notifications'].includes(tab.id) && count > 0;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        isActive
                          ? 'border-brand-mclaren bg-brand-mclaren text-white shadow-sm'
                          : 'border-transparent bg-transparent text-gray-700 hover:border-brand-mclaren/30 hover:bg-white hover:text-brand-mclaren'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                      {showCount && (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${isActive ? 'bg-white/15 text-white' : 'bg-neutral-100 text-gray-500'}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-mclaren">Workspace Bar Hidden</div>
                <div className="mt-1 text-sm text-gray-600">
                  {tabs.find((tab) => tab.id === activeTab)?.label || 'Dashboard'} | Last refresh {lastRefreshedAt ? fmtTime(lastRefreshedAt) : 'not synced yet'}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDashboardTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
                  className="dashboard-theme-toggle inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-brand-black hover:text-brand-black"
                >
                  {isDarkMode ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {isDarkMode ? 'Light mode' : 'Dark mode'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDashboardChrome(true)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-brand-black hover:text-brand-black"
                >
                  <ChevronDown className="h-4 w-4" />
                  Show bar
                </button>
                <button
                  type="button"
                  onClick={refreshAll}
                  className="inline-flex items-center gap-2 rounded-2xl bg-brand-mclaren px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-mclaren-dark"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-[28px] border border-neutral-200 bg-white p-8 text-sm text-gray-600 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            Loading dashboard...
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="grid gap-6 xl:grid-cols-[1.14fr_0.86fr]">
                <div className="space-y-6">
                  <Panel title="Urgent Actions" subtitle="What needs attention first">
                    {commandCenter ? (
                      <div className="space-y-3">
                        {commandCenter.urgentActions.length ? (
                          commandCenter.urgentActions.map((action) => (
                            <button
                              key={action.id}
                              type="button"
                              onClick={() => handleCommandCenterAction(action)}
                              className="flex w-full items-start justify-between gap-4 rounded-2xl border border-neutral-200 px-4 py-4 text-left transition hover:border-brand-mclaren hover:bg-brand-mclaren/5"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <StatusBadge
                                    status={
                                      action.urgency === 'high'
                                        ? 'closed_lost'
                                        : action.urgency === 'medium'
                                          ? 'booked'
                                          : 'scheduled'
                                    }
                                    label={action.urgency}
                                  />
                                  <div className="font-semibold text-brand-black">{action.title}</div>
                                </div>
                                <div className="mt-2 text-sm text-gray-600">{action.subtitle}</div>
                              </div>
                              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-mclaren">
                                {action.actionLabel}
                              </span>
                            </button>
                          ))
                        ) : (
                          <EmptyState message="No urgent actions right now." />
                        )}
                      </div>
                    ) : (
                      <EmptyState message="Command center data is not available." />
                    )}
                  </Panel>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <Panel title="Today" subtitle="Live schedule with quick actions">
                      {commandCenter?.todaySchedule.length ? (
                        <div className="space-y-3">
                          {commandCenter.todaySchedule.map((job) => (
                            <div key={job.id} className="rounded-2xl border border-neutral-200 px-4 py-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-brand-black">{job.clientName}</div>
                                  <div className="mt-1 text-sm text-gray-600">{job.serviceType}</div>
                                  <div className="mt-1 text-xs text-gray-500">{fmtTime(job.scheduledAt)} | {currency(job.estimatedAmount)}</div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <StatusBadge status={job.uiStatus} label={jobStatusLabel[job.uiStatus]} />
                                  <StatusBadge status={job.paymentStatus} label={job.paymentStatus.toUpperCase()} />
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveTab('jobs');
                                    setSelectedScheduleJobId(job.id);
                                  }}
                                  className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:border-brand-mclaren hover:text-brand-mclaren"
                                >
                                  Open job
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateJob(job.id, {
                                      paymentStatus: job.paymentStatus === 'paid' ? 'unpaid' : 'paid',
                                    })
                                  }
                                  className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:border-brand-mclaren hover:text-brand-mclaren"
                                >
                                  Mark {job.paymentStatus === 'paid' ? 'Unpaid' : 'Paid'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState message="No work is scheduled today." />
                      )}
                    </Panel>

                    <Panel title="Next Up" subtitle="Upcoming jobs across the next few days">
                      {commandCenter?.nextUp.length ? (
                        <div className="space-y-3">
                          {commandCenter.nextUp.map((job) => (
                            <button
                              key={job.id}
                              type="button"
                              onClick={() => {
                                setActiveTab('jobs');
                                setSelectedScheduleJobId(job.id);
                              }}
                              className="w-full rounded-2xl border border-neutral-200 px-4 py-4 text-left transition hover:border-brand-mclaren hover:bg-brand-mclaren/5"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-brand-black">{job.clientName}</div>
                                  <div className="mt-1 text-sm text-gray-600">{job.serviceType}</div>
                                  <div className="mt-1 text-xs text-gray-500">{job.dayLabel || fmtDate(job.scheduledAt)} | {fmtTime(job.scheduledAt)}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-semibold text-brand-black">{currency(job.estimatedAmount)}</div>
                                  <div className="mt-1 text-xs text-gray-500">{job.pickupRequested ? 'Pickup' : 'Standard'}</div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <EmptyState message="No upcoming jobs in the current window." />
                      )}
                    </Panel>
                  </div>

                  <Panel title="Revenue Focus" subtitle="Expected totals and unpaid follow-up">
                    {commandCenter ? (
                      <div className="grid gap-4 lg:grid-cols-[0.88fr_1.12fr]">
                        <div className="grid gap-4">
                          <InsightCard
                            eyebrow="Today's Target"
                            title={currency(commandCenter.summary.expectedRevenueToday)}
                            body={
                              <>
                                This is the revenue expected from today's booked work.
                                <span className="font-semibold text-brand-black"> {metrics.jobsScheduledToday}</span> jobs are on deck for today.
                              </>
                            }
                            accent
                          />
                          <InsightCard
                            eyebrow="What Still Needs Follow-up"
                            title={currency(commandCenter.summary.unpaidRevenueTotal)}
                            body={
                              <>
                                Unpaid follow-up is outstanding across the queue. There are
                                <span className="font-semibold text-brand-black"> {commandCenter.summary.openRequestCount}</span> open requests and
                                <span className="font-semibold text-brand-black"> {commandCenter.summary.aiReviewCount}</span> AI items still waiting on human review.
                              </>
                            }
                          />
                        </div>
                        <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Highest Value Unpaid</div>
                          <div className="mt-3 space-y-3">
                            {commandCenter.revenueFocus.highestValueUnpaidJobs.length ? (
                              commandCenter.revenueFocus.highestValueUnpaidJobs.map((job) => (
                                <button
                                  key={job.id}
                                  type="button"
                                  onClick={() => {
                                    setActiveTab('payments');
                                  }}
                                  className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-left transition hover:border-brand-mclaren hover:text-brand-mclaren"
                                >
                                  <div>
                                    <div className="font-semibold text-brand-black">{job.clientName}</div>
                                    <div className="mt-1 text-sm text-gray-600">{job.serviceType}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-semibold text-brand-black">{currency(job.estimatedAmount)}</div>
                                    <div className="mt-1 text-xs text-gray-500">{fmtDate(job.scheduledAt)}</div>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <EmptyState message="No unpaid bookings are queued right now." />
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <EmptyState message="Revenue focus is not available." />
                    )}
                  </Panel>
                </div>

                <div className="space-y-6">
                  <Panel title="Open Requests" subtitle="Request-mode leads ready for follow-up or conversion">
                    {commandCenter?.openRequests.length ? (
                      <div className="space-y-3">
                        {commandCenter.openRequests.map((lead) => (
                          <div key={lead.id} className="rounded-2xl border border-neutral-200 px-4 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-semibold text-brand-black">{lead.name}</div>
                                <div className="mt-1 text-sm text-gray-600">{lead.serviceType || 'Service request'}</div>
                                <div className="mt-1 text-xs text-gray-500">{fmtRelative(lead.createdAt)} | {lead.phone || 'No phone'}</div>
                              </div>
                              <StatusBadge status="new_lead" label="Request" />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const fullLead = leads.find((item) => item.id === lead.id);
                                  if (fullLead) {
                                    prepareJobFromLead(fullLead);
                                  } else {
                                    setActiveTab('leads');
                                  }
                                }}
                                className="rounded-xl border border-brand-mclaren px-3 py-2 text-xs font-semibold text-brand-mclaren hover:bg-brand-mclaren hover:text-white"
                              >
                                Prepare booking
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveTab('copilot')}
                                className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:border-brand-mclaren hover:text-brand-mclaren"
                              >
                                Ask copilot
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState message="No request-mode leads currently need action." />
                    )}
                  </Panel>

                  <Panel title="Recent Activity" subtitle="Cross-entity updates across leads, jobs, payments, notifications, and AI">
                    {activityFeed.length ? (
                      <div className="space-y-3">
                        {activityFeed.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-neutral-200 px-4 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-semibold text-brand-black">{item.title}</div>
                                <div className="mt-1 text-sm text-gray-600">{item.subtitle}</div>
                                <div className="mt-2 text-xs text-gray-500">{item.meta} | {fmtRelative(item.createdAt)}</div>
                              </div>
                              <StatusBadge
                                status={
                                  item.kind === 'payment'
                                    ? 'paid'
                                    : item.kind === 'notification'
                                      ? 'new_lead'
                                      : item.kind === 'ai'
                                        ? 'booked'
                                        : 'scheduled'
                                }
                                label={item.kind.replace(/_/g, ' ')}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState message="Recent activity will appear here." />
                    )}
                  </Panel>

                  <Panel title="Inbox and AI Review" subtitle="Unread notifications and review-required AI outputs">
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Unread Notifications</div>
                        {commandCenter?.unreadNotifications.length ? (
                          commandCenter.unreadNotifications.map((notification) => (
                            <div key={notification.id} className="rounded-2xl border border-neutral-200 px-4 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-brand-black">{notification.title}</div>
                                  <div className="mt-1 text-sm text-gray-600">{notification.message}</div>
                                  <div className="mt-1 text-xs text-gray-500">{fmtDateTime(notification.created_at)}</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => markNotificationRead(notification.id)}
                                  className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:border-brand-mclaren hover:text-brand-mclaren"
                                >
                                  Mark read
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <EmptyState message="No unread notifications." />
                        )}
                      </div>
                      <div className="space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">AI Review Queue</div>
                        {commandCenter?.aiReviewRuns.length ? (
                          commandCenter.aiReviewRuns.map((run) => (
                            <div key={run.id} className="rounded-2xl border border-neutral-200 px-4 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-brand-black">{run.feature_name.replace(/_/g, ' ')}</div>
                                  <div className="mt-1 text-sm text-gray-600">{run.entity_type} | {run.entity_id}</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('notifications')}
                                  className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:border-brand-mclaren hover:text-brand-mclaren"
                                >
                                  Review
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <EmptyState message="No AI outputs need review." />
                        )}
                      </div>
                    </div>
                  </Panel>
                </div>
              </div>
            )}

            {activeTab === 'leads' && (
              <div className="grid gap-6 lg:grid-cols-[1.16fr_0.84fr]">
                <Panel title="Lead Triage Queue" subtitle={`Showing ${leadPagination?.total || leads.length} recent leads`}>
                  <div className="space-y-4">
                    {leads.length ? (
                      leads.map((lead) => {
                        const copilotState = readAiFeatureState(lead.ai_metadata, 'copilot');
                        const replyDraftState = readAiFeatureState(lead.ai_metadata, 'replyDraft');
                        const activeComposer = leadDraftComposer[lead.id];

                        return (
                          <div key={lead.id} className="rounded-[24px] border border-neutral-200 bg-white p-4 shadow-sm">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="font-semibold text-brand-black">{lead.name}</div>
                                  <StatusBadge status={lead.ui_status || 'new_lead'} />
                                  {lead.booking_mode && (
                                    <StatusBadge
                                      status={lead.booking_mode === 'instant' ? 'scheduled' : 'new_lead'}
                                      label={lead.booking_mode === 'instant' ? 'Instant booking' : 'Request booking'}
                                    />
                                  )}
                                  {getLeadPickupRequested(lead) && <StatusBadge status="booked" label="Pickup requested" />}
                                </div>
                                <div className="mt-2 text-sm text-gray-600">
                                  {lead.phone || '-'}{lead.email ? ` | ${lead.email}` : ''} | {fmtRelative(lead.created_at)}
                                </div>
                                <div className="mt-3 text-sm font-medium text-brand-black">{getLeadServiceDisplay(lead)}</div>
                                <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                                  <span>{vehicleLabel(lead)}</span>
                                  {getLeadPreferredSummary(lead) && <span>Preferred: {getLeadPreferredSummary(lead)}</span>}
                                  {getLeadPhotoCount(lead) > 0 && <span>{getLeadPhotoCount(lead)} photo{getLeadPhotoCount(lead) === 1 ? '' : 's'}</span>}
                                </div>
                                {(getLeadIssueDetails(lead) || getLeadNotes(lead)) && (
                                  <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-gray-600">
                                    {getLeadIssueDetails(lead) || getLeadNotes(lead)}
                                  </div>
                                )}
                                {getLeadPickupRequested(lead) && getLeadPickupAddressSummary(lead) && (
                                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                    Pickup address: {getLeadPickupAddressSummary(lead)}
                                  </div>
                                )}
                              </div>

                              <div className="w-full space-y-3 xl:w-[23rem]">
                                <AiStateSummary
                                  state={copilotState}
                                  emptyMessage="No AI triage yet. Generate a grounded summary to surface missing info and the recommended next step."
                                />
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => runLeadCopilot(lead.id)}
                                    disabled={aiBusyKey === `lead-copilot:${lead.id}`}
                                    className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:border-brand-mclaren hover:text-brand-mclaren disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {aiBusyKey === `lead-copilot:${lead.id}` ? 'Generating...' : 'Run Copilot'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => runLeadReplyDraft(lead.id)}
                                    disabled={aiBusyKey === `lead-reply:${lead.id}`}
                                    className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:border-brand-mclaren hover:text-brand-mclaren disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {aiBusyKey === `lead-reply:${lead.id}` ? 'Drafting...' : 'Draft Reply'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => prepareJobFromLead(lead)}
                                    className="rounded-xl border border-brand-mclaren px-3 py-2 text-xs font-semibold text-brand-mclaren hover:bg-brand-mclaren hover:text-white"
                                  >
                                    {lead.booking_mode === 'request' ? 'Prepare booking' : 'Book appointment'}
                                  </button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <select
                                    value={lead.ui_status || 'new_lead'}
                                    onChange={(event) => updateLeadStatus(lead.id, event.target.value as LeadUiStatus)}
                                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                                  >
                                    <option value="new_lead">New Lead</option>
                                    <option value="booked">Booked</option>
                                    <option value="service_completed">Service Completed</option>
                                    <option value="closed_lost">Closed Lost</option>
                                  </select>
                                  {copilotState?.runId && copilotState.actions?.length ? (
                                    <button
                                      type="button"
                                      onClick={() => applyAiRun(copilotState.runId, 0)}
                                      disabled={aiBusyKey === `apply-run:${copilotState.runId}:0`}
                                      className="rounded-xl bg-brand-black px-3 py-2 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      Apply
                                    </button>
                                  ) : null}
                                </div>
                                {(replyDraftState?.drafts.length || activeComposer) && (
                                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Reply Draft</div>
                                      <div className="flex flex-wrap gap-2">
                                        {(replyDraftState?.drafts || []).map((draft) => (
                                          <button
                                            key={`${lead.id}-${draft.channel}`}
                                            type="button"
                                            onClick={() =>
                                              setLeadDraftComposer((current) => ({
                                                ...current,
                                                [lead.id]: {
                                                  channel: draft.channel,
                                                  subject: draft.subject,
                                                  body: draft.body,
                                                },
                                              }))
                                            }
                                            className="rounded-full border border-neutral-200 px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:border-brand-mclaren hover:text-brand-mclaren"
                                          >
                                            {draft.channel.toUpperCase()}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    {activeComposer ? (
                                      <div className="mt-3 space-y-3">
                                        {activeComposer.subject && (
                                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-gray-600">
                                            <span className="font-semibold text-brand-black">Subject:</span> {activeComposer.subject}
                                          </div>
                                        )}
                                        <TextArea
                                          value={activeComposer.body}
                                          onChange={(value) =>
                                            setLeadDraftComposer((current) => ({
                                              ...current,
                                              [lead.id]: {
                                                ...current[lead.id],
                                                body: value,
                                              },
                                            }))
                                          }
                                          rows={5}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => copyDraftToClipboard(lead.id)}
                                          className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:border-brand-mclaren hover:text-brand-mclaren"
                                        >
                                          <Clipboard className="h-3.5 w-3.5" />
                                          {copiedDraftKey === lead.id ? 'Copied' : 'Copy Draft'}
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="mt-3 text-xs text-gray-500">Generate a reply draft to edit it here.</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <EmptyState message="No recent leads are waiting in the queue." />
                    )}
                  </div>
                </Panel>

                <Panel title="Add New Lead" subtitle="Capture intake details from calls, walk-ins, or messages">
                  <form className="space-y-4" onSubmit={submitLead}>
                    <Input label="Customer Name" value={leadForm.name} onChange={(value) => setLeadForm((current) => ({ ...current, name: value }))} required />
                    <Input label="Phone Number" value={leadForm.phone} onChange={(value) => setLeadForm((current) => ({ ...current, phone: value }))} required />
                    <Input label="Email (optional)" value={leadForm.email} onChange={(value) => setLeadForm((current) => ({ ...current, email: value }))} />
                    <ServiceCatalogField
                      label="Service Requested"
                      serviceCatalogId={leadForm.serviceCatalogId}
                      serviceAddonIds={leadForm.serviceAddonIds}
                      customServiceType={leadForm.customServiceType}
                      groupedPrimaryOfferings={groupedPrimaryServiceOfferings}
                      addOnOfferings={addOnServiceOfferings}
                      onServiceCatalogIdChange={(value) =>
                        syncLeadServiceSelection({
                          serviceCatalogId: value,
                          serviceAddonIds: value === 'custom' ? [] : leadForm.serviceAddonIds,
                        })
                      }
                      onServiceAddonIdsChange={(value) =>
                        syncLeadServiceSelection({
                          serviceAddonIds: value,
                        })
                      }
                      onCustomServiceTypeChange={(value) =>
                        syncLeadServiceSelection({
                          customServiceType: value,
                        })
                      }
                    />
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Input label="Vehicle Make" value={leadForm.vehicleMake} onChange={(value) => setLeadForm((current) => ({ ...current, vehicleMake: value }))} />
                      <Input label="Vehicle Model" value={leadForm.vehicleModel} onChange={(value) => setLeadForm((current) => ({ ...current, vehicleModel: value }))} />
                      <Input label="Vehicle Year" value={leadForm.vehicleYear} onChange={(value) => setLeadForm((current) => ({ ...current, vehicleYear: value }))} />
                    </div>
                    <Select
                      label="Lead Status"
                      value={leadForm.status}
                      onChange={(value) => setLeadForm((current) => ({ ...current, status: value as LeadUiStatus }))}
                      options={[
                        { value: 'new_lead', label: 'New Lead' },
                        { value: 'booked', label: 'Booked' },
                        { value: 'service_completed', label: 'Service Completed' },
                      ]}
                    />
                    <button
                      type="submit"
                      disabled={submittingLead}
                      className="w-full rounded-2xl bg-brand-mclaren px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-mclaren-dark disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submittingLead ? 'Saving Lead...' : 'Save Lead'}
                    </button>
                  </form>
                </Panel>
              </div>
            )}

            {activeTab === 'jobs' && (
              <div className="space-y-6">
                <Panel title="Schedule Board" subtitle="Compact board and queue views with inline actions for the day-to-day operator workflow">
                  <div className="space-y-5">
                    <div className="rounded-[28px] border border-brand-black/10 bg-[linear-gradient(135deg,#fff9f4_0%,#ffffff_42%,#f8fafc_100%)] p-4 sm:p-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                        <div className="space-y-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-mclaren">Operator Range</div>
                          <div className="text-2xl font-semibold text-brand-black">{schedulePresetLabel[schedulePreset]}</div>
                          <div className="max-w-2xl text-sm text-gray-600">
                            Switch between quick windows, then expand or collapse each day as needed while keeping the dense queue one click away.
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[29rem]">
                          <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">In View</div>
                            <div className="mt-2 text-2xl font-semibold text-brand-black">{scheduleBoard?.summary.totalJobs || 0}</div>
                            <div className="mt-1 text-xs text-gray-500">Jobs in the current working range</div>
                          </div>
                          <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Unpaid Follow-up</div>
                            <div className="mt-2 text-2xl font-semibold text-brand-black">{scheduleBoard?.summary.unpaidJobs || 0}</div>
                            <div className="mt-1 text-xs text-gray-500">Needs payment confirmation</div>
                          </div>
                          <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Pickup Logistics</div>
                            <div className="mt-2 text-2xl font-semibold text-brand-black">{scheduleBoard?.summary.pickupJobs || 0}</div>
                            <div className="mt-1 text-xs text-gray-500">Requires transport handling</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[26px] border border-neutral-200 bg-neutral-50/80 p-4">
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(schedulePresetLabel) as SchedulePreset[]).map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setSchedulePreset(preset)}
                            className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                              schedulePreset === preset
                                ? 'border-brand-mclaren bg-brand-mclaren text-white'
                                : 'border-neutral-200 bg-white text-gray-600 hover:border-brand-mclaren hover:text-brand-mclaren'
                            }`}
                          >
                            {schedulePresetLabel[preset]}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setScheduleViewMode('board')}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] ${
                            scheduleViewMode === 'board'
                              ? 'border-brand-black bg-brand-black text-white'
                              : 'border-neutral-200 bg-white text-gray-600'
                          }`}
                        >
                          <LayoutGrid className="h-3.5 w-3.5" />
                          Board
                        </button>
                        <button
                          type="button"
                          onClick={() => setScheduleViewMode('table')}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] ${
                            scheduleViewMode === 'table'
                              ? 'border-brand-black bg-brand-black text-white'
                              : 'border-neutral-200 bg-white text-gray-600'
                          }`}
                        >
                          <TableProperties className="h-3.5 w-3.5" />
                          Table
                        </button>
                        <button
                          type="button"
                          onClick={() => setAllScheduleGroupsCollapsed(false)}
                          className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-600 hover:border-brand-black hover:text-brand-black"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                          Expand
                        </button>
                        <button
                          type="button"
                          onClick={() => setAllScheduleGroupsCollapsed(true)}
                          className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-600 hover:border-brand-black hover:text-brand-black"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                          Collapse
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-4 rounded-[26px] border border-neutral-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-3">
                      <Select
                        label="Job State"
                        value={scheduleStatusFilter}
                        onChange={(value) => setScheduleStatusFilter(value as 'all' | JobUiStatus)}
                        options={[
                          { value: 'all', label: 'All states' },
                          { value: 'scheduled', label: 'Scheduled' },
                          { value: 'completed', label: 'Completed' },
                          { value: 'cancelled', label: 'Cancelled' },
                        ]}
                      />
                      <Select
                        label="Payment"
                        value={schedulePaymentFilter}
                        onChange={(value) => setSchedulePaymentFilter(value as 'all' | JobPaymentStatus)}
                        options={[
                          { value: 'all', label: 'All payments' },
                          { value: 'unpaid', label: 'Unpaid' },
                          { value: 'paid', label: 'Paid' },
                        ]}
                      />
                      <Select
                        label="Booking Source"
                        value={scheduleBookingSourceFilter}
                        onChange={(value) => setScheduleBookingSourceFilter(value as 'all' | 'public' | 'ops')}
                        options={[
                          { value: 'all', label: 'All sources' },
                          { value: 'public', label: 'Public booking' },
                          { value: 'ops', label: 'Ops booking' },
                        ]}
                      />
                      <Select
                        label="Pickup"
                        value={schedulePickupFilter}
                        onChange={(value) => setSchedulePickupFilter(value as 'all' | 'pickup' | 'standard')}
                        options={[
                          { value: 'all', label: 'All jobs' },
                          { value: 'pickup', label: 'Pickup requested' },
                          { value: 'standard', label: 'Standard drop-off' },
                        ]}
                      />
                      <Select
                        label="Assignee"
                        value={scheduleAssigneeFilter}
                        onChange={setScheduleAssigneeFilter}
                        options={(scheduleBoard?.filters.assignees || [{ id: 'all', label: 'All assignees', count: 0 }]).map((option) => ({
                          value: option.id,
                          label: `${option.label}${option.id === 'all' ? '' : ` (${option.count})`}`,
                        }))}
                      />
                      <Input label="Search" value={scheduleSearch} onChange={setScheduleSearch} placeholder="Search customer, service, notes, vehicle" />
                    </div>

                    {scheduleBoard && (
                      <div className="grid gap-4 md:grid-cols-4">
                        <MetricCard label="Jobs in View" value={scheduleBoard.summary.totalJobs} helper="Current filter result" />
                        <MetricCard label="Unpaid" value={scheduleBoard.summary.unpaidJobs} helper="Payment follow-up required" />
                        <MetricCard label="Pickup" value={scheduleBoard.summary.pickupJobs} helper="Logistics flagged" />
                        <MetricCard label="Completed" value={scheduleBoard.summary.completedJobs} helper="Closed out in this view" />
                      </div>
                    )}

                    {scheduleLoading ? (
                      <EmptyState message="Loading schedule board..." />
                    ) : scheduleBoard?.groups.length ? (
                      scheduleViewMode === 'board' ? (
                        <div className="space-y-5">
                          {scheduleBoard.groups.map((group) => (
                            <div key={group.key} className="rounded-[24px] border border-neutral-200 bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] p-4">
                              <button
                                type="button"
                                onClick={() => toggleScheduleGroup(group.key)}
                                className="flex w-full items-center justify-between gap-3 text-left"
                              >
                                <div>
                                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{group.label}</div>
                                  <div className="mt-1 text-sm text-gray-600">{group.jobs.length} job{group.jobs.length === 1 ? '' : 's'}</div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-xs text-gray-500">{group.date ? fmtDate(group.date) : 'Unscheduled'}</div>
                                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-gray-600">
                                    {collapsedScheduleGroups[group.key] ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                                  </span>
                                </div>
                              </button>
                              {!collapsedScheduleGroups[group.key] && (
                                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                                  {group.jobs.map((job) => (
                                    <button
                                      key={job.id}
                                      type="button"
                                      onClick={() => setSelectedScheduleJobId(job.id)}
                                      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                                        selectedScheduleJobId === job.id
                                          ? 'border-brand-mclaren bg-white shadow-sm'
                                          : 'border-neutral-200 bg-white hover:border-brand-mclaren hover:bg-brand-mclaren/5'
                                      }`}
                                    >
                                      <div className="flex flex-col gap-4">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <div className="font-semibold text-brand-black">{job.clientName}</div>
                                              <StatusBadge status={job.uiStatus} label={jobStatusLabel[job.uiStatus]} />
                                              <StatusBadge status={job.paymentStatus} label={job.paymentStatus.toUpperCase()} />
                                              {job.pickupRequested && <StatusBadge status="booked" label="Pickup requested" />}
                                            </div>
                                            <div className="mt-2 text-sm text-gray-600">{job.serviceType}</div>
                                          </div>
                                          <div className="text-right">
                                            <div className="text-sm font-semibold text-brand-black">{currency(job.estimatedAmount)}</div>
                                            <div className="mt-1 text-[11px] text-gray-500">{fmtTime(job.scheduledAt)}</div>
                                          </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
                                          <span className="rounded-full bg-neutral-100 px-2.5 py-1">{job.vehicleLabel}</span>
                                          <span className="rounded-full bg-neutral-100 px-2.5 py-1">{job.assigneeLabel}</span>
                                          {job.bookingSource && <span className="rounded-full bg-neutral-100 px-2.5 py-1">{job.bookingSource}</span>}
                                        </div>

                                        {job.notes ? (
                                          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-gray-600">
                                            {job.notes}
                                          </div>
                                        ) : null}

                                        <div className="flex flex-wrap gap-2">
                                          <button
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              updateJob(job.id, {
                                                paymentStatus: job.paymentStatus === 'paid' ? 'unpaid' : 'paid',
                                              });
                                            }}
                                            className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:border-brand-mclaren hover:text-brand-mclaren"
                                          >
                                            {job.paymentStatus === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              updateJob(job.id, {
                                                status: job.uiStatus === 'completed' ? 'scheduled' : 'completed',
                                              });
                                            }}
                                            className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:border-brand-mclaren hover:text-brand-mclaren"
                                          >
                                            {job.uiStatus === 'completed' ? 'Reopen' : 'Complete'}
                                          </button>
                                        </div>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <DataTable
                          columns={['Customer', 'Service', 'When', 'Assignee', 'Status', 'Payment', 'Amount']}
                          rows={scheduleBoard.groups.flatMap((group) =>
                            group.jobs.map((job) => (
                              <tr key={job.id} className="border-t border-neutral-100">
                                <td className="px-4 py-3">
                                  <button type="button" onClick={() => setSelectedScheduleJobId(job.id)} className="text-left font-semibold text-brand-black hover:text-brand-mclaren">
                                    {job.clientName}
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">{job.serviceType}</td>
                                <td className="px-4 py-3 text-sm text-gray-600">{fmtDateTime(job.scheduledAt)}</td>
                                <td className="px-4 py-3 text-sm text-gray-600">{job.assigneeLabel}</td>
                                <td className="px-4 py-3"><StatusBadge status={job.uiStatus} label={jobStatusLabel[job.uiStatus]} /></td>
                                <td className="px-4 py-3"><StatusBadge status={job.paymentStatus} label={job.paymentStatus.toUpperCase()} /></td>
                                <td className="px-4 py-3 text-sm font-semibold text-brand-black">{currency(job.estimatedAmount)}</td>
                              </tr>
                            ))
                          )}
                        />
                      )
                    ) : (
                      <EmptyState message="No jobs match the current board filters." />
                    )}
                  </div>
                </Panel>

                <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
                  <Panel
                    title={selectedScheduleJob ? 'Job Details' : selectedLead ? 'Convert Lead to Appointment' : 'Create Appointment'}
                    subtitle={selectedScheduleJob ? 'Selected job context and quick actions' : selectedLead ? `Booking ${selectedLead.name}` : 'Add a scheduled job directly'}
                  >
                    {selectedScheduleJob ? (
                      <div className="space-y-5">
                        <div className="rounded-[24px] border border-brand-mclaren/20 bg-[#fff4eb] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-lg font-semibold text-brand-black">{selectedScheduleJob.clientName}</div>
                                <StatusBadge status={selectedScheduleJob.uiStatus} label={jobStatusLabel[selectedScheduleJob.uiStatus]} />
                                <StatusBadge status={selectedScheduleJob.paymentStatus} label={selectedScheduleJob.paymentStatus.toUpperCase()} />
                              </div>
                              <div className="mt-2 text-sm text-gray-700">{selectedScheduleJob.serviceType}</div>
                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                                <span>{fmtDateTime(selectedScheduleJob.scheduledAt)}</span>
                                <span>{selectedScheduleJob.vehicleLabel}</span>
                                <span>{selectedScheduleJob.assigneeLabel}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Estimated amount</div>
                              <div className="mt-2 text-2xl font-semibold text-brand-black">{currency(selectedScheduleJob.estimatedAmount)}</div>
                            </div>
                          </div>
                          {selectedScheduleJob.notes && (
                            <div className="mt-4 rounded-2xl border border-white/50 bg-white px-4 py-3 text-sm text-gray-700">{selectedScheduleJob.notes}</div>
                          )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <button
                            type="button"
                            onClick={() => updateJob(selectedScheduleJob.id, { paymentStatus: selectedScheduleJob.paymentStatus === 'paid' ? 'unpaid' : 'paid' })}
                            className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-brand-mclaren hover:text-brand-mclaren"
                          >
                            {selectedScheduleJob.paymentStatus === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateJob(selectedScheduleJob.id, { status: selectedScheduleJob.uiStatus === 'completed' ? 'scheduled' : 'completed' })}
                            className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-brand-mclaren hover:text-brand-mclaren"
                          >
                            {selectedScheduleJob.uiStatus === 'completed' ? 'Reopen Job' : 'Mark Complete'}
                          </button>
                          <button
                            type="button"
                            onClick={() => runJobWorkBrief(selectedScheduleJob.id)}
                            disabled={aiBusyKey === `job-brief:${selectedScheduleJob.id}`}
                            className="rounded-2xl bg-brand-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {aiBusyKey === `job-brief:${selectedScheduleJob.id}` ? 'Generating Brief...' : 'Generate Work Brief'}
                          </button>
                        </div>
                        <AiStateSummary
                          state={readAiFeatureState(selectedScheduleJob.aiMetadata, 'workBrief')}
                          emptyMessage="No work brief yet. Generate one to surface prep notes, risk flags, and customer-history highlights."
                        />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {selectedLead && (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            Booking from lead: <span className="font-semibold">{selectedLead.name}</span>. Saving this form will create the client record and first service job.
                          </div>
                        )}
                        <form className="space-y-4" onSubmit={submitJob}>
                          <Input label="Customer Name" value={jobForm.clientName} onChange={(value) => setJobForm((current) => ({ ...current, clientName: value }))} required />
                          <ServiceCatalogField
                            label="Service Booked"
                            serviceCatalogId={jobForm.serviceCatalogId}
                            serviceAddonIds={jobForm.serviceAddonIds}
                            customServiceType={jobForm.customServiceType}
                            groupedPrimaryOfferings={groupedPrimaryServiceOfferings}
                            addOnOfferings={addOnServiceOfferings}
                            onServiceCatalogIdChange={(value) =>
                              syncJobServiceSelection({
                                serviceCatalogId: value,
                                serviceAddonIds: value === 'custom' ? [] : jobForm.serviceAddonIds,
                              })
                            }
                            onServiceAddonIdsChange={(value) => syncJobServiceSelection({ serviceAddonIds: value })}
                            onCustomServiceTypeChange={(value) => syncJobServiceSelection({ customServiceType: value })}
                          />
                          <Input label="Appointment Date & Time" type="datetime-local" value={jobForm.scheduledAt} onChange={(value) => setJobForm((current) => ({ ...current, scheduledAt: value }))} />
                          <div className="grid gap-4 sm:grid-cols-3">
                            <Input label="Vehicle Make" value={jobForm.vehicleMake} onChange={(value) => setJobForm((current) => ({ ...current, vehicleMake: value }))} />
                            <Input label="Vehicle Model" value={jobForm.vehicleModel} onChange={(value) => setJobForm((current) => ({ ...current, vehicleModel: value }))} />
                            <Input label="Vehicle Year" value={jobForm.vehicleYear} onChange={(value) => setJobForm((current) => ({ ...current, vehicleYear: value }))} />
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Input label="Estimated Amount (CAD)" value={jobForm.estimatedAmount} onChange={(value) => setJobForm((current) => ({ ...current, estimatedAmount: value }))} />
                            <Select
                              label="Payment Status"
                              value={jobForm.paymentStatus}
                              onChange={(value) => setJobForm((current) => ({ ...current, paymentStatus: value as JobPaymentStatus }))}
                              options={[
                                { value: 'unpaid', label: 'Unpaid' },
                                { value: 'paid', label: 'Paid' },
                              ]}
                            />
                          </div>
                          <TextArea label="Notes" value={jobForm.notes} onChange={(value) => setJobForm((current) => ({ ...current, notes: value }))} rows={4} />
                          <div className="flex flex-wrap gap-3">
                            <button
                              type="submit"
                              disabled={submittingJob}
                              className="rounded-2xl bg-brand-mclaren px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-mclaren-dark disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {submittingJob ? 'Saving Appointment...' : 'Save Appointment'}
                            </button>
                            {selectedLead && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedLeadId(null);
                                  setJobForm(emptyJobForm);
                                }}
                                className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:border-brand-mclaren hover:text-brand-mclaren"
                              >
                                Clear Lead
                              </button>
                            )}
                          </div>
                        </form>
                      </div>
                    )}
                  </Panel>

                  <Panel title="Dense Queue" subtitle={`Showing ${jobPagination?.total || jobs.length} recent jobs`}>
                    <DataTable
                      columns={['Customer', 'Service', 'Appointment', 'Status', 'Payment', 'Amount']}
                      rows={jobs.map((job) => (
                        <tr key={job.id} className="border-t border-neutral-100">
                          <td className="px-4 py-3">
                            <button type="button" onClick={() => setSelectedScheduleJobId(job.id)} className="font-semibold text-brand-black hover:text-brand-mclaren">
                              {job.client_name}
                            </button>
                            <div className="mt-1 text-xs text-gray-500">{vehicleLabel(job)}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{getJobServiceDisplay(job)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{fmtDateTime(job.scheduled_at)}</td>
                          <td className="px-4 py-3"><StatusBadge status={job.ui_status || 'scheduled'} label={jobStatusLabel[job.ui_status || 'scheduled']} /></td>
                          <td className="px-4 py-3"><StatusBadge status={job.payment_status || 'unpaid'} label={(job.payment_status || 'unpaid').toUpperCase()} /></td>
                          <td className="px-4 py-3 text-sm font-semibold text-brand-black">{currency(getJobEstimatedAmount(job))}</td>
                        </tr>
                      ))}
                    />
                  </Panel>
                </div>
              </div>
            )}
            {activeTab === 'customers' && (
              <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
                <Panel title="Customer Roster" subtitle={`Showing ${clientPagination?.total || clients.length} active customers`}>
                  <div className="space-y-4">
                    <Input label="Search Customers" value={search} onChange={setSearch} placeholder="Search by name, phone, or email" />
                    <div className="space-y-3">
                      {filteredClients.length ? (
                        filteredClients.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => setSelectedClientId(client.id)}
                            className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                              selectedClientId === client.id
                                ? 'border-brand-mclaren bg-brand-mclaren/5 shadow-sm'
                                : 'border-neutral-200 bg-white hover:border-brand-mclaren/40'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-semibold text-brand-black">{client.name}</div>
                                <div className="mt-1 text-sm text-gray-600">{client.phone || client.email || '-'}</div>
                              </div>
                              {client.tags?.length ? (
                                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                                  {client.tags.length} tag{client.tags.length === 1 ? '' : 's'}
                                </span>
                              ) : null}
                            </div>
                          </button>
                        ))
                      ) : (
                        <EmptyState message="No customers found." />
                      )}
                    </div>
                  </div>
                </Panel>

                <Panel title="CRM Profile" subtitle="Customer summary, history, notes, and timeline">
                  {selectedClientDetails ? (
                    <div className="space-y-6">
                      <div className="rounded-[28px] border border-brand-mclaren/20 bg-[#fff4eb] p-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div>
                            <div className="text-2xl font-semibold text-brand-black">{selectedClientDetails.client.name}</div>
                            <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-700">
                              <span>{selectedClientDetails.client.phone || 'No phone'}</span>
                              <span>{selectedClientDetails.client.email || 'No email'}</span>
                              <span>{selectedClientDetails.client.city || selectedClientDetails.client.province || 'No location set'}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {selectedClientDetails.client.tags?.length ? (
                              selectedClientDetails.client.tags.map((tag) => (
                                <span key={tag} className="rounded-full border border-white/50 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-600">
                                  {tag}
                                </span>
                              ))
                            ) : (
                              <span className="rounded-full border border-white/50 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                                No tags
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <MetricCard label="Vehicles" value={selectedClientDetails.vehicles.length} helper="Saved to profile" />
                        <MetricCard label="Service Jobs" value={selectedClientDetails.serviceJobs.length} helper="Known service history" />
                        <MetricCard label="Leads" value={selectedClientDetails.leads.length} helper="Pre-booking records" />
                        <MetricCard label="Timeline Events" value={selectedClientDetails.timelineEvents.length} helper="Latest ops activity" />
                      </div>

                      <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
                        <div className="space-y-6">
                          <div className="rounded-[24px] border border-neutral-200 bg-white p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Service History</div>
                            <div className="mt-4 space-y-3">
                              {selectedClientDetails.serviceJobs.length ? (
                                selectedClientDetails.serviceJobs.map((job) => (
                                  <div key={job.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div>
                                        <div className="font-semibold text-brand-black">{getJobServiceDisplay(job)}</div>
                                        <div className="mt-1 text-sm text-gray-600">{fmtDateTime(job.scheduled_at)}</div>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        <StatusBadge status={job.ui_status || 'scheduled'} label={jobStatusLabel[job.ui_status || 'scheduled']} />
                                        <StatusBadge status={job.payment_status || 'unpaid'} label={(job.payment_status || 'unpaid').toUpperCase()} />
                                      </div>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <EmptyState message="No service history yet." />
                              )}
                            </div>
                          </div>

                          <div className="rounded-[24px] border border-neutral-200 bg-white p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Timeline</div>
                            <div className="mt-4 space-y-3">
                              {selectedClientDetails.timelineEvents.length ? (
                                selectedClientDetails.timelineEvents.map((event) => (
                                  <div key={event.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="font-medium capitalize text-brand-black">{event.event_type.replace(/_/g, ' ')}</div>
                                        <div className="mt-1 text-xs text-gray-500">{fmtDateTime(event.created_at)}</div>
                                      </div>
                                    </div>
                                    {event.note && <div className="mt-2 text-sm text-gray-600">{event.note}</div>}
                                  </div>
                                ))
                              ) : (
                                <EmptyState message="No timeline events yet." />
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="rounded-[24px] border border-neutral-200 bg-white p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Vehicle Garage</div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {selectedClientDetails.vehicles.length ? (
                                selectedClientDetails.vehicles.map((vehicle) => (
                                  <span key={vehicle.id} className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-gray-700">
                                    {vehicleLabel(vehicle)}
                                  </span>
                                ))
                              ) : (
                                <span className="text-sm text-gray-500">No saved vehicles.</span>
                              )}
                            </div>
                          </div>

                          <div className="rounded-[24px] border border-neutral-200 bg-white p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Billing Snapshot</div>
                            <div className="mt-4 text-sm text-gray-600">
                              {selectedClientDetails.billingRecords.length
                                ? `${selectedClientDetails.billingRecords.length} billing record${selectedClientDetails.billingRecords.length === 1 ? '' : 's'} available for review.`
                                : 'No billing records stored yet.'}
                            </div>
                          </div>

                          <div className="rounded-[24px] border border-neutral-200 bg-white p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Customer Notes</div>
                            <div className="mt-4 space-y-3">
                              <TextArea value={customerNotes} onChange={setCustomerNotes} rows={10} placeholder="Regular customer, prefers interior detail, requested morning drop-off..." />
                              <button
                                type="button"
                                onClick={saveCustomerNotes}
                                disabled={savingCustomer}
                                className="rounded-2xl bg-brand-mclaren px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-mclaren-dark disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {savingCustomer ? 'Saving Notes...' : 'Save Notes'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <EmptyState message="Select a customer to view CRM details." />
                  )}
                </Panel>
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    label="Unpaid Jobs"
                    value={unpaidPaymentJobs.length}
                    helper="Payment follow-up required"
                    accent
                  />
                  <MetricCard
                    label="Unpaid Total"
                    value={currency(unpaidPaymentJobs.reduce((sum, job) => sum + getJobEstimatedAmount(job), 0))}
                    helper="Open receivables"
                    accent
                  />
                  <MetricCard
                    label="Paid Jobs"
                    value={paidPaymentJobs.length}
                    helper="Closed payments"
                  />
                  <MetricCard
                    label="Paid Total"
                    value={currency(paidPaymentJobs.reduce((sum, job) => sum + getJobEstimatedAmount(job), 0))}
                    helper="Recorded as paid"
                  />
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <Panel title="Needs Follow-up" subtitle="Unpaid bookings sorted by highest amount first">
                    <div className="space-y-3">
                      {unpaidPaymentJobs.length ? (
                        unpaidPaymentJobs.map((job) => (
                          <div key={job.id} className="rounded-[24px] border border-neutral-200 bg-white px-4 py-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="font-semibold text-brand-black">{job.client_name}</div>
                                <div className="mt-1 text-sm text-gray-600">{getJobServiceDisplay(job)}</div>
                                <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                                  <span>{fmtDateTime(job.scheduled_at)}</span>
                                  <span>{fmtRelative(job.scheduled_at)}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-semibold text-brand-black">{currency(getJobEstimatedAmount(job))}</div>
                                <div className="mt-2">
                                  <StatusBadge status={job.payment_status || 'unpaid'} label={(job.payment_status || 'unpaid').toUpperCase()} />
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => updateJob(job.id, { paymentStatus: 'paid' })}
                                className="rounded-xl bg-brand-black px-3 py-2 text-sm font-semibold text-white transition hover:bg-black"
                              >
                                Mark as Paid
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedScheduleJobId(job.id);
                                  setActiveTab('jobs');
                                }}
                                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-brand-mclaren hover:text-brand-mclaren"
                              >
                                Open Job
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <EmptyState message="No unpaid jobs need payment follow-up." />
                      )}
                    </div>
                  </Panel>

                  <Panel title="Paid History" subtitle="Most recently updated paid bookings">
                    <div className="space-y-3">
                      {paidPaymentJobs.length ? (
                        paidPaymentJobs.map((job) => (
                          <div key={job.id} className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="font-semibold text-brand-black">{job.client_name}</div>
                                <div className="mt-1 text-sm text-gray-600">{getJobServiceDisplay(job)}</div>
                                <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                                  <span>{fmtDateTime(job.scheduled_at)}</span>
                                  <span>Updated {fmtRelative(job.updated_at || job.scheduled_at)}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-semibold text-brand-black">{currency(getJobEstimatedAmount(job))}</div>
                                <div className="mt-2">
                                  <StatusBadge status="paid" label="PAID" />
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => updateJob(job.id, { paymentStatus: 'unpaid' })}
                                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-brand-mclaren hover:text-brand-mclaren"
                              >
                                Mark Unpaid
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedScheduleJobId(job.id);
                                  setActiveTab('jobs');
                                }}
                                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-brand-mclaren hover:text-brand-mclaren"
                              >
                                Open Job
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <EmptyState message="No paid jobs recorded yet." />
                      )}
                    </div>
                  </Panel>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <MetricCard label="Unread Inbox" value={unreadInboxNotifications.length} helper="Booking and ops alerts" accent />
                  <MetricCard label="AI Review Items" value={reviewRequiredRuns.length} helper="Human review required" accent />
                  <MetricCard label="Read Archive" value={readInboxNotifications.length} helper="Resolved or acknowledged" />
                </div>

                <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                  <Panel title="AI Review Queue" subtitle="Low-confidence outputs, missing-info warnings, and review-required AI runs">
                  <div className="space-y-3">
                    {reviewRequiredRuns.length ? (
                      reviewRequiredRuns.map((run) => (
                        <div key={run.id} className="rounded-2xl border border-neutral-200 px-4 py-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="font-semibold text-brand-black">{run.feature_name.replace(/_/g, ' ')}</div>
                                <StatusBadge status={run.status === 'failed' ? 'closed_lost' : 'booked'} label={run.status === 'failed' ? 'Failed' : 'Review Required'} />
                              </div>
                              <div className="mt-1 text-sm text-gray-600">
                                {run.entity_type} | {run.entity_id}
                              </div>
                              <div className="mt-2 text-xs text-gray-500">
                                Confidence: {formatConfidence(run.confidence)} | {fmtDateTime(run.created_at)}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {run.status !== 'failed' && (
                                <button
                                  type="button"
                                  onClick={() => applyAiRun(run.id, 0)}
                                  disabled={aiBusyKey === `apply-run:${run.id}:0`}
                                  className="rounded-xl bg-brand-black px-3 py-2 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {aiBusyKey === `apply-run:${run.id}:0` ? 'Applying...' : 'Apply First Action'}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => dismissAiRunAction(run.id)}
                                disabled={aiBusyKey === `dismiss-run:${run.id}`}
                                className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:border-brand-mclaren hover:text-brand-mclaren disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {aiBusyKey === `dismiss-run:${run.id}` ? 'Dismissing...' : 'Dismiss'}
                              </button>
                            </div>
                          </div>
                          {toRecord(run.output_snapshot).summary && (
                            <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-gray-700">
                              {readMetaString(toRecord(run.output_snapshot).summary)}
                            </div>
                          )}
                          {readMetaStringArray(toRecord(run.output_snapshot).warnings).length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {readMetaStringArray(toRecord(run.output_snapshot).warnings).map((warning) => (
                                <span key={warning} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                                  {warning}
                                </span>
                              ))}
                            </div>
                          )}
                          {readMetaStringArray(toRecord(run.output_snapshot).missingInfo).length > 0 && (
                            <div className="mt-3 text-xs text-gray-600">
                              Missing: {readMetaStringArray(toRecord(run.output_snapshot).missingInfo).join(' ')}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <EmptyState message="No AI outputs currently require review." />
                    )}
                  </div>
                  </Panel>

                  <div className="space-y-6">
                    <Panel title="Unread Inbox" subtitle="New booking alerts and upcoming appointment reminders">
                      <div className="space-y-3">
                        {unreadInboxNotifications.length ? (
                          unreadInboxNotifications.map((notification) => (
                            <div key={notification.id} className="rounded-[24px] border border-brand-mclaren/20 bg-[#fff4eb] px-4 py-4">
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <div className="font-semibold text-brand-black">{notification.title}</div>
                                    <StatusBadge status="new_lead" label="Unread" />
                                  </div>
                                  <div className="mt-1 text-sm text-gray-700">{notification.message}</div>
                                  <div className="mt-2 text-xs text-gray-500">
                                    {notification.category} | {fmtDateTime(notification.created_at)}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => markNotificationRead(notification.id)}
                                  className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:border-brand-mclaren hover:text-brand-mclaren"
                                >
                                  Mark Read
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <EmptyState message="No unread notifications in the inbox." />
                        )}
                      </div>
                    </Panel>

                    <Panel title="Read Archive" subtitle="Recent acknowledged notifications">
                      <div className="space-y-3">
                        {readInboxNotifications.length ? (
                          readInboxNotifications.map((notification) => (
                            <div key={notification.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4">
                              <div className="font-semibold text-brand-black">{notification.title}</div>
                              <div className="mt-1 text-sm text-gray-600">{notification.message}</div>
                              <div className="mt-2 text-xs text-gray-500">
                                {notification.category} | {fmtDateTime(notification.created_at)}
                              </div>
                            </div>
                          ))
                        ) : (
                          <EmptyState message="No read notifications yet." />
                        )}
                      </div>
                    </Panel>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
                <Panel title="Revenue Snapshot" subtitle="Simple weekly and monthly performance">
                  {reports ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <MetricCard label="Weekly Estimated Revenue" value={currency(reports.summary.weeklyEstimatedRevenue)} helper="Completed jobs from the last 7 days" accent />
                      <MetricCard label="Monthly Estimated Revenue" value={currency(reports.summary.monthlyEstimatedRevenue)} helper="Completed jobs this month" accent />
                      <MetricCard label="Vehicles Detailed" value={reports.summary.vehiclesDetailedCount} helper="Completed jobs in the selected report window" />
                      <MetricCard label="Completed Jobs (7 days)" value={reports.summary.completedJobsCount} helper="Weekly completed service count" />
                    </div>
                  ) : (
                    <EmptyState message="Reports are not available." />
                  )}
                </Panel>

                <Panel title="Status Breakdown" subtitle="Operational mix of recent jobs">
                  {reports ? (
                    <div className="space-y-3">
                      {Object.entries(reports.jobsByStatus).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <StatusBadge status={status} />
                            <span className="text-sm font-medium text-gray-700">{status.replace(/_/g, ' ')}</span>
                          </div>
                          <span className="text-sm font-semibold text-brand-black">{count}</span>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => reports && exportCsv('service-jobs-report.csv', reports.csvRows.jobs)}
                        className="mt-2 rounded-2xl bg-brand-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-black"
                      >
                        Export Jobs CSV
                      </button>
                    </div>
                  ) : (
                    <EmptyState message="No report data available." />
                  )}
                </Panel>

                <Panel title="AI Manager Briefs" subtitle="Generate grounded daily and weekly operational summaries from the live queue">
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => runManagerBrief('daily')}
                        disabled={aiBusyKey === 'manager-brief:daily'}
                        className="inline-flex items-center gap-2 rounded-2xl bg-brand-mclaren px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-mclaren-dark disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Bot className="h-4 w-4" />
                        {aiBusyKey === 'manager-brief:daily' ? 'Generating Daily...' : 'Generate Daily Brief'}
                      </button>
                      <button
                        type="button"
                        onClick={() => runManagerBrief('weekly')}
                        disabled={aiBusyKey === 'manager-brief:weekly'}
                        className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-brand-mclaren hover:text-brand-mclaren disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <MessageSquareText className="h-4 w-4" />
                        {aiBusyKey === 'manager-brief:weekly' ? 'Generating Weekly...' : 'Generate Weekly Brief'}
                      </button>
                    </div>

                    <ManagerBriefCard
                      title="Daily Brief"
                      suggestion={dailyBrief}
                      emptyMessage="No daily brief generated yet."
                    />
                    <ManagerBriefCard
                      title="Weekly Brief"
                      suggestion={weeklyBrief}
                      emptyMessage="No weekly brief generated yet."
                    />
                  </div>
                </Panel>
              </div>
            )}

            {activeTab === 'copilot' && (
              <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
                <Panel title="Ops Copilot" subtitle="Ask grounded questions about live schedules, payments, notes, leads, and revenue">
                  <div className="space-y-5">
                    <div className="rounded-[24px] border border-brand-mclaren/20 bg-[#fff4eb] p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-mclaren">
                        Grounded Mode
                      </div>
                      <p className="mt-2 text-sm leading-6 text-gray-700">
                        Phase 1 answers from live Supabase jobs, leads, clients, and payment records. It does not invent numbers outside the current dashboard data.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                        Suggested Questions
                      </div>
                      {opsCopilotPromptSuggestions.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => submitOpsChatQuestion(prompt)}
                          disabled={opsChatSubmitting}
                          className="block w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-left text-sm font-medium text-gray-700 transition hover:border-brand-mclaren hover:text-brand-mclaren disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>

                    <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                        Best For
                      </div>
                      <div className="mt-3 space-y-2 text-sm text-gray-600">
                        <div>Pending job counts and next appointments</div>
                        <div>Paid versus unpaid customer summaries</div>
                        <div>Notes, intake details, and enquiry message lookups</div>
                        <div>Pickup and drop-off request traceability</div>
                        <div>Expected revenue and highest-value bookings</div>
                      </div>
                    </div>
                  </div>
                </Panel>

                <Panel title="Live Chat" subtitle="Ask natural-language questions and review the supporting facts">
                  <div className="space-y-4">
                    <div className="max-h-[620px] space-y-4 overflow-y-auto pr-1">
                      {opsChatMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-3xl rounded-[24px] border px-4 py-4 shadow-sm ${
                              message.role === 'user'
                                ? 'border-brand-mclaren bg-brand-mclaren text-white'
                                : 'border-neutral-200 bg-neutral-50 text-gray-800'
                            }`}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">
                                {message.role === 'user' ? 'You' : 'Ops Copilot'}
                              </div>
                              {message.role === 'assistant' && message.mode && (
                                <span className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                                  {message.mode === 'ai' ? 'AI Answer' : 'Direct Summary'}
                                </span>
                              )}
                            </div>

                            <div className="mt-2 text-sm leading-6">{message.content}</div>

                            {message.warning && message.role === 'assistant' && (
                              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                {message.warning}
                              </div>
                            )}

                            {message.supportingFacts && message.supportingFacts.length > 0 && (
                              <div className="mt-4 space-y-2">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">
                                  Supporting Facts
                                </div>
                                {message.supportingFacts.map((fact) => (
                                  <div
                                    key={`${message.id}-${fact}`}
                                    className={`rounded-xl px-3 py-2 text-xs leading-5 ${
                                      message.role === 'user'
                                        ? 'bg-white/15 text-white/90'
                                        : 'border border-neutral-200 bg-white text-gray-600'
                                    }`}
                                  >
                                    {fact}
                                  </div>
                                ))}
                              </div>
                            )}

                            {message.followUpQuestions && message.followUpQuestions.length > 0 && (
                              <div className="mt-4 space-y-2">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">
                                  Follow Up
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {message.followUpQuestions.map((prompt) => (
                                    <button
                                      key={`${message.id}-${prompt}`}
                                      type="button"
                                      onClick={() => submitOpsChatQuestion(prompt)}
                                      disabled={opsChatSubmitting}
                                      className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                                        message.role === 'user'
                                          ? 'border border-white/30 bg-white/10 text-white'
                                          : 'border border-neutral-200 bg-white text-gray-700 hover:border-brand-mclaren hover:text-brand-mclaren'
                                      } disabled:cursor-not-allowed disabled:opacity-60`}
                                    >
                                      {prompt}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-[24px] border border-neutral-200 bg-white p-4">
                      <TextArea
                        label="Ask the copilot"
                        value={opsChatInput}
                        onChange={setOpsChatInput}
                        rows={4}
                        placeholder="Who requested pickup recently, which unpaid customers mentioned smoke odor, and how much expected revenue are we carrying?"
                      />
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-gray-500">
                          Answers use current dashboard records, not public website content.
                        </div>
                        <button
                          type="button"
                          onClick={() => submitOpsChatQuestion()}
                          disabled={opsChatSubmitting || !opsChatInput.trim()}
                          className="inline-flex items-center gap-2 rounded-2xl bg-brand-mclaren px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-mclaren-dark disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <MessageSquareText className="h-4 w-4" />
                          {opsChatSubmitting ? 'Thinking...' : 'Ask Copilot'}
                        </button>
                      </div>
                    </div>
                  </div>
                </Panel>
              </div>
            )}
          </>
        )}
      </div>
    </AuthGate>
  );
};

const AiStateSummary: React.FC<{ state: AiFeatureState | null; emptyMessage: string }> = ({
  state,
  emptyMessage,
}) => {
  if (!state) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-3 py-3 text-xs text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">AI Summary</div>
        <StatusBadge status={state.confidence >= 0.7 ? 'completed' : 'booked'} label={`Confidence ${formatConfidence(state.confidence)}`} />
        {state.approvalStatus === 'applied' && <StatusBadge status="completed" label="Applied" />}
        {state.approvalStatus === 'dismissed' && <StatusBadge status="cancelled" label="Dismissed" />}
      </div>
      <div className="mt-2 text-sm text-gray-700">{state.summary}</div>
      {state.recommendedNextAction && (
        <div className="mt-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-gray-600">
          <span className="font-semibold text-brand-black">Next:</span> {state.recommendedNextAction}
        </div>
      )}
      {state.recommendations.length > 0 && (
        <div className="mt-3 space-y-2">
          {state.recommendations.slice(0, 2).map((recommendation) => (
            <div key={`${recommendation.title}-${recommendation.kind}`} className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                {recommendation.kind.replace(/_/g, ' ')} | {recommendation.priority}
              </div>
              <div className="mt-1 text-sm font-semibold text-brand-black">{recommendation.title}</div>
              <div className="mt-1 text-xs text-gray-600">{recommendation.detail}</div>
            </div>
          ))}
        </div>
      )}
      {state.missingInfo.length > 0 && (
        <div className="mt-3 space-y-1">
          {state.missingInfo.map((item) => (
            <div key={item} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {item}
            </div>
          ))}
        </div>
      )}
      {state.warnings.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {state.warnings.map((warning) => (
            <span key={warning} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">
              {warning}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const ManagerBriefCard: React.FC<{
  title: string;
  suggestion: AiSuggestion | null;
  emptyMessage: string;
}> = ({ title, suggestion, emptyMessage }) => (
  <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 p-4">
    <div className="flex flex-wrap items-center gap-2">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{title}</div>
      {suggestion && <StatusBadge status={suggestion.confidence >= 0.7 ? 'completed' : 'booked'} label={`Confidence ${formatConfidence(suggestion.confidence)}`} />}
    </div>
    {suggestion ? (
      <div className="mt-3 space-y-3">
        <div className="text-sm text-gray-700">{suggestion.summary}</div>
        {suggestion.recommendations.length > 0 && (
          <div className="space-y-2">
            {suggestion.recommendations.slice(0, 3).map((recommendation) => (
              <div key={`${title}-${recommendation.title}`} className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                  {recommendation.kind.replace(/_/g, ' ')} | {recommendation.priority}
                </div>
                <div className="mt-1 text-sm font-semibold text-brand-black">{recommendation.title}</div>
                <div className="mt-1 text-xs text-gray-600">{recommendation.detail}</div>
              </div>
            ))}
          </div>
        )}
        {suggestion.warnings.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestion.warnings.map((warning) => (
              <span key={warning} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                {warning}
              </span>
            ))}
          </div>
        )}
      </div>
    ) : (
      <div className="mt-3 text-sm text-gray-500">{emptyMessage}</div>
    )}
  </div>
);

const Panel: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <section className="dashboard-panel relative overflow-hidden rounded-[30px] border border-neutral-200/90 bg-[linear-gradient(180deg,#ffffff_0%,#fcfcfd_100%)] p-5 shadow-[0_20px_65px_rgba(15,23,42,0.07)] sm:p-6">
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-mclaren/40 to-transparent" />
    <div className="mb-5">
      <div className="mb-3 h-1.5 w-16 rounded-full bg-brand-mclaren/20" />
      <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">{title}</h2>
      {subtitle && <p className="mt-2 text-sm text-gray-600">{subtitle}</p>}
    </div>
    {children}
  </section>
);

const MetricCard: React.FC<{
  label: string;
  value: React.ReactNode;
  helper?: string;
  accent?: boolean;
  onClick?: () => void;
}> = ({ label, value, helper, accent, onClick }) => {
  const sharedClassName = `dashboard-metric-card rounded-[24px] border p-5 text-left transition ${
    accent
      ? 'border-brand-mclaren/20 bg-[linear-gradient(180deg,#fff4eb_0%,#ffffff_100%)]'
      : 'border-neutral-200 bg-[linear-gradient(180deg,#ffffff_0%,#fcfcfd_100%)]'
  } ${onClick ? 'hover:-translate-y-0.5 hover:border-brand-mclaren hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]' : ''}`;

  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{label}</div>
        <span className={`h-2.5 w-2.5 rounded-full ${accent ? 'bg-brand-mclaren' : 'bg-brand-black/15'}`} />
      </div>
      <div className="mt-3 text-3xl font-semibold text-brand-black">{value}</div>
      {helper && <div className="mt-2 text-sm text-gray-600">{helper}</div>}
    </>
  );

  return onClick ? (
    <button type="button" onClick={onClick} className={sharedClassName}>
      {content}
    </button>
  ) : (
    <div className={sharedClassName}>{content}</div>
  );
};

const InsightCard: React.FC<{
  eyebrow: string;
  title: React.ReactNode;
  body: React.ReactNode;
  detail?: React.ReactNode;
  accent?: boolean;
  onClick?: () => void;
}> = ({ eyebrow, title, body, detail, accent, onClick }) => {
  const className = `dashboard-insight-card rounded-[26px] border px-5 py-5 text-left transition ${
    accent
      ? 'border-brand-mclaren/20 bg-[linear-gradient(180deg,#fff4eb_0%,#ffffff_100%)]'
      : 'border-neutral-200 bg-[linear-gradient(180deg,#ffffff_0%,#fcfcfd_100%)]'
  } ${onClick ? 'hover:-translate-y-0.5 hover:border-brand-mclaren hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]' : ''}`;

  const content = (
    <>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">{eyebrow}</div>
      <div className="mt-3 text-xl font-semibold text-brand-black">{title}</div>
      <div className="mt-2 text-sm leading-6 text-gray-600">{body}</div>
      {detail ? <div className="mt-4 text-xs font-medium uppercase tracking-[0.12em] text-gray-500">{detail}</div> : null}
    </>
  );

  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
};

const DataTable: React.FC<{ columns: string[]; rows: React.ReactNode[] }> = ({ columns, rows }) => (
  <div className="dashboard-table overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-neutral-200">
        <thead className="bg-[linear-gradient(180deg,#fafafa_0%,#f5f5f5_100%)]">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white">
          {rows.length ? rows : (
            <tr>
              <td className="px-4 py-8 text-sm text-gray-500" colSpan={columns.length}>No records yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const Input: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}> = ({ label, value, onChange, placeholder, type = 'text', required = false }) => (
  <label className="block">
    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{label}</span>
    <input
      type={type}
      required={required}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="dashboard-input-control w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm text-brand-black outline-none transition focus:border-brand-mclaren"
    />
  </label>
);

const Select: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}> = ({ label, value, onChange, options }) => (
  <label className="block">
    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="dashboard-select-control w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm text-brand-black outline-none transition focus:border-brand-mclaren"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const ServiceCatalogField: React.FC<{
  label: string;
  serviceCatalogId: string;
  serviceAddonIds: string[];
  customServiceType: string;
  groupedPrimaryOfferings: Array<{ label: string; offerings: ServiceOffering[] }>;
  addOnOfferings: ServiceOffering[];
  onServiceCatalogIdChange: (value: string) => void;
  onServiceAddonIdsChange: (value: string[]) => void;
  onCustomServiceTypeChange: (value: string) => void;
}> = ({
  label,
  serviceCatalogId,
  serviceAddonIds,
  customServiceType,
  groupedPrimaryOfferings,
  addOnOfferings,
  onServiceCatalogIdChange,
  onServiceAddonIdsChange,
  onCustomServiceTypeChange,
}) => {
  const allowAddOns = Boolean(serviceCatalogId) && serviceCatalogId !== 'custom';

  const toggleAddOn = (offeringId: string) => {
    if (!allowAddOns) return;
    onServiceAddonIdsChange(
      serviceAddonIds.includes(offeringId)
        ? serviceAddonIds.filter((id) => id !== offeringId)
        : [...serviceAddonIds, offeringId]
    );
  };

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{label}</span>
        <select
          required
          value={serviceCatalogId}
          onChange={(event) => onServiceCatalogIdChange(event.target.value)}
          className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm text-brand-black outline-none transition focus:border-brand-mclaren"
        >
          <option value="">Select a service</option>
          {groupedPrimaryOfferings.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.offerings.map((offering) => (
                <option key={offering.id} value={offering.id}>
                  {offering.title} | {offering.priceLabel}
                </option>
              ))}
            </optgroup>
          ))}
          <option value="custom">Custom service</option>
        </select>
      </label>

      {serviceCatalogId === 'custom' && (
        <Input
          label="Custom Service Name"
          value={customServiceType}
          onChange={onCustomServiceTypeChange}
          placeholder="Enter manual service name"
          required
        />
      )}

      {addOnOfferings.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Optional Add-Ons</div>
              <p className="mt-2 text-sm text-gray-600">
                Add-ons can be attached to a catalog service. Custom services stay manual-only.
              </p>
            </div>
            {!allowAddOns && (
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                Select a catalog service first
              </span>
            )}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {addOnOfferings.map((offering) => (
              <label
                key={offering.id}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                  serviceAddonIds.includes(offering.id)
                    ? 'border-brand-mclaren bg-brand-mclaren/5'
                    : 'border-neutral-200 bg-white'
                } ${!allowAddOns ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-neutral-300 text-brand-mclaren focus:ring-brand-mclaren"
                  checked={serviceAddonIds.includes(offering.id)}
                  disabled={!allowAddOns}
                  onChange={() => toggleAddOn(offering.id)}
                />
                <div className="min-w-0">
                  <div className="font-semibold text-brand-black">{offering.title}</div>
                  <div className="mt-1 text-sm text-gray-600">{offering.priceLabel}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const TextArea: React.FC<{
  label?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}> = ({ label, value, onChange, rows = 4, placeholder }) => (
  <label className="block">
    {label && <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{label}</span>}
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="dashboard-input-control w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm text-brand-black outline-none transition focus:border-brand-mclaren"
    />
  </label>
);

const DetailCard: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="dashboard-detail-card rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4">
    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{label}</div>
    <div className="mt-2 text-sm font-semibold text-brand-black">{value}</div>
  </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="dashboard-empty-state rounded-[24px] border border-dashed border-neutral-300 bg-[linear-gradient(180deg,#fafafa_0%,#f7f7f7_100%)] px-4 py-8 text-center text-sm text-gray-500">
    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-400 shadow-sm">
      <MessageSquareText className="h-4 w-4" />
    </div>
    <div className="mt-3">{message}</div>
  </div>
);

export default Dashboard;



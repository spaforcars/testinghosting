
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Bot,
  Calendar,
  ChevronRight,
  Clock,
  LayoutList,
  LineChart,
  MessageSquare,
  Plus,
  RotateCw,
  Search,
  Send,
  Users,
  X,
} from 'lucide-react';
import AuthGate from '../components/AuthGate';
import { ApiError, apiRequest } from '../lib/apiClient';
import { useCmsPage } from '../hooks/useCmsPage';
import { adaptServicesContent } from '../lib/contentAdapter';
import { defaultServicesPageContent } from '../lib/cmsDefaults';
import {
  dateTimeInputToUtcIso,
  DEFAULT_APP_TIME_ZONE,
  formatDateTimeInTimeZone,
  formatForDateTimeInput,
  getTimeZoneDateKey,
  getTimeZoneParts,
  isSameTimeZoneDate,
  localDateKeyToUtcRange,
  parseDateTimeInputValue,
  shiftTimeZoneDateKey,
  zonedDateTimeToUtc,
} from '../lib/timeZone';
import {
  buildServiceLabel,
  getAddOnOfferings,
  getOfferingById,
  getPrimaryOfferings,
  groupOfferingsByCategory,
  findOfferingByTitle,
  resolveServiceDisplay,
} from '../lib/serviceCatalog';
import type { ServiceOffering } from '../types/cms';
import type {
  CustomerWorkspaceResponse,
  InAppNotification,
  JobUiStatus,
  Lead,
  LeadUiStatus,
} from '../types/platform';

/* ?? Types ??????????????????????????????????????????????????????????? */

type DashboardView = 'schedule' | 'calendar' | 'leads' | 'reports';

type SchedulePreset = 'today' | 'tomorrow' | 'this_week' | 'next_7_days';
type CalendarBlockSource = 'general' | 'walk_in' | 'mobile' | 'support';

type AuthMeResponse = { userId: string; email?: string; role: string; permissions: string[] };

type Pagination = { page: number; pageSize: number; total: number; totalPages: number };
type LeadsResponse = { leads: Lead[]; pagination: Pagination };
type NotificationsResponse = { notifications: InAppNotification[] };
type ReportsResponse = {
  summary: {
    dateFrom: string; dateTo: string;
    weeklyEstimatedRevenue: number; monthlyEstimatedRevenue: number;
    vehiclesDetailedCount: number; completedJobsCount: number;
  };
  jobsByStatus: Record<string, number>;
};

type ScheduleBoardJob = {
  id: string; clientId?: string | null; clientName: string; serviceType: string;
  scheduledAt?: string | null; scheduledEndAt?: string | null; uiStatus: JobUiStatus;
  estimatedAmount: number; bookingSource?: string | null; bookingReference?: string | null;
  pickupRequested: boolean; notes?: string | null; vehicleLabel: string;
};

type CalendarTimeBlock = {
  id: string; title: string; startAt: string; endAt: string; source: CalendarBlockSource;
  notes?: string | null; createdAt: string; updatedAt: string;
};

type ScheduleBoardResponse = {
  timeZone: string;
  summary: { totalJobs: number; unpaidJobs: number; pickupJobs: number; completedJobs: number };
  blocks: CalendarTimeBlock[];
  groups: Array<{
    key: string; label: string; date?: string | null;
    summary: { totalJobs: number; unpaidJobs: number; pickupJobs: number };
    jobs: ScheduleBoardJob[];
  }>;
};

type OpsChatMessage = {
  id: string; role: 'user' | 'assistant'; content: string;
  sections?: Array<{ title: string; items: string[] }>;
  supportingFacts?: string[]; followUpQuestions?: string[];
  mode?: 'ai' | 'fallback'; warning?: string | null;
  actionProposal?: {
    type: 'calendar_block';
    status: 'pending_confirmation' | 'confirmed' | 'cancelled';
    title: string;
    startAt: string;
    endAt: string;
    source: CalendarBlockSource;
    notes?: string | null;
  } | null;
};

type BookingForm = {
  clientId: string; clientName: string; serviceCatalogId: string;
  serviceAddonIds: string[]; customServiceType: string; scheduledAt: string;
  vehicleMake: string; vehicleModel: string; vehicleYear: string;
  estimatedAmount: string; notes: string;
};

type CalendarBlockForm = {
  startAt: string; endAt: string; source: CalendarBlockSource; title: string; notes: string;
};

/* ?? Constants ??????????????????????????????????????????????????????? */

const emptyForm: BookingForm = {
  clientId: '', clientName: '', serviceCatalogId: '', serviceAddonIds: [],
  customServiceType: '', scheduledAt: '', vehicleMake: '', vehicleModel: '',
  vehicleYear: '', estimatedAmount: '', notes: '',
};

const calendarBlockSourceOptions: Array<{ value: CalendarBlockSource; label: string }> = [
  { value: 'general', label: 'General block' },
  { value: 'walk_in', label: 'Walk-in hold' },
  { value: 'mobile', label: 'Doorstep hold' },
  { value: 'support', label: 'Support hold' },
];

const presetOptions: Array<{ value: SchedulePreset; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'this_week', label: 'This Week' },
  { value: 'next_7_days', label: 'Next 7 Days' },
];

const viewTabs: Array<{ id: DashboardView; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'schedule', label: 'Schedule', icon: LayoutList },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'reports', label: 'Reports', icon: LineChart },
];

const leadStatusLabel: Record<LeadUiStatus, string> = {
  new_lead: 'New', booked: 'Booked', service_completed: 'Completed', closed_lost: 'Lost',
};

const copilotPrompts = [
  'Who is booked today and in what order?',
  'Which upcoming appointments have no customer notes?',
  'Give me a prep brief for the next 3 bookings.',
] as const;

const CALENDAR_START_HOUR = 7;
const CALENDAR_END_HOUR = 21;
const HOUR_PX = 64;
const CALENDAR_DRAG_STEP_MINUTES = 30;

/* ?? Utilities ??????????????????????????????????????????????????????? */

const qs = (p: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => { if (v !== undefined && v !== '') s.set(k, String(v)); });
  const o = s.toString();
  return o ? `?${o}` : '';
};

const withTimeOnDate = (dateKey: string, minutes: number, timeZone: string) => {
  const [year, month, day] = dateKey.split('-').map((value) => Number(value));
  return zonedDateTimeToUtc(
    {
      year,
      month,
      day,
      hour: Math.floor(minutes / 60),
      minute: minutes % 60,
      second: 0,
    },
    timeZone
  );
};
const snapMinutes = (minutes: number) => {
  const clamped = Math.max(CALENDAR_START_HOUR * 60, Math.min(CALENDAR_END_HOUR * 60, minutes));
  return Math.round(clamped / CALENDAR_DRAG_STEP_MINUTES) * CALENDAR_DRAG_STEP_MINUTES;
};
const defaultCalendarBlockForm = (timeZone: string): CalendarBlockForm => {
  const nowParts = getTimeZoneParts(new Date(), timeZone);
  const start = zonedDateTimeToUtc(
    {
      year: nowParts?.year || 1970,
      month: nowParts?.month || 1,
      day: nowParts?.day || 1,
      hour: (nowParts?.hour || 0) + 1,
      minute: 0,
      second: 0,
    },
    timeZone
  );
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return {
    startAt: formatForDateTimeInput(start, timeZone),
    endAt: formatForDateTimeInput(end, timeZone),
    source: 'walk_in',
    title: 'Walk-in hold',
    notes: '',
  };
};

const presetRange = (p: SchedulePreset, timeZone: string) => {
  const todayKey = getTimeZoneDateKey(new Date(), timeZone);
  const startKey = p === 'tomorrow' ? shiftTimeZoneDateKey(todayKey, 1, timeZone) : todayKey;
  const endKey =
    p === 'today'
      ? shiftTimeZoneDateKey(todayKey, 1, timeZone)
      : p === 'tomorrow'
        ? shiftTimeZoneDateKey(todayKey, 2, timeZone)
        : p === 'this_week'
          ? shiftTimeZoneDateKey(todayKey, 7, timeZone)
          : shiftTimeZoneDateKey(todayKey, 8, timeZone);
  return {
    dateFrom: localDateKeyToUtcRange(startKey, timeZone).start.toISOString(),
    dateTo: localDateKeyToUtcRange(endKey, timeZone).start.toISOString(),
  };
};

const fmtTime = (v?: string | null, timeZone = DEFAULT_APP_TIME_ZONE) => {
  if (!v) return 'TBD'; const d = new Date(v); if (Number.isNaN(d.getTime())) return 'TBD';
  return formatDateTimeInTimeZone(d, { hour: 'numeric', minute: '2-digit', hour12: true }, timeZone);
};

const fmtTimeRange = (s?: string | null, e?: string | null, timeZone = DEFAULT_APP_TIME_ZONE) => {
  const a = fmtTime(s, timeZone), b = fmtTime(e, timeZone);
  return a === 'TBD' ? 'Time TBD' : b !== 'TBD' ? `${a} � ${b}` : a;
};

const fmtDate = (v?: string | null, timeZone = DEFAULT_APP_TIME_ZONE) => {
  if (!v) return '-'; const d = new Date(v); if (Number.isNaN(d.getTime())) return '-';
  return formatDateTimeInTimeZone(d, { month: 'short', day: 'numeric', weekday: 'short' }, timeZone);
};

const fmtDateHeading = (v?: string | null, timeZone = DEFAULT_APP_TIME_ZONE) => {
  if (!v) return 'Unscheduled'; const d = new Date(v); if (Number.isNaN(d.getTime())) return 'Unscheduled';
  return formatDateTimeInTimeZone(d, { weekday: 'long', month: 'long', day: 'numeric' }, timeZone);
};

const fmtRelative = (v?: string | null) => {
  if (!v) return '-'; const d = new Date(v); if (Number.isNaN(d.getTime())) return '-';
  const h = Math.round((Date.now() - d.getTime()) / 3_600_000);
  if (Math.abs(h) < 24) return h === 0 ? 'just now' : h > 0 ? `${h}h ago` : `in ${Math.abs(h)}h`;
  const days = Math.round(h / 24);
  return days > 0 ? `${days}d ago` : `in ${Math.abs(days)}d`;
};

const fmtDayShort = (v: string, timeZone = DEFAULT_APP_TIME_ZONE) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : formatDateTimeInTimeZone(d, { weekday: 'short' }, timeZone);
};
const fmtDayNum = (v: string, timeZone = DEFAULT_APP_TIME_ZONE) => {
  const parts = getTimeZoneParts(v, timeZone);
  return parts?.day || '-';
};
const fmtDateTime = (v: string, timeZone = DEFAULT_APP_TIME_ZONE) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  return formatDateTimeInTimeZone(d, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }, timeZone);
};
const calendarBlockTone = (source: CalendarBlockSource) =>
  source === 'walk_in'
    ? 'bg-amber-50/90 border-amber-200 text-amber-900'
    : source === 'mobile'
      ? 'bg-violet-50/90 border-violet-200 text-violet-900'
      : source === 'support'
        ? 'bg-sky-50/90 border-sky-200 text-sky-900'
        : 'bg-neutral-100/95 border-neutral-300 text-neutral-700';
const calendarBlockBadge = (source: CalendarBlockSource) =>
  source === 'walk_in'
    ? 'bg-amber-100 text-amber-800'
    : source === 'mobile'
      ? 'bg-violet-100 text-violet-800'
      : source === 'support'
        ? 'bg-sky-100 text-sky-800'
        : 'bg-neutral-200 text-neutral-700';

const currency = (v?: number | null) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(v || 0));

const statusDot = (s: JobUiStatus) => s === 'completed' ? 'bg-emerald-400' : s === 'cancelled' ? 'bg-neutral-300' : 'bg-amber-400';
const leadDot = (s?: LeadUiStatus) => s === 'booked' ? 'bg-emerald-400' : s === 'closed_lost' ? 'bg-neutral-300' : s === 'service_completed' ? 'bg-sky-400' : 'bg-amber-400';

const calBlockColor = (s: JobUiStatus) =>
  s === 'completed' ? 'bg-emerald-50 border-emerald-200/60 text-emerald-800'
  : s === 'cancelled' ? 'bg-neutral-50 border-neutral-200/60 text-neutral-500'
  : 'bg-[#0071e3]/[0.07] border-[#0071e3]/20 text-[#0071e3]';
const calendarBlockLabel = (source: CalendarBlockSource) => calendarBlockSourceOptions.find((option) => option.value === source)?.label || 'Blocked time';

const chatId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const toRecord = (v: unknown): Record<string, unknown> => v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const metaStr = (v: unknown) => typeof v === 'string' ? v : '';
const metaStrArr = (v: unknown) => Array.isArray(v) ? v.filter((i): i is string => typeof i === 'string') : [];
const leadMeta = (l: Lead) => toRecord(l.intake_metadata);
const leadService = (l: Lead) => metaStr(leadMeta(l).preferredSummary);
const leadIssue = (l: Lead) => metaStr(leadMeta(l).issueDetails);
const leadNotes = (l: Lead) => metaStr(leadMeta(l).notes);
const leadPhotos = (l: Lead) => metaStrArr(leadMeta(l).assetPaths).length;
const leadPickup = (l: Lead) => Boolean(leadMeta(l).pickupRequested);
const leadRef = (l: Lead) => metaStr(leadMeta(l).bookingReference);

/* ?? Main Dashboard ?????????????????????????????????????????????????? */

const Dashboard: React.FC = () => {
  const [view, setView] = useState<DashboardView>('schedule');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthMeResponse | null>(null);

  const [board, setBoard] = useState<ScheduleBoardResponse | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadPagination, setLeadPagination] = useState<Pagination | null>(null);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [reports, setReports] = useState<ReportsResponse | null>(null);

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientDetails, setClientDetails] = useState<CustomerWorkspaceResponse | null>(null);

  const [search, setSearch] = useState('');
  const deferred = useDeferredValue(search);
  const [preset, setPreset] = useState<SchedulePreset>('this_week');

  const [modalOpen, setModalOpen] = useState(false);
  const [convertLeadId, setConvertLeadId] = useState<string | null>(null);
  const [form, setForm] = useState<BookingForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockForm, setBlockForm] = useState<CalendarBlockForm>(defaultCalendarBlockForm(DEFAULT_APP_TIME_ZONE));
  const [blockSubmitting, setBlockSubmitting] = useState(false);
  const [deletingBlockId, setDeletingBlockId] = useState<string | null>(null);

  const [copilotOpen, setCopilotOpen] = useState(false);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [customer360Open, setCustomer360Open] = useState(false);

  const [chatMessages, setChatMessages] = useState<OpsChatMessage[]>([{
    id: 'welcome', role: 'assistant',
    content: 'Ask about scheduled services, customer context, and upcoming prep.',
    sections: [{ title: 'You can ask', items: ['Booking order for today', 'Missing customer notes', 'Prep summary for upcoming services'] }],
    followUpQuestions: [...copilotPrompts], mode: 'fallback',
  }]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatActionLoadingId, setChatActionLoadingId] = useState<string | null>(null);

  const ready = useRef(false);
  const bootstrapRetriedAfter401 = useRef(false);

  const { data: servicesCmsData } = useCmsPage('services', defaultServicesPageContent);
  const servicesContent = useMemo(() => adaptServicesContent(servicesCmsData), [servicesCmsData]);
  const primaryOfferings = useMemo(() => getPrimaryOfferings(servicesContent), [servicesContent]);
  const addOnOfferings = useMemo(() => getAddOnOfferings(servicesContent), [servicesContent]);
  const groupedPrimary = useMemo(() => groupOfferingsByCategory(primaryOfferings), [primaryOfferings]);
  const dashboardTimeZone = board?.timeZone || DEFAULT_APP_TIME_ZONE;

  const resolveAddOns = useCallback(
    (ids: string[]) => ids.map((id) => getOfferingById(servicesContent, id)).filter(Boolean) as ServiceOffering[],
    [servicesContent],
  );

  const getLeadServiceDisplay = useCallback(
    (l: Lead) => resolveServiceDisplay(servicesContent, l.service_catalog_id, l.service_addon_ids, l.service_type),
    [servicesContent],
  );

  const allJobs = useMemo(() => board?.groups.flatMap((g) => g.jobs) ?? [], [board]);

  const filteredJobs = useMemo(() => {
    const t = deferred.trim().toLowerCase();
    if (!t) return allJobs;
    return allJobs.filter((j) => [j.clientName, j.serviceType, j.vehicleLabel, j.notes].filter(Boolean).join(' ').toLowerCase().includes(t));
  }, [allJobs, deferred]);

  const selectedJob = useMemo(() => filteredJobs.find((j) => j.id === selectedJobId) ?? filteredJobs[0] ?? null, [filteredJobs, selectedJobId]);

  const filteredLeads = useMemo(() => {
    const t = deferred.trim().toLowerCase();
    if (!t) return leads;
    return leads.filter((l) => [l.name, l.email, l.phone, getLeadServiceDisplay(l)].filter(Boolean).join(' ').toLowerCase().includes(t));
  }, [deferred, getLeadServiceDisplay, leads]);

  const selectedLead = useMemo(() => filteredLeads.find((l) => l.id === selectedLeadId) ?? filteredLeads[0] ?? null, [filteredLeads, selectedLeadId]);

  const unreadNotifs = useMemo(() => notifications.filter((n) => !n.read_at), [notifications]);

  /* ?? Data fetching ???????????????????????????????????????????????? */

  const fetchBoard = useCallback(async (p: SchedulePreset, q?: string) => {
    const r = presetRange(p, DEFAULT_APP_TIME_ZONE);
    const data = await apiRequest<ScheduleBoardResponse>(`/api/dashboard/schedule-board${qs({ dateFrom: r.dateFrom, dateTo: r.dateTo, search: q || undefined })}`);
    setBoard(data);
    setSelectedJobId((cur) => { if (cur && data.groups.some((g) => g.jobs.some((j) => j.id === cur))) return cur; return data.groups[0]?.jobs[0]?.id ?? null; });
  }, []);

  const fetchAux = useCallback(async () => {
    const [authRes, leadsRes, notifsRes, reportsRes] = await Promise.all([
      apiRequest<AuthMeResponse>('/api/auth/me'),
      apiRequest<LeadsResponse>(`/api/leads${qs({ page: 1, pageSize: 50 })}`),
      apiRequest<NotificationsResponse>('/api/notifications/in-app?limit=25'),
      apiRequest<ReportsResponse>('/api/reports/summary'),
    ]);
    setAuth(authRes);
    setLeads(leadsRes.leads);
    setLeadPagination(leadsRes.pagination);
    setNotifications(notifsRes.notifications);
    setReports(reportsRes);
    setSelectedLeadId((cur) => cur && leadsRes.leads.some((l) => l.id === cur) ? cur : leadsRes.leads[0]?.id ?? null);
  }, []);

  const loadClient = useCallback(async (id: string) => {
    const data = await apiRequest<CustomerWorkspaceResponse>(`/api/customers/${id}/workspace`);
    setClientDetails(data);
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([fetchAux(), fetchBoard('this_week')]);
      bootstrapRetriedAfter401.current = false;
    }
    catch (e) {
      if (e instanceof ApiError && e.status === 401 && !bootstrapRetriedAfter401.current) {
        bootstrapRetriedAfter401.current = true;
        setTimeout(() => {
          void bootstrap();
        }, 500);
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Failed to load dashboard');
    }
    finally { setLoading(false); ready.current = true; }
  }, [fetchAux, fetchBoard]);

  const refreshAll = useCallback(async () => {
    try { setRefreshing(true); setError(null); await Promise.all([fetchAux(), fetchBoard(preset, deferred)]); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Failed to refresh'); }
    finally { setRefreshing(false); }
  }, [deferred, fetchAux, fetchBoard, preset]);

  useEffect(() => { if (!ready.current) void bootstrap(); }, [bootstrap]);

  useEffect(() => {
    if (!ready.current) return;
    setRefreshing(true);
    fetchBoard(preset, deferred).catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to refresh schedule')).finally(() => setRefreshing(false));
  }, [preset, deferred, fetchBoard]);

  useEffect(() => {
    if (!selectedJob?.clientId) { setSelectedClientId(null); setClientDetails(null); return; }
    if (selectedJob.clientId !== selectedClientId) {
      setSelectedClientId(selectedJob.clientId);
      loadClient(selectedJob.clientId).catch(() => setClientDetails(null));
    }
  }, [selectedJob?.clientId, selectedJob?.id, selectedClientId, loadClient]);

  /* ?? Copilot ?????????????????????????????????????????????????????? */

  const sendChat = async (text?: string) => {
    const q = (text || chatInput).trim(); if (!q) return;
    if (!text) setChatInput('');
    setChatMessages((m) => [...m, { id: chatId(), role: 'user', content: q }]);
    try {
      setChatSending(true);
      const res = await apiRequest<{
        answer: string;
        sections: Array<{ title: string; items: string[] }>;
        supportingFacts: string[];
        followUpQuestions: string[];
        mode: 'ai' | 'fallback';
        warning?: string | null;
        actionProposal?: OpsChatMessage['actionProposal'];
      }>('/api/ai/chat', { method: 'POST', body: JSON.stringify({ question: q }) });
      setChatMessages((m) => [...m, { id: chatId(), role: 'assistant', content: res.answer, sections: res.sections, supportingFacts: res.supportingFacts, followUpQuestions: res.followUpQuestions, mode: res.mode, warning: res.warning ?? null, actionProposal: res.actionProposal ?? null }]);
    } catch {
      setChatMessages((m) => [...m, { id: chatId(), role: 'assistant', content: 'I could not answer that right now.', sections: [{ title: 'Status', items: ['The AI assistant is temporarily unavailable.'] }], mode: 'fallback', warning: 'The AI assistant is temporarily unavailable.' }]);
    } finally { setChatSending(false); }
  };

  const confirmChatProposal = async (messageId: string) => {
    const proposal = chatMessages.find((message) => message.id === messageId)?.actionProposal;
    if (!proposal || proposal.status !== 'pending_confirmation') return;
    try {
      setChatActionLoadingId(messageId);
      setError(null);
      await apiRequest('/api/dashboard/calendar-blocks', {
        method: 'POST',
        body: JSON.stringify({
          startAt: proposal.startAt,
          endAt: proposal.endAt,
          source: proposal.source,
          title: proposal.title,
          notes: proposal.notes || undefined,
        }),
      });
      setChatMessages((messages) => [
        ...messages.map((message) =>
          message.id === messageId && message.actionProposal
            ? { ...message, actionProposal: { ...message.actionProposal, status: 'confirmed' as const } }
            : message
        ),
        {
          id: chatId(),
          role: 'assistant',
          content: `Blocked time saved for ${fmtDateTime(proposal.startAt, dashboardTimeZone)} to ${fmtDateTime(proposal.endAt, dashboardTimeZone)}.`,
          sections: [{ title: 'Saved', items: [`${proposal.title} is now blocking public bookings during that time.`] }],
          mode: 'fallback',
        },
      ]);
      await refreshAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save calendar block');
    } finally {
      setChatActionLoadingId(null);
    }
  };

  const cancelChatProposal = (messageId: string) => {
    setChatMessages((messages) =>
      messages.map((message) =>
        message.id === messageId && message.actionProposal
          ? { ...message, actionProposal: { ...message.actionProposal, status: 'cancelled' as const } }
          : message
      )
    );
  };

  /* ?? Booking ?????????????????????????????????????????????????????? */

  const openNewBooking = () => { setConvertLeadId(null); setForm({ ...emptyForm, clientId: selectedJob?.clientId || '', clientName: clientDetails?.client.name || selectedJob?.clientName || '' }); setModalOpen(true); };

  const openConvertLead = (lead: Lead) => {
    const matched = getOfferingById(servicesContent, lead.service_catalog_id) || findOfferingByTitle(servicesContent, lead.service_type);
    setConvertLeadId(lead.id);
    setForm({
      ...emptyForm, clientName: lead.name,
      serviceCatalogId: matched?.id || (lead.service_type ? 'custom' : ''),
      serviceAddonIds: lead.service_addon_ids || [],
      customServiceType: matched ? '' : lead.service_type || '',
      vehicleMake: lead.vehicle_make || '', vehicleModel: lead.vehicle_model || '',
      vehicleYear: lead.vehicle_year ? String(lead.vehicle_year) : '',
      notes: [getLeadServiceDisplay(lead), leadService(lead) ? `Preferred: ${leadService(lead)}` : '', leadIssue(lead) ? `Issue: ${leadIssue(lead)}` : '', leadNotes(lead) ? `Notes: ${leadNotes(lead)}` : ''].filter(Boolean).join('\n'),
    });
    setModalOpen(true);
    setView('schedule');
  };

  const submitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true); setError(null);
      const primary = form.serviceCatalogId && form.serviceCatalogId !== 'custom' ? getOfferingById(servicesContent, form.serviceCatalogId) : null;
      const addOns = resolveAddOns(form.serviceAddonIds);
      const svcType = primary ? buildServiceLabel(primary, addOns, primary.title) : form.customServiceType.trim() || form.clientName;
      const svcCatalogId = primary?.id ?? null;
      const svcAddonIds = primary ? addOns.map((a) => a.id) : [];

      if (convertLeadId) {
        const lead = leads.find((l) => l.id === convertLeadId);
        if (!lead) throw new Error('Lead not found');
        await apiRequest(`/api/leads/${convertLeadId}/convert`, { method: 'POST', body: JSON.stringify({
          client: { name: lead.name, email: lead.email || undefined, phone: lead.phone || undefined },
          serviceJob: { clientName: form.clientName || lead.name, serviceType: svcType, serviceCatalogId: svcCatalogId, serviceAddonIds: svcAddonIds, status: 'scheduled', scheduledAt: form.scheduledAt ? dateTimeInputToUtcIso(form.scheduledAt, dashboardTimeZone) : null, notes: form.notes || null, vehicleMake: form.vehicleMake || null, vehicleModel: form.vehicleModel || null, vehicleYear: form.vehicleYear ? Number(form.vehicleYear) : null, estimatedAmount: form.estimatedAmount ? Number(form.estimatedAmount) : 0, paymentStatus: 'unpaid' },
        }) });
      } else {
        await apiRequest('/api/service-jobs', { method: 'POST', body: JSON.stringify({ clientId: form.clientId || null, clientName: form.clientName, serviceType: svcType, serviceCatalogId: svcCatalogId, serviceAddonIds: svcAddonIds, status: 'scheduled', scheduledAt: form.scheduledAt ? dateTimeInputToUtcIso(form.scheduledAt, dashboardTimeZone) : null, vehicleMake: form.vehicleMake || null, vehicleModel: form.vehicleModel || null, vehicleYear: form.vehicleYear ? Number(form.vehicleYear) : null, estimatedAmount: form.estimatedAmount ? Number(form.estimatedAmount) : 0, paymentStatus: 'unpaid', notes: form.notes || null }) });
      }
      setModalOpen(false); setConvertLeadId(null); setForm(emptyForm); await refreshAll();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Failed to save booking'); }
    finally { setSubmitting(false); }
  };

  const updateFormService = (updates: Partial<Pick<BookingForm, 'serviceCatalogId' | 'serviceAddonIds' | 'customServiceType'>>) => {
    setForm((f) => {
      const next = { ...f, ...updates };
      const p = next.serviceCatalogId && next.serviceCatalogId !== 'custom' ? getOfferingById(servicesContent, next.serviceCatalogId) : null;
      if (p?.fixedPriceAmount) {
        const addOns = resolveAddOns(next.serviceAddonIds);
        const total = p.fixedPriceAmount + addOns.reduce((s, a) => s + Number(a.fixedPriceAmount || 0), 0);
        next.estimatedAmount = String(total);
      } else { next.estimatedAmount = ''; }
      return next;
    });
  };

  const openBlockModal = (seed?: Partial<CalendarBlockForm>) => {
    setBlockForm({ ...defaultCalendarBlockForm(dashboardTimeZone), ...seed });
    setBlockModalOpen(true);
  };

  const submitCalendarBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBlockSubmitting(true);
      setError(null);
      const startLocal = parseDateTimeInputValue(blockForm.startAt);
      const endLocal = parseDateTimeInputValue(blockForm.endAt);
      if (!startLocal || !endLocal) {
        throw new Error('Choose a valid Toronto start and end time.');
      }
      await apiRequest('/api/dashboard/calendar-blocks', {
        method: 'POST',
        body: JSON.stringify({
          startAt: dateTimeInputToUtcIso(blockForm.startAt, dashboardTimeZone),
          endAt: dateTimeInputToUtcIso(blockForm.endAt, dashboardTimeZone),
          startDateKey: startLocal.dateKey,
          startMinutes: startLocal.totalMinutes,
          endDateKey: endLocal.dateKey,
          endMinutes: endLocal.totalMinutes,
          source: blockForm.source,
          title: blockForm.title.trim(),
          notes: blockForm.notes.trim() || undefined,
        }),
      });
      setBlockModalOpen(false);
      await refreshAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save blocked time');
    } finally {
      setBlockSubmitting(false);
    }
  };

  const deleteCalendarBlock = async (id: string) => {
    try {
      setDeletingBlockId(id);
      setError(null);
      await apiRequest(`/api/dashboard/calendar-blocks${qs({ id })}`, { method: 'DELETE' });
      await refreshAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove blocked time');
    } finally {
      setDeletingBlockId(null);
    }
  };

  /* ?? Render ??????????????????????????????????????????????????????? */

  return (
    <AuthGate title="Dashboard">
      <div className="min-h-screen bg-[#f5f5f7]">
        <div className="mx-auto max-w-[90rem] px-5 py-6 lg:px-8">

          {/* Header */}
          <header className="mb-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-[2rem] font-semibold tracking-tight text-[#1d1d1f] sm:text-[2.25rem]">Dashboard</h1>
                <p className="mt-0.5 text-[14px] text-[#86868b]">{board?.summary.totalJobs ?? 0} clients &middot; {auth?.email ?? 'Signed in'}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => { setNotifsOpen(!notifsOpen); setCopilotOpen(false); }} className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-[#86868b] transition-colors hover:bg-black/5 hover:text-[#1d1d1f]">
                  <Bell className="h-[18px] w-[18px]" />
                  {unreadNotifs.length > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}
                </button>
                <button type="button" onClick={() => { setCopilotOpen(!copilotOpen); setNotifsOpen(false); }} className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors ${copilotOpen ? 'bg-[#0071e3] text-white' : 'text-[#86868b] hover:bg-black/5 hover:text-[#1d1d1f]'}`}>
                  <Bot className="h-[18px] w-[18px]" />
                </button>
                <button type="button" onClick={openNewBooking} className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-[#0071e3] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#0077ed]">
                  <Plus className="h-3.5 w-3.5" /> New
                </button>
                <button type="button" onClick={refreshAll} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#86868b] transition-colors hover:bg-black/5 hover:text-[#1d1d1f]">
                  <RotateCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Toolbar */}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex gap-0.5 rounded-xl bg-white/60 p-1 shadow-sm backdrop-blur">
                {viewTabs.map((t) => {
                  const Icon = t.icon; const active = view === t.id;
                  return (
                    <button key={t.id} type="button" onClick={() => setView(t.id)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${active ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}>
                      <Icon className="h-3.5 w-3.5" /> {t.label}
                    </button>
                  );
                })}
              </div>
              <label className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#86868b]" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients, services, leads..." className="w-full rounded-xl border border-black/[0.06] bg-white/80 py-2 pl-9 pr-4 text-[13px] text-[#1d1d1f] placeholder:text-[#86868b] backdrop-blur outline-none transition-colors focus:border-[#0071e3]/40 focus:bg-white" />
              </label>
              {(view === 'schedule' || view === 'calendar') && (
                <div className="flex gap-0.5 rounded-xl bg-white/60 p-1 shadow-sm backdrop-blur">
                  {presetOptions.map((p) => (
                    <button key={p.value} type="button" onClick={() => setPreset(p.value)} className={`rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${preset === p.value ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}>{p.label}</button>
                  ))}
                </div>
              )}
              {view === 'calendar' && (
                <button type="button" onClick={openBlockModal} className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.06] bg-white/80 px-3.5 py-2 text-[13px] font-medium text-[#1d1d1f] shadow-sm backdrop-blur transition-colors hover:border-[#0071e3]/30 hover:text-[#0071e3]">
                  <Plus className="h-3.5 w-3.5" /> Block time
                </button>
              )}
            </div>
          </header>

          {error && <div className="mb-5 rounded-xl border border-red-200/60 bg-red-50/80 px-4 py-2.5 text-[13px] text-red-700">{error}</div>}

          {/* Content */}
          {loading ? (
            <div className="flex h-96 items-center justify-center"><p className="text-[14px] text-[#86868b]">Loading&hellip;</p></div>
          ) : (
            <div className="flex gap-5">
              <div className="min-w-0 flex-1">
                {view === 'schedule' && <ScheduleView board={board} filtered={filteredJobs} selectedId={selectedJob?.id ?? null} onSelect={setSelectedJobId} selectedJob={selectedJob} clientDetails={clientDetails} onOpen360={() => setCustomer360Open(true)} timeZone={dashboardTimeZone} />}
                {view === 'calendar' && <CalendarView board={board} filtered={filteredJobs} selectedId={selectedJob?.id ?? null} onSelect={setSelectedJobId} onOpenBlock={openBlockModal} onDeleteBlock={deleteCalendarBlock} deletingBlockId={deletingBlockId} timeZone={dashboardTimeZone} />}
                {view === 'leads' && <LeadsView leads={filteredLeads} selected={selectedLead} onSelect={setSelectedLeadId} getServiceDisplay={getLeadServiceDisplay} onConvert={openConvertLead} />}
                {view === 'reports' && <ReportsView reports={reports} timeZone={dashboardTimeZone} />}
              </div>

              {/* Copilot slide-over */}
              {copilotOpen && (
                <div className="hidden h-[min(28rem,calc(100vh-11rem))] w-[340px] min-h-[22rem] min-w-[320px] max-h-[calc(100vh-8rem)] max-w-[min(52vw,48rem)] flex-none self-start overflow-auto resize lg:block">
                  <CopilotPanel messages={chatMessages} input={chatInput} onInputChange={setChatInput} onSend={sendChat} sending={chatSending} onClose={() => setCopilotOpen(false)} onConfirmProposal={confirmChatProposal} onCancelProposal={cancelChatProposal} actionLoadingId={chatActionLoadingId} timeZone={dashboardTimeZone} />
                </div>
              )}

              {/* Notifications slide-over */}
              {notifsOpen && !copilotOpen && (
                <div className="hidden w-[340px] flex-none lg:block">
                  <NotificationsPanel notifications={notifications} unread={unreadNotifs} onClose={() => setNotifsOpen(false)} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Customer 360 Overlay */}
        {customer360Open && clientDetails && (
          <Customer360Overlay details={clientDetails} onClose={() => setCustomer360Open(false)} timeZone={dashboardTimeZone} />
        )}

        {/* Booking Modal */}
        {modalOpen && (
          <BookingModal form={form} setForm={setForm} onSubmit={submitBooking} submitting={submitting} onClose={() => { setModalOpen(false); setConvertLeadId(null); }} convertLead={convertLeadId ? leads.find((l) => l.id === convertLeadId) ?? null : null} groupedPrimary={groupedPrimary} addOns={addOnOfferings} onServiceChange={updateFormService} timeZone={dashboardTimeZone} />
        )}

        {blockModalOpen && (
          <CalendarBlockModal form={blockForm} setForm={setBlockForm} submitting={blockSubmitting} onSubmit={submitCalendarBlock} onClose={() => setBlockModalOpen(false)} timeZone={dashboardTimeZone} />
        )}

        {/* Mobile copilot overlay */}
        {copilotOpen && (
          <div className="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm lg:hidden">
            <div className="absolute inset-x-0 bottom-0 top-12 rounded-t-2xl bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.12)]">
              <CopilotPanel messages={chatMessages} input={chatInput} onInputChange={setChatInput} onSend={sendChat} sending={chatSending} onClose={() => setCopilotOpen(false)} onConfirmProposal={confirmChatProposal} onCancelProposal={cancelChatProposal} actionLoadingId={chatActionLoadingId} timeZone={dashboardTimeZone} />
            </div>
          </div>
        )}
      </div>
    </AuthGate>
  );
};

/* ?? Schedule View ??????????????????????????????????????????????????? */

const ScheduleView: React.FC<{
  board: ScheduleBoardResponse | null; filtered: ScheduleBoardJob[]; selectedId: string | null;
  onSelect: (id: string) => void; selectedJob: ScheduleBoardJob | null;
  clientDetails: CustomerWorkspaceResponse | null; onOpen360: () => void;
  timeZone: string;
}> = ({ board, filtered, selectedId, onSelect, selectedJob, clientDetails, onOpen360, timeZone }) => (
  <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
    {/* List */}
    <Card>
      <div className="border-b border-black/[0.04] px-5 py-3">
        <span className="text-[13px] font-medium text-[#86868b]">{filtered.length} appointment{filtered.length === 1 ? '' : 's'}</span>
      </div>
      <div className="max-h-[calc(100vh-17rem)] overflow-y-auto">
        {board?.groups.length ? board.groups.map((g) => {
          const vis = g.jobs.filter((j) => filtered.some((f) => f.id === j.id));
          if (!vis.length) return null;
          return (
            <div key={g.key}>
              <div className="sticky top-0 z-10 border-b border-black/[0.04] bg-[#f5f5f7]/90 px-5 py-2 backdrop-blur-sm">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-[#86868b]">{fmtDateHeading(g.date, timeZone)}</span>
              </div>
              {vis.map((j) => (
                <button key={j.id} type="button" onClick={() => onSelect(j.id)} className={`w-full border-b border-black/[0.04] px-5 py-3.5 text-left transition-colors ${selectedId === j.id ? 'bg-[#0071e3]/[0.05]' : 'hover:bg-black/[0.02]'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`h-2 w-2 flex-none rounded-full ${statusDot(j.uiStatus)}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[14px] font-medium text-[#1d1d1f]">{j.clientName}</span>
                        <span className="flex-none text-[12px] tabular-nums text-[#86868b]">{fmtTime(j.scheduledAt, timeZone)}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[#86868b]">
                        <span className="truncate">{j.serviceType}</span>
                        {j.vehicleLabel && j.vehicleLabel !== 'Not captured' && <><span className="text-black/15">&middot;</span><span className="truncate">{j.vehicleLabel}</span></>}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          );
        }) : <Empty msg="No appointments in this range." />}
      </div>
    </Card>

    {/* Detail */}
    <div className="lg:sticky lg:top-6 lg:self-start">
      {selectedJob ? (
        <div className="space-y-4">
          <Card>
            <div className="px-5 pt-5 pb-4">
              <h2 className="text-xl font-semibold tracking-tight text-[#1d1d1f]">{selectedJob.clientName}</h2>
              <p className="mt-0.5 text-[13px] text-[#86868b]">{selectedJob.serviceType}</p>
            </div>
            <div className="border-t border-black/[0.04] px-5 py-4">
              <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                <DField label="Time" value={fmtTimeRange(selectedJob.scheduledAt, selectedJob.scheduledEndAt, timeZone)} />
                <DField label="Status" value={selectedJob.uiStatus.charAt(0).toUpperCase() + selectedJob.uiStatus.slice(1)} />
                <DField label="Vehicle" value={selectedJob.vehicleLabel || 'Not provided'} />
                <DField label="Amount" value={currency(selectedJob.estimatedAmount)} />
              </div>
            </div>
            {selectedJob.pickupRequested && <div className="border-t border-black/[0.04] px-5 py-3"><div className="flex items-center gap-2 text-[12px]"><span className="h-1.5 w-1.5 rounded-full bg-[#0071e3]" /><span className="font-medium text-[#1d1d1f]">Pickup requested</span></div></div>}
            {selectedJob.notes && <div className="border-t border-black/[0.04] px-5 py-4"><span className="text-[11px] font-medium text-[#86868b]">Notes</span><p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-[#1d1d1f]/80">{selectedJob.notes}</p></div>}
          </Card>
          {selectedJob.clientId && (
            <button type="button" onClick={onOpen360} className="flex w-full items-center justify-between rounded-xl border border-black/[0.04] bg-white px-5 py-3 text-[13px] font-medium text-[#1d1d1f] shadow-sm transition-colors hover:bg-[#f5f5f7]">
              <span>Customer 360 &middot; {clientDetails?.client.name ?? 'Loading...'}</span>
              <ChevronRight className="h-4 w-4 text-[#86868b]" />
            </button>
          )}
        </div>
      ) : (
        <Card className="flex h-56 items-center justify-center"><p className="text-[13px] text-[#86868b]">Select a client to view details</p></Card>
      )}
    </div>
  </div>
);

/* ?? Calendar View ??????????????????????????????????????????????????? */

const CalendarView: React.FC<{
  board: ScheduleBoardResponse | null; filtered: ScheduleBoardJob[];
  selectedId: string | null; onSelect: (id: string) => void;
  onOpenBlock: (seed?: Partial<CalendarBlockForm>) => void; onDeleteBlock: (id: string) => void; deletingBlockId: string | null;
  timeZone: string;
}> = ({ board, filtered, selectedId, onSelect, onOpenBlock, onDeleteBlock, deletingBlockId, timeZone }) => {
  const hours = useMemo(() => Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR }, (_, i) => CALENDAR_START_HOUR + i), []);
  const [draftBlock, setDraftBlock] = useState<{ dayKey: string; dateKey: string; startMinutes: number; endMinutes: number } | null>(null);
  const dragRef = useRef<{ dayKey: string; dateKey: string; anchorMinutes: number } | null>(null);

  const days = useMemo(() => {
    if (!board) return [];
    const jobDays = board.groups
      .filter((g) => g.date)
      .map((g) => ({
        key: getTimeZoneDateKey(g.date!, timeZone),
        dateKey: getTimeZoneDateKey(g.date!, timeZone),
        label: g.label,
        jobs: g.jobs.filter((j) => filtered.some((f) => f.id === j.id) && j.scheduledAt),
      }));
    const dayMap = new Map<string, { key: string; dateKey: string; label: string; jobs: ScheduleBoardJob[] }>(
      jobDays.map((day) => [day.key, day])
    );

    board.blocks.forEach((block) => {
      let cursorKey = getTimeZoneDateKey(block.startAt, timeZone);
      const endKey = getTimeZoneDateKey(block.endAt, timeZone);
      while (cursorKey && cursorKey <= endKey) {
        if (!dayMap.has(cursorKey)) {
          dayMap.set(cursorKey, {
            key: cursorKey,
            dateKey: cursorKey,
            label: fmtDateHeading(cursorKey, timeZone),
            jobs: [],
          });
        }
        cursorKey = shiftTimeZoneDateKey(cursorKey, 1, timeZone);
      }
    });

    return Array.from(dayMap.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [board, filtered, timeZone]);

  const cols = Math.max(days.length, 1);
  const now = new Date();
  const nowParts = getTimeZoneParts(now, timeZone);
  const nowH = (nowParts?.hour || 0) + (nowParts?.minute || 0) / 60;
  const nowPx = nowH >= CALENDAR_START_HOUR && nowH <= CALENDAR_END_HOUR ? (nowH - CALENDAR_START_HOUR) * HOUR_PX : null;
  const blocks = board?.blocks || [];
  const hourOffset = (value: string | Date) => {
    const parts = getTimeZoneParts(value, timeZone);
    return (parts?.hour || 0) + (parts?.minute || 0) / 60;
  };

  const readMinutesFromPointer = useCallback((event: MouseEvent | React.MouseEvent<HTMLDivElement>, container: HTMLDivElement) => {
    const rect = container.getBoundingClientRect();
    const y = Math.max(0, Math.min(event.clientY - rect.top, rect.height));
    const rawMinutes = CALENDAR_START_HOUR * 60 + (y / HOUR_PX) * 60;
    return snapMinutes(rawMinutes);
  }, []);

  const finishDraft = useCallback(() => {
    const selection = draftBlock;
    dragRef.current = null;
    setDraftBlock(null);
    if (!selection) return;
    const startMinutes = Math.min(selection.startMinutes, selection.endMinutes);
    const endMinutes = Math.max(selection.startMinutes, selection.endMinutes) + CALENDAR_DRAG_STEP_MINUTES;
    const startAt = withTimeOnDate(selection.dateKey, startMinutes, timeZone);
    const endAt = withTimeOnDate(selection.dateKey, endMinutes, timeZone);
    onOpenBlock({
      startAt: formatForDateTimeInput(startAt, timeZone),
      endAt: formatForDateTimeInput(endAt, timeZone),
    });
  }, [draftBlock, onOpenBlock, timeZone]);

  useEffect(() => {
    if (!draftBlock) return;
    const onMouseUp = () => finishDraft();
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, [draftBlock, finishDraft]);

  const handleColumnMouseDown = (event: React.MouseEvent<HTMLDivElement>, day: { key: string; dateKey: string }) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-calendar-event="job"]')) return;
    if (!(event.currentTarget instanceof HTMLDivElement)) return;
    const minutes = readMinutesFromPointer(event, event.currentTarget);
    dragRef.current = { dayKey: day.key, dateKey: day.dateKey, anchorMinutes: minutes };
    setDraftBlock({ dayKey: day.key, dateKey: day.dateKey, startMinutes: minutes, endMinutes: minutes });
  };

  const handleColumnMouseMove = (event: React.MouseEvent<HTMLDivElement>, day: { key: string; dateKey: string }) => {
    const current = dragRef.current;
    if (!current || current.dayKey !== day.key) return;
    if (!(event.currentTarget instanceof HTMLDivElement)) return;
    const minutes = readMinutesFromPointer(event, event.currentTarget);
    setDraftBlock({ dayKey: day.key, dateKey: day.dateKey, startMinutes: current.anchorMinutes, endMinutes: minutes });
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.04] px-5 py-4">
          <div>
            <div className="text-[13px] font-medium text-[#1d1d1f]">Calendar control</div>
            <p className="mt-0.5 text-[12px] text-[#86868b]">Block time for walk-ins, doorstep jobs, or internal holds. Blocked time stays visible to the public as unavailable. All calendar dates and times are shown in Toronto time.</p>
          </div>
          <button type="button" onClick={onOpenBlock} className="inline-flex items-center gap-1.5 rounded-full bg-[#1d1d1f] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-black">
            <Plus className="h-3.5 w-3.5" /> Block time
          </button>
        </div>

        {/* Day headers */}
        <div className="grid border-b border-black/[0.04]" style={{ gridTemplateColumns: `52px repeat(${cols}, 1fr)` }}>
          <div />
          {days.map((d) => {
            const isToday = d.dateKey === getTimeZoneDateKey(now, timeZone);
            return (
              <div key={d.key} className="border-l border-black/[0.04] px-2 py-3 text-center">
                <div className="text-[11px] font-medium uppercase tracking-wide text-[#86868b]">{fmtDayShort(d.dateKey, timeZone)}</div>
                <div className={`mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-[16px] font-semibold ${isToday ? 'bg-[#0071e3] text-white' : 'text-[#1d1d1f]'}`}>{fmtDayNum(d.dateKey, timeZone)}</div>
              </div>
            );
          })}
        </div>

        {/* Grid */}
        <div className="max-h-[calc(100vh-18rem)] overflow-y-auto">
          <div className="relative grid" style={{ gridTemplateColumns: `52px repeat(${cols}, 1fr)` }}>
            <div>
              {hours.map((h) => (
                <div key={h} className="relative border-b border-black/[0.04]" style={{ height: HOUR_PX }}>
                  <span className="absolute -top-2.5 right-2 text-[10px] font-medium tabular-nums text-[#86868b]">
                    {h % 12 || 12} {h < 12 ? 'AM' : 'PM'}
                  </span>
                </div>
              ))}
            </div>

            {days.map((d) => {
              const viewStart = withTimeOnDate(d.dateKey, CALENDAR_START_HOUR * 60, timeZone);
              const viewEnd = withTimeOnDate(d.dateKey, CALENDAR_END_HOUR * 60, timeZone);
              const dayBlocks = blocks.filter((block) => {
                const start = new Date(block.startAt);
                const end = new Date(block.endAt);
                return start < viewEnd && end > viewStart;
              });

              return (
                <div key={d.key} className="relative cursor-crosshair border-l border-black/[0.04]" onMouseDown={(event) => handleColumnMouseDown(event, d)} onMouseMove={(event) => handleColumnMouseMove(event, d)}>
                  {hours.map((h) => <div key={h} className="border-b border-black/[0.04]" style={{ height: HOUR_PX }} />)}

                  {nowPx !== null && d.dateKey === getTimeZoneDateKey(now, timeZone) && (
                    <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: nowPx }}>
                      <span className="h-2.5 w-2.5 -translate-x-[5px] rounded-full bg-red-500" />
                      <span className="h-[1.5px] flex-1 bg-red-500" />
                    </div>
                  )}

                  {draftBlock?.dayKey === d.key && (
                    (() => {
                      const startMinutes = Math.min(draftBlock.startMinutes, draftBlock.endMinutes);
                      const endMinutes = Math.max(draftBlock.startMinutes, draftBlock.endMinutes) + CALENDAR_DRAG_STEP_MINUTES;
                      const top = ((startMinutes / 60) - CALENDAR_START_HOUR) * HOUR_PX;
                      const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_PX, 28);
                      return (
                        <div className="pointer-events-none absolute inset-x-1 z-30 overflow-hidden rounded-lg border border-dashed border-[#1d1d1f]/25 bg-white/70 px-2 py-1 shadow-sm backdrop-blur-[1px]" style={{ top, height }}>
                          <div className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[#1d1d1f]">New block</div>
                          {height > 34 && <div className="truncate text-[11px] text-[#1d1d1f]">{fmtTime(withTimeOnDate(d.dateKey, startMinutes, timeZone).toISOString(), timeZone)} - {fmtTime(withTimeOnDate(d.dateKey, endMinutes, timeZone).toISOString(), timeZone)}</div>}
                        </div>
                      );
                    })()
                  )}

                  {dayBlocks.map((block) => {
                    const blockStart = new Date(Math.max(new Date(block.startAt).getTime(), viewStart.getTime()));
                    const blockEnd = new Date(Math.min(new Date(block.endAt).getTime(), viewEnd.getTime()));
                    const startH = hourOffset(blockStart);
                    const endH = hourOffset(blockEnd);
                    const top = Math.max((startH - CALENDAR_START_HOUR) * HOUR_PX, 0);
                    const height = Math.max((endH - startH) * HOUR_PX, 28);
                    return (
                      <div key={`${d.key}-${block.id}`} className={`pointer-events-none absolute inset-x-1 z-10 overflow-hidden rounded-lg border border-dashed px-2 py-1 ${calendarBlockTone(block.source)}`} style={{ top, height }}>
                        <div className="truncate text-[10px] font-semibold uppercase tracking-[0.14em]">{calendarBlockLabel(block.source)}</div>
                        {height > 34 && <div className="truncate text-[11px]">{block.title}</div>}
                        {height > 50 && <div className="truncate text-[10px] opacity-70">{fmtTime(block.startAt, timeZone)} - {fmtTime(block.endAt, timeZone)}</div>}
                      </div>
                    );
                  })}

                  {d.jobs.map((j) => {
                    if (!j.scheduledAt) return null;
                    const startH = hourOffset(j.scheduledAt);
                    const endH = j.scheduledEndAt ? hourOffset(j.scheduledEndAt) : startH + 1.5;
                    const top = (startH - CALENDAR_START_HOUR) * HOUR_PX;
                    const height = Math.max((endH - startH) * HOUR_PX, 28);
                    return (
                      <button key={j.id} data-calendar-event="job" type="button" onClick={() => onSelect(j.id)} className={`absolute inset-x-1 z-20 overflow-hidden rounded-lg border px-2 py-1 text-left transition-shadow ${calBlockColor(j.uiStatus)} ${selectedId === j.id ? 'ring-2 ring-[#0071e3] ring-offset-1' : 'hover:shadow-md'}`} style={{ top, height }}>
                        <div className="truncate text-[11px] font-semibold leading-tight">{j.clientName}</div>
                        {height > 36 && <div className="truncate text-[10px] opacity-75">{j.serviceType}</div>}
                        {height > 52 && <div className="truncate text-[10px] opacity-60">{fmtTime(j.scheduledAt, timeZone)}</div>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {board?.groups.some((g) => !g.date && g.jobs.length > 0) && (
          <div className="border-t border-black/[0.04] px-5 py-3 text-[12px] text-[#86868b]">
            {board.groups.find((g) => !g.date)?.jobs.length ?? 0} unscheduled appointment(s) not shown on the calendar.
          </div>
        )}
      </Card>

      <Card>
        <div className="border-b border-black/[0.04] px-5 py-3">
          <span className="text-[13px] font-medium text-[#86868b]">{blocks.length} blocked window{blocks.length === 1 ? '' : 's'}</span>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {blocks.length ? blocks.map((block) => (
            <div key={block.id} className="flex items-start justify-between gap-3 border-b border-black/[0.04] px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-medium text-[#1d1d1f]">{block.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${calendarBlockBadge(block.source)}`}>{calendarBlockLabel(block.source)}</span>
                </div>
                <div className="mt-1 text-[12px] text-[#86868b]">{fmtDateTime(block.startAt, timeZone)} - {fmtDateTime(block.endAt, timeZone)}</div>
                {block.notes && <div className="mt-1 text-[12px] leading-relaxed text-[#515154]">{block.notes}</div>}
              </div>
              <button type="button" onClick={() => onDeleteBlock(block.id)} disabled={deletingBlockId === block.id} className="rounded-full border border-black/[0.08] px-3 py-1.5 text-[12px] font-medium text-[#86868b] transition-colors hover:border-red-200 hover:text-red-600 disabled:opacity-50">
                {deletingBlockId === block.id ? 'Removing...' : 'Remove'}
              </button>
            </div>
          )) : <div className="px-5 py-8 text-center text-[13px] text-[#86868b]">No blocked windows yet.</div>}
        </div>
      </Card>
    </div>
  );
};

/* ?? Leads View ?????????????????????????????????????????????????????? */

const LeadsView: React.FC<{
  leads: Lead[]; selected: Lead | null; onSelect: (id: string) => void;
  getServiceDisplay: (l: Lead) => string; onConvert: (l: Lead) => void;
}> = ({ leads: items, selected, onSelect, getServiceDisplay, onConvert }) => (
  <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
    <Card>
      <div className="border-b border-black/[0.04] px-5 py-3"><span className="text-[13px] font-medium text-[#86868b]">{items.length} lead{items.length === 1 ? '' : 's'}</span></div>
      <div className="max-h-[calc(100vh-17rem)] overflow-y-auto">
        {items.length ? items.map((l) => (
          <button key={l.id} type="button" onClick={() => onSelect(l.id)} className={`w-full border-b border-black/[0.04] px-5 py-3.5 text-left transition-colors ${selected?.id === l.id ? 'bg-[#0071e3]/[0.05]' : 'hover:bg-black/[0.02]'}`}>
            <div className="flex items-center gap-3">
              <span className={`h-2 w-2 flex-none rounded-full ${leadDot(l.ui_status)}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[14px] font-medium text-[#1d1d1f]">{l.name}</span>
                  <span className="flex-none text-[11px] font-medium text-[#86868b]">{leadStatusLabel[l.ui_status || 'new_lead']}</span>
                </div>
                <div className="mt-0.5 text-[12px] text-[#86868b]">{getServiceDisplay(l) || 'Service request'} &middot; {fmtRelative(l.created_at)}</div>
              </div>
            </div>
          </button>
        )) : <Empty msg="No matching leads." />}
      </div>
    </Card>

    <div className="lg:sticky lg:top-6 lg:self-start">
      {selected ? (
        <Card>
          <div className="px-5 pt-5 pb-4">
            <h2 className="text-xl font-semibold tracking-tight text-[#1d1d1f]">{selected.name}</h2>
            <p className="mt-0.5 text-[13px] text-[#86868b]">{selected.phone || selected.email || 'No contact info'}</p>
          </div>
          <div className="border-t border-black/[0.04] px-5 py-4 space-y-3">
            <DField label="Requested service" value={getServiceDisplay(selected) || 'Service request'} />
            <DField label="Preferred timing" value={leadService(selected) || 'Not specified'} />
            {leadIssue(selected) && <DField label="Issue details" value={leadIssue(selected)} />}
            {leadNotes(selected) && <DField label="Notes" value={leadNotes(selected)} />}
            {leadPhotos(selected) > 0 && <DField label="Photos" value={`${leadPhotos(selected)} uploaded`} />}
            {leadPickup(selected) && <DField label="Pickup" value="Requested" />}
            {leadRef(selected) && <DField label="Reference" value={leadRef(selected)} />}
          </div>
          <div className="border-t border-black/[0.04] px-5 py-4">
            <button type="button" onClick={() => onConvert(selected)} className="w-full rounded-xl bg-[#0071e3] py-2.5 text-center text-[13px] font-medium text-white transition-colors hover:bg-[#0077ed]">Convert to Booking</button>
          </div>
        </Card>
      ) : <Card className="flex h-56 items-center justify-center"><p className="text-[13px] text-[#86868b]">Select a lead to view details</p></Card>}
    </div>
  </div>
);

/* ?? Reports View ???????????????????????????????????????????????????? */

const ReportsView: React.FC<{ reports: ReportsResponse | null; timeZone: string }> = ({ reports, timeZone }) => {
  if (!reports) return <Card className="flex h-56 items-center justify-center"><p className="text-[13px] text-[#86868b]">Reports unavailable</p></Card>;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Weekly Revenue" value={currency(reports.summary.weeklyEstimatedRevenue)} sub="Last 7 days" />
        <MetricCard label="Monthly Revenue" value={currency(reports.summary.monthlyEstimatedRevenue)} sub="Current month" />
        <MetricCard label="Vehicles Detailed" value={String(reports.summary.vehiclesDetailedCount)} sub="Completed" />
        <MetricCard label="Completed Jobs" value={String(reports.summary.completedJobsCount)} sub="Last 7 days" />
      </div>
      <Card>
        <div className="px-5 pt-5 pb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">Status Breakdown</span>
          <p className="mt-1 text-[13px] text-[#86868b]">{fmtDate(reports.summary.dateFrom, timeZone)} &ndash; {fmtDate(reports.summary.dateTo, timeZone)}</p>
        </div>
        <div className="grid gap-3 px-5 pb-5 pt-3 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(reports.jobsByStatus).map(([s, c]) => (
            <div key={s} className="rounded-xl bg-[#f5f5f7] px-4 py-3">
              <span className="text-[11px] font-medium uppercase tracking-wide text-[#86868b]">{s.replace(/_/g, ' ')}</span>
              <div className="mt-1 text-xl font-semibold text-[#1d1d1f]">{c}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

/* ?? Customer 360 Overlay ???????????????????????????????????????????? */

const Customer360Overlay: React.FC<{ details: CustomerWorkspaceResponse; onClose: () => void; timeZone: string }> = ({ details, onClose, timeZone }) => {
  const { client, summary, vehicles, serviceJobs } = details;
  const upcoming = useMemo(() => [...serviceJobs].filter((j) => j.ui_status !== 'cancelled' && j.scheduled_at).sort((a, b) => (a.scheduled_at || '').localeCompare(b.scheduled_at || '')).slice(0, 5), [serviceJobs]);
  const history = useMemo(() => [...serviceJobs].sort((a, b) => (b.scheduled_at || '').localeCompare(a.scheduled_at || '')), [serviceJobs]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-[?16px_0_48px_rgba(0,0,0,0.12)]" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/[0.04] bg-white/90 px-6 py-4 backdrop-blur">
          <h2 className="text-lg font-semibold text-[#1d1d1f]">Customer 360</h2>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#86868b] transition-colors hover:bg-black/5"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* Identity */}
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">{client.name}</h3>
            {client.company_name && <p className="mt-0.5 text-[13px] text-[#86868b]">{client.company_name}</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-[13px] text-[#86868b]">
              {client.phone && <span className="rounded-lg bg-[#f5f5f7] px-3 py-1.5">{client.phone}</span>}
              {client.email && <span className="rounded-lg bg-[#f5f5f7] px-3 py-1.5">{client.email}</span>}
              {[client.city, client.province].filter(Boolean).join(', ') && <span className="rounded-lg bg-[#f5f5f7] px-3 py-1.5">{[client.city, client.province].filter(Boolean).join(', ')}</span>}
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Lifetime Revenue" value={currency(summary.lifetimeEstimatedRevenue)} />

            <StatTile label="Total Services" value={String(serviceJobs.length)} />
            <StatTile label="Vehicles" value={String(vehicles.length)} />
          </div>

          {/* Vehicles */}
          {vehicles.length > 0 && (
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">Vehicles</span>
              <div className="mt-2 space-y-2">
                {vehicles.map((v) => (
                  <div key={v.id} className="rounded-xl bg-[#f5f5f7] px-4 py-3 text-[13px] text-[#1d1d1f]">
                    {[v.year, v.make, v.model].filter(Boolean).join(' ') || 'Unknown'}{v.color ? ` � ${v.color}` : ''}{v.plate ? ` � ${v.plate}` : ''}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming */}
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">Upcoming Services</span>
            <div className="mt-2 space-y-2">
              {upcoming.length ? upcoming.map((j) => (
                <div key={j.id} className="rounded-xl border border-black/[0.04] bg-white px-4 py-3">
                  <div className="flex items-center justify-between"><span className="text-[13px] font-medium text-[#1d1d1f]">{j.service_type}</span><span className="text-[12px] text-[#86868b]">{fmtDate(j.scheduled_at, timeZone)}</span></div>
                  <div className="mt-0.5 text-[12px] text-[#86868b]">{fmtTime(j.scheduled_at, timeZone)} &middot; {currency(j.estimated_amount)}</div>
                </div>
              )) : <p className="text-[13px] text-[#86868b]">No upcoming services.</p>}
            </div>
          </div>

          {/* History */}
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">Service History ({history.length})</span>
            <div className="mt-2 space-y-2">
              {history.slice(0, 8).map((j) => (
                <div key={j.id} className="flex items-center justify-between rounded-xl bg-[#f5f5f7] px-4 py-3">
                  <div>
                    <div className="text-[13px] font-medium text-[#1d1d1f]">{j.service_type}</div>
                    <div className="mt-0.5 text-[12px] text-[#86868b]">{fmtDate(j.scheduled_at, timeZone)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${statusDot(j.ui_status as JobUiStatus ?? 'scheduled')}`} />
                    <span className="text-[12px] text-[#86868b]">{currency(j.estimated_amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {client.notes && (
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">Internal Notes</span>
              <p className="mt-2 whitespace-pre-line rounded-xl bg-[#f5f5f7] px-4 py-3 text-[13px] leading-relaxed text-[#1d1d1f]">{client.notes}</p>
            </div>
          )}

          {/* Risk flags */}
          {summary.riskFlags.length > 0 && (
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">Risk Flags</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {summary.riskFlags.map((f) => <span key={f} className="rounded-lg bg-amber-50 px-3 py-1.5 text-[12px] font-medium text-amber-700">{f}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ?? Copilot Panel ??????????????????????????????????????????????????? */

const CopilotPanel: React.FC<{
  messages: OpsChatMessage[]; input: string; onInputChange: (v: string) => void;
  onSend: (text?: string) => void; sending: boolean; onClose: () => void;
  onConfirmProposal: (messageId: string) => void;
  onCancelProposal: (messageId: string) => void;
  actionLoadingId: string | null;
  timeZone: string;
}> = ({ messages, input, onInputChange, onSend, sending, onClose, onConfirmProposal, onCancelProposal, actionLoadingId, timeZone }) => {
  const messagesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = messagesRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  return (
    <Card className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-black/[0.04] px-4 py-2.5">
        <div className="flex items-center gap-2"><Bot className="h-4 w-4 text-[#0071e3]" /><span className="text-[14px] font-semibold text-[#1d1d1f]">Copilot</span></div>
        <button type="button" onClick={onClose} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#86868b] hover:bg-black/5"><X className="h-3.5 w-3.5" /></button>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-black/[0.04] px-4 py-2">
        {copilotPrompts.slice(0, 2).map((p) => (
          <button key={p} type="button" onClick={() => onSend(p)} disabled={sending} className="rounded-lg bg-[#f5f5f7] px-2.5 py-1 text-[11px] font-medium text-[#1d1d1f] transition-colors hover:bg-[#e8e8ed] disabled:opacity-50">{p}</button>
        ))}
      </div>

      <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-2.5 space-y-2.5">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'user' ? (
              <div className="max-w-[90%] rounded-2xl bg-[#0071e3] px-3.5 py-2 text-[13px] leading-relaxed text-white">
                {m.content}
              </div>
            ) : (
              <div className="max-w-[92%] overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
                <div className="border-b border-black/[0.04] bg-[#f5f5f7] px-3.5 py-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#86868b]">Copilot</div>
                  <div className="mt-1 text-[13px] leading-relaxed text-[#1d1d1f]">{m.content}</div>
                </div>

                {m.sections && m.sections.length > 0 && (
                  <div className="space-y-2 px-3.5 py-3">
                    {m.sections.map((section) => (
                      <div key={`${m.id}-${section.title}`} className="rounded-xl bg-[#f5f5f7] px-3 py-2.5">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">{section.title}</div>
                        <div className="mt-2 space-y-1.5">
                          {section.items.map((item) => (
                            <div key={`${m.id}-${section.title}-${item}`} className="flex items-start gap-2 text-[12px] leading-relaxed text-[#1d1d1f]">
                              <span className="mt-[6px] h-1.5 w-1.5 flex-none rounded-full bg-[#0071e3]" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {m.supportingFacts && m.supportingFacts.length > 0 && (
                  <div className="border-t border-black/[0.04] px-3.5 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">Supporting facts</div>
                    <div className="mt-2 space-y-1.5">
                      {m.supportingFacts.slice(0, 3).map((fact) => (
                        <div key={`${m.id}-${fact}`} className="text-[12px] leading-relaxed text-[#515154]">
                          {fact}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {m.warning && <div className="border-t border-black/[0.04] bg-amber-50 px-3.5 py-2 text-[11px] text-amber-700">{m.warning}</div>}

                {m.actionProposal && (
                  <div className="border-t border-black/[0.04] px-3.5 py-3">
                    <div className="rounded-xl border border-black/[0.06] bg-[#f5f5f7] px-3 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">Calendar block</div>
                      <div className="mt-1 text-[13px] font-medium text-[#1d1d1f]">{m.actionProposal.title}</div>
                      <div className="mt-1 text-[12px] leading-relaxed text-[#515154]">{fmtDateTime(m.actionProposal.startAt, timeZone)} - {fmtDateTime(m.actionProposal.endAt, timeZone)}</div>
                      <div className="mt-1 text-[12px] text-[#86868b]">{calendarBlockLabel(m.actionProposal.source)}</div>
                      {m.actionProposal.notes && <div className="mt-1 text-[12px] leading-relaxed text-[#515154]">{m.actionProposal.notes}</div>}

                      {m.actionProposal.status === 'pending_confirmation' && (
                        <div className="mt-3 flex gap-2">
                          <button type="button" onClick={() => onConfirmProposal(m.id)} disabled={actionLoadingId === m.id} className="rounded-lg bg-[#1d1d1f] px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-black disabled:opacity-50">
                            {actionLoadingId === m.id ? 'Saving...' : 'Confirm'}
                          </button>
                          <button type="button" onClick={() => onCancelProposal(m.id)} disabled={actionLoadingId === m.id} className="rounded-lg border border-black/[0.08] px-3 py-1.5 text-[11px] font-medium text-[#86868b] transition-colors hover:text-[#1d1d1f] disabled:opacity-50">
                            Cancel
                          </button>
                        </div>
                      )}

                      {m.actionProposal.status === 'confirmed' && (
                        <div className="mt-3 text-[11px] font-medium text-emerald-700">Saved to calendar.</div>
                      )}

                      {m.actionProposal.status === 'cancelled' && (
                        <div className="mt-3 text-[11px] font-medium text-[#86868b]">Proposal cancelled. Nothing was saved.</div>
                      )}
                    </div>
                  </div>
                )}

                {m.followUpQuestions && m.followUpQuestions.length > 0 && (
                  <div className="border-t border-black/[0.04] px-3.5 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">Next questions</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.followUpQuestions.slice(0, 2).map((q) => (
                        <button key={q} type="button" onClick={() => onSend(q)} className="rounded-md bg-[#f5f5f7] px-2.5 py-1.5 text-[11px] font-medium text-[#0071e3] transition-colors hover:bg-[#ebebef]">{q}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

      </div>

      <div className="border-t border-black/[0.04] px-4 py-2.5">
        <div className="flex gap-2">
          <textarea value={input} onChange={(e) => onInputChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }} rows={1} placeholder="Ask about the schedule..." className="min-h-[2.5rem] max-h-40 flex-1 resize-y rounded-xl border border-black/[0.06] bg-[#f5f5f7] px-3 py-2 text-[13px] leading-relaxed text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:border-[#0071e3]/40 focus:bg-white" />
          <button type="button" onClick={() => onSend()} disabled={sending || !input.trim()} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0071e3] text-white transition-colors hover:bg-[#0077ed] disabled:opacity-40">
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
};
/* ?? Notifications Panel ????????????????????????????????????????????? */

const NotificationsPanel: React.FC<{
  notifications: InAppNotification[]; unread: InAppNotification[]; onClose: () => void;
}> = ({ notifications, unread, onClose }) => (
  <Card className="flex max-h-[calc(100vh-11rem)] flex-col overflow-hidden">
    <div className="flex items-center justify-between border-b border-black/[0.04] px-4 py-3">
      <div className="flex items-center gap-2"><Bell className="h-4 w-4 text-[#1d1d1f]" /><span className="text-[14px] font-semibold text-[#1d1d1f]">Notifications</span>{unread.length > 0 && <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">{unread.length}</span>}</div>
      <button type="button" onClick={onClose} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#86868b] hover:bg-black/5"><X className="h-3.5 w-3.5" /></button>
    </div>
    <div className="flex-1 overflow-y-auto">
      {notifications.length ? notifications.map((n) => (
        <div key={n.id} className={`border-b border-black/[0.04] px-4 py-3 ${!n.read_at ? 'bg-[#0071e3]/[0.03]' : ''}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-[#1d1d1f]">{n.title}</div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-[#86868b]">{n.message}</p>
            </div>
            <span className="flex-none text-[11px] text-[#86868b]">{fmtRelative(n.created_at)}</span>
          </div>
        </div>
      )) : <div className="px-4 py-8 text-center text-[13px] text-[#86868b]">All clear.</div>}
    </div>
  </Card>
);

/* ?? Booking Modal ??????????????????????????????????????????????????? */

const BookingModal: React.FC<{
  form: BookingForm; setForm: React.Dispatch<React.SetStateAction<BookingForm>>;
  onSubmit: (e: React.FormEvent) => void; submitting: boolean; onClose: () => void;
  convertLead: Lead | null;
  groupedPrimary: Array<{ label: string; offerings: ServiceOffering[] }>;
  addOns: ServiceOffering[];
  onServiceChange: (u: Partial<Pick<BookingForm, 'serviceCatalogId' | 'serviceAddonIds' | 'customServiceType'>>) => void;
  timeZone: string;
}> = ({ form, setForm, onSubmit, submitting, onClose, convertLead, groupedPrimary, addOns, onServiceChange, timeZone }) => {
  const allowAddOns = Boolean(form.serviceCatalogId) && form.serviceCatalogId !== 'custom';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
        <div className="flex items-start justify-between border-b border-black/[0.04] px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-[#1d1d1f]">{convertLead ? `Convert ${convertLead.name}` : 'New Booking'}</h2>
            <p className="mt-0.5 text-[13px] text-[#86868b]">{convertLead ? 'Creates client record and first service.' : 'Add a client to the schedule.'} Times are saved in Toronto time ({timeZone}).</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#86868b] hover:bg-black/5"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <MField label="Client Name" required value={form.clientName} onChange={(v) => setForm((f) => ({ ...f, clientName: v }))} />
              <MField label="Date & Time" type="datetime-local" required value={form.scheduledAt} onChange={(v) => setForm((f) => ({ ...f, scheduledAt: v }))} />
            </div>

            {/* Service select */}
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#86868b]">Service</label>
              <select required value={form.serviceCatalogId} onChange={(e) => onServiceChange({ serviceCatalogId: e.target.value, serviceAddonIds: e.target.value === 'custom' ? [] : form.serviceAddonIds, customServiceType: e.target.value === 'custom' ? form.customServiceType : '' })} className="w-full rounded-xl border border-black/[0.08] bg-[#f5f5f7] px-4 py-2.5 text-[13px] text-[#1d1d1f] outline-none focus:border-[#0071e3]/40 focus:bg-white">
                <option value="">Select a service</option>
                {groupedPrimary.map((g) => <optgroup key={g.label} label={g.label}>{g.offerings.map((o) => <option key={o.id} value={o.id}>{o.title} &middot; {o.priceLabel}</option>)}</optgroup>)}
                <option value="custom">Custom service</option>
              </select>
            </div>
            {form.serviceCatalogId === 'custom' && <MField label="Custom Service" required value={form.customServiceType} onChange={(v) => onServiceChange({ customServiceType: v })} placeholder="Enter service name" />}

            {/* Add-ons */}
            {addOns.length > 0 && (
              <div className="rounded-xl bg-[#f5f5f7] px-4 py-3">
                <span className="text-[11px] font-medium uppercase tracking-wide text-[#86868b]">Add-ons</span>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {addOns.map((o) => (
                    <label key={o.id} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[12px] transition-colors ${form.serviceAddonIds.includes(o.id) ? 'border-[#0071e3]/30 bg-[#0071e3]/[0.04]' : 'border-black/[0.06] bg-white'} ${!allowAddOns ? 'opacity-50' : 'cursor-pointer'}`}>
                      <input type="checkbox" disabled={!allowAddOns} checked={form.serviceAddonIds.includes(o.id)} onChange={() => onServiceChange({ serviceAddonIds: form.serviceAddonIds.includes(o.id) ? form.serviceAddonIds.filter((i) => i !== o.id) : [...form.serviceAddonIds, o.id] })} className="h-3.5 w-3.5 rounded border-neutral-300 text-[#0071e3] focus:ring-[#0071e3]" />
                      <span className="text-[#1d1d1f]">{o.title}</span>
                      <span className="ml-auto text-[#86868b]">{o.priceLabel}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <MField label="Vehicle Make" value={form.vehicleMake} onChange={(v) => setForm((f) => ({ ...f, vehicleMake: v }))} />
              <MField label="Vehicle Model" value={form.vehicleModel} onChange={(v) => setForm((f) => ({ ...f, vehicleModel: v }))} />
              <MField label="Year" value={form.vehicleYear} onChange={(v) => setForm((f) => ({ ...f, vehicleYear: v }))} />
            </div>
            <MField label="Estimated Amount" value={form.estimatedAmount} onChange={(v) => setForm((f) => ({ ...f, estimatedAmount: v }))} placeholder="0" />
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#86868b]">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={4} placeholder="Prep reminders, customer preferences..." className="w-full rounded-xl border border-black/[0.08] bg-[#f5f5f7] px-4 py-2.5 text-[13px] leading-relaxed text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:border-[#0071e3]/40 focus:bg-white" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-black/[0.04] px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-full px-5 py-2.5 text-[13px] font-medium text-[#86868b] hover:text-[#1d1d1f]">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-full bg-[#0071e3] px-6 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#0077ed] disabled:opacity-50">{submitting ? 'Saving...' : convertLead ? 'Convert & Save' : 'Save Booking'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CalendarBlockModal: React.FC<{
  form: CalendarBlockForm;
  setForm: React.Dispatch<React.SetStateAction<CalendarBlockForm>>;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  timeZone: string;
}> = ({ form, setForm, submitting, onSubmit, onClose, timeZone }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-4 backdrop-blur-sm">
    <div className="flex w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between border-b border-black/[0.04] px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold text-[#1d1d1f]">Block time</h2>
          <p className="mt-0.5 text-[13px] text-[#86868b]">Reserve calendar time for walk-ins, doorstep jobs, or internal holds in Toronto time ({timeZone}).</p>
        </div>
        <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#86868b] hover:bg-black/5"><X className="h-4 w-4" /></button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 px-6 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <MField label="From" type="datetime-local" required value={form.startAt} onChange={(v) => setForm((f) => ({ ...f, startAt: v }))} />
          <MField label="To" type="datetime-local" required value={form.endAt} onChange={(v) => setForm((f) => ({ ...f, endAt: v }))} />
        </div>

        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-[#86868b]">Block type</label>
          <select value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as CalendarBlockSource, title: f.title || calendarBlockLabel(e.target.value as CalendarBlockSource) }))} className="w-full rounded-xl border border-black/[0.08] bg-[#f5f5f7] px-4 py-2.5 text-[13px] text-[#1d1d1f] outline-none focus:border-[#0071e3]/40 focus:bg-white">
            {calendarBlockSourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        <MField label="Title" required value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} placeholder="Walk-in hold" />

        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-[#86868b]">Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={4} placeholder="Optional context for the team..." className="w-full rounded-xl border border-black/[0.08] bg-[#f5f5f7] px-4 py-2.5 text-[13px] leading-relaxed text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:border-[#0071e3]/40 focus:bg-white" />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-black/[0.04] pt-4">
          <button type="button" onClick={onClose} className="rounded-full px-5 py-2.5 text-[13px] font-medium text-[#86868b] hover:text-[#1d1d1f]">Cancel</button>
          <button type="submit" disabled={submitting} className="rounded-full bg-[#1d1d1f] px-6 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-black disabled:opacity-50">
            {submitting ? 'Saving...' : 'Save block'}
          </button>
        </div>
      </form>
    </div>
  </div>
);

/* ?? Shared UI Atoms ????????????????????????????????????????????????? */

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`overflow-hidden rounded-2xl border border-black/[0.04] bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)] ${className}`}>{children}</div>
);

const DField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div><span className="text-[11px] font-medium text-[#86868b]">{label}</span><p className="mt-0.5 text-[13px] font-medium text-[#1d1d1f]">{value}</p></div>
);

const MField: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean }> = ({ label, value, onChange, type = 'text', placeholder, required }) => (
  <div>
    <label className="mb-1.5 block text-[12px] font-medium text-[#86868b]">{label}</label>
    <input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-black/[0.08] bg-[#f5f5f7] px-4 py-2.5 text-[13px] text-[#1d1d1f] placeholder:text-[#86868b] outline-none transition-colors focus:border-[#0071e3]/40 focus:bg-white" />
  </div>
);

const MetricCard: React.FC<{ label: string; value: string; sub: string }> = ({ label, value, sub }) => (
  <Card>
    <div className="px-5 py-4">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">{label}</span>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-[#1d1d1f]">{value}</div>
      <p className="mt-1 text-[12px] text-[#86868b]">{sub}</p>
    </div>
  </Card>
);

const StatTile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl bg-[#f5f5f7] px-4 py-3">
    <span className="text-[11px] font-medium uppercase tracking-wide text-[#86868b]">{label}</span>
    <div className="mt-1 text-lg font-semibold text-[#1d1d1f]">{value}</div>
  </div>
);

const Empty: React.FC<{ msg: string }> = ({ msg }) => (
  <div className="flex h-48 items-center justify-center"><p className="text-[13px] text-[#86868b]">{msg}</p></div>
);

export default Dashboard;

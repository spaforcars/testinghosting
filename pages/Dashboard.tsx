import React, { useEffect, useMemo, useState } from 'react';
import AuthGate from '../components/AuthGate';
import Button from '../components/Button';
import { apiRequest, ApiError } from '../lib/apiClient';
import type {
  BillingRecord,
  ClientRecord,
  InAppNotification,
  JobTimelineEvent,
  Lead,
  LeadStatus,
  ServiceJob,
} from '../types/platform';

type TabKey = 'overview' | 'leads' | 'jobs' | 'customers' | 'billing' | 'notifications' | 'reports';

interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface UserLite {
  id: string;
  full_name?: string;
}

interface ClientDetailsResponse {
  client: ClientRecord;
  vehicles: Array<{ id: string; make?: string; model?: string; year?: number; plate?: string }>;
  serviceJobs: ServiceJob[];
  leads: Lead[];
  timelineEvents: JobTimelineEvent[];
  billingRecords: BillingRecord[];
}

interface ReportsResponse {
  summary: Record<string, number | string>;
  leadsByStatus: Record<string, number>;
  jobsByStatus: Record<string, number>;
  billingByStatus: Record<string, number>;
  csvRows: {
    leads: Array<Record<string, unknown>>;
    jobs: Array<Record<string, unknown>>;
    billing: Array<Record<string, unknown>>;
  };
}

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'leads', label: 'Leads Kanban' },
  { key: 'jobs', label: 'Jobs Calendar' },
  { key: 'customers', label: 'Customers CRM' },
  { key: 'billing', label: 'Billing Tracker' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'reports', label: 'Reports' },
];

const leadStatuses: LeadStatus[] = [
  'lead',
  'contacted',
  'quoted',
  'booked',
  'in_service',
  'completed',
  'closed_lost',
];
const jobStatuses = ['booked', 'in_service', 'completed', 'cancelled'];
const billingStatuses = ['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void'];

const defaultPagination: PaginationState = { page: 1, pageSize: 25, total: 0, totalPages: 1 };

const query = (params: Record<string, string | number | boolean | null | undefined>) => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === null || typeof v === 'undefined' || v === '') return;
    sp.set(k, String(v));
  });
  const str = sp.toString();
  return str ? `?${str}` : '';
};

const fmt = (value?: string | null) => {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString();
};

const downloadCsv = (filename: string, rows: Array<Record<string, unknown>>) => {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const toCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [keys.join(','), ...rows.map((r) => keys.map((k) => toCell(r[k])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const Dashboard: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('overview');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [assignees, setAssignees] = useState<UserLite[]>([]);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsPagination, setLeadsPagination] = useState<PaginationState>(defaultPagination);
  const [leadFilters, setLeadFilters] = useState({
    page: 1,
    pageSize: 40,
    status: '',
    search: '',
    serviceType: '',
    assigneeId: '',
  });

  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [jobsPagination, setJobsPagination] = useState<PaginationState>(defaultPagination);
  const [jobFilters, setJobFilters] = useState({
    page: 1,
    pageSize: 40,
    status: '',
    search: '',
    assigneeId: '',
    scheduledFrom: '',
    scheduledTo: '',
  });
  const [calendarDate, setCalendarDate] = useState(new Date().toISOString().slice(0, 10));
  const [jobView, setJobView] = useState<'week' | 'list'>('week');
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [timeline, setTimeline] = useState<JobTimelineEvent[]>([]);
  const [timelineNote, setTimelineNote] = useState('');

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [clientsPagination, setClientsPagination] = useState<PaginationState>(defaultPagination);
  const [clientFilters, setClientFilters] = useState({
    page: 1,
    pageSize: 25,
    search: '',
    assigneeId: '',
    archived: false,
  });
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientDetails, setClientDetails] = useState<ClientDetailsResponse | null>(null);

  const [billing, setBilling] = useState<BillingRecord[]>([]);
  const [billingPagination, setBillingPagination] = useState<PaginationState>(defaultPagination);
  const [billingFilters, setBillingFilters] = useState({
    page: 1,
    pageSize: 25,
    status: '',
    clientId: '',
  });

  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const [reports, setReports] = useState<ReportsResponse | null>(null);
  const [reportFilters, setReportFilters] = useState({ dateFrom: '', dateTo: '' });

  const fail = (e: unknown, fallback: string) => setError(e instanceof ApiError ? e.message : fallback);

  const loadOverview = async () => {
    try {
      const [m, u] = await Promise.all([
        apiRequest<Record<string, number>>('/api/dashboard/metrics'),
        apiRequest<{ users: UserLite[] }>('/api/users'),
      ]);
      setMetrics(m || {});
      setAssignees(u.users || []);
    } catch (e) {
      fail(e, 'Failed to load overview');
    }
  };

  const loadLeads = async () => {
    try {
      const r = await apiRequest<{ leads: Lead[]; pagination: PaginationState }>(
        `/api/leads${query(leadFilters)}`
      );
      setLeads(r.leads || []);
      setLeadsPagination(r.pagination || defaultPagination);
    } catch (e) {
      fail(e, 'Failed to load leads');
    }
  };

  const loadJobs = async () => {
    try {
      const r = await apiRequest<{ serviceJobs: ServiceJob[]; pagination: PaginationState }>(
        `/api/service-jobs${query(jobFilters)}`
      );
      setJobs(r.serviceJobs || []);
      setJobsPagination(r.pagination || defaultPagination);
    } catch (e) {
      fail(e, 'Failed to load jobs');
    }
  };
  const loadTimeline = async (jobId: string) => {
    if (!jobId) return;
    try {
      const r = await apiRequest<{ events: JobTimelineEvent[] }>(`/api/service-jobs/${jobId}/timeline`);
      setTimeline(r.events || []);
    } catch (e) {
      fail(e, 'Failed to load timeline');
    }
  };

  const loadClients = async () => {
    try {
      const r = await apiRequest<{ clients: ClientRecord[]; pagination: PaginationState }>(
        `/api/clients${query(clientFilters)}`
      );
      setClients(r.clients || []);
      setClientsPagination(r.pagination || defaultPagination);
    } catch (e) {
      fail(e, 'Failed to load clients');
    }
  };

  const loadClientDetails = async (clientId: string) => {
    if (!clientId) return;
    try {
      const r = await apiRequest<ClientDetailsResponse>(`/api/clients/${clientId}`);
      setClientDetails(r);
    } catch (e) {
      fail(e, 'Failed to load client profile');
    }
  };

  const loadBilling = async () => {
    try {
      const r = await apiRequest<{ records: BillingRecord[]; pagination: PaginationState }>(
        `/api/billing-records${query(billingFilters)}`
      );
      setBilling(r.records || []);
      setBillingPagination(r.pagination || defaultPagination);
    } catch (e) {
      fail(e, 'Failed to load billing');
    }
  };

  const loadNotifications = async () => {
    try {
      const r = await apiRequest<{ notifications: InAppNotification[] }>(
        `/api/notifications/in-app${query({ unreadOnly, limit: 200 })}`
      );
      setNotifications(r.notifications || []);
    } catch (e) {
      fail(e, 'Failed to load notifications');
    }
  };

  const loadReports = async () => {
    try {
      const r = await apiRequest<ReportsResponse>(`/api/reports/summary${query(reportFilters)}`);
      setReports(r);
    } catch (e) {
      fail(e, 'Failed to load reports');
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    if (tab === 'leads') loadLeads();
    if (tab === 'jobs') loadJobs();
    if (tab === 'customers') loadClients();
    if (tab === 'billing') loadBilling();
    if (tab === 'notifications') loadNotifications();
    if (tab === 'reports') loadReports();
  }, [tab]);

  useEffect(() => {
    if (tab === 'leads') loadLeads();
  }, [leadFilters.page]);

  useEffect(() => {
    if (tab === 'jobs') loadJobs();
  }, [jobFilters.page]);

  useEffect(() => {
    if (tab === 'customers') loadClients();
  }, [clientFilters.page]);

  useEffect(() => {
    if (tab === 'billing') loadBilling();
  }, [billingFilters.page]);

  useEffect(() => {
    if (tab === 'notifications') loadNotifications();
  }, [unreadOnly]);

  useEffect(() => {
    if (selectedClientId) loadClientDetails(selectedClientId);
  }, [selectedClientId]);

  const groupedLeads = useMemo(() => {
    const map = {} as Record<LeadStatus, Lead[]>;
    leadStatuses.forEach((s) => {
      map[s] = [];
    });
    leads.forEach((lead) => {
      if (map[lead.status]) map[lead.status].push(lead);
    });
    return map;
  }, [leads]);

  const weekDays = useMemo(() => {
    const base = new Date(`${calendarDate}T00:00:00`);
    const mondayOffset = (base.getDay() + 6) % 7;
    const monday = new Date(base);
    monday.setDate(base.getDate() - mondayOffset);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [calendarDate]);

  const jobsByDate = useMemo(() => {
    const map: Record<string, ServiceJob[]> = {};
    jobs.forEach((job) => {
      const key = job.scheduled_at ? new Date(job.scheduled_at).toISOString().slice(0, 10) : 'unscheduled';
      if (!map[key]) map[key] = [];
      map[key].push(job);
    });
    return map;
  }, [jobs]);

  const updateLead = async (id: string, payload: Record<string, unknown>) => {
    try {
      setBusyId(id);
      await apiRequest(`/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      await Promise.all([loadLeads(), loadOverview()]);
    } catch (e) {
      fail(e, 'Failed to update lead');
    } finally {
      setBusyId(null);
    }
  };

  const convertLead = async (lead: Lead) => {
    try {
      setBusyId(lead.id);
      await apiRequest(`/api/leads/${lead.id}/convert`, {
        method: 'POST',
        body: JSON.stringify({
          createClient: true,
          createServiceJob: true,
          serviceJob: { serviceType: lead.service_type || 'General Service', assigneeId: lead.assignee_id || null },
        }),
      });
      await Promise.all([loadLeads(), loadJobs(), loadClients(), loadOverview()]);
      setTab('jobs');
    } catch (e) {
      fail(e, 'Failed to convert lead');
    } finally {
      setBusyId(null);
    }
  };

  const updateJob = async (id: string, payload: Record<string, unknown>) => {
    try {
      setBusyId(id);
      await apiRequest('/api/service-jobs', { method: 'PATCH', body: JSON.stringify({ id, ...payload }) });
      await Promise.all([loadJobs(), loadOverview()]);
      if (selectedJobId === id) await loadTimeline(id);
    } catch (e) {
      fail(e, 'Failed to update job');
    } finally {
      setBusyId(null);
    }
  };

  const addTimelineEvent = async () => {
    if (!selectedJobId || !timelineNote.trim()) return;
    try {
      setBusyId(selectedJobId);
      await apiRequest(`/api/service-jobs/${selectedJobId}/timeline`, {
        method: 'POST',
        body: JSON.stringify({ eventType: 'note', note: timelineNote.trim() }),
      });
      setTimelineNote('');
      await loadTimeline(selectedJobId);
    } catch (e) {
      fail(e, 'Failed to add timeline event');
    } finally {
      setBusyId(null);
    }
  };

  const markNotificationRead = async (id: string) => {
    try {
      setBusyId(id);
      await apiRequest(`/api/notifications/in-app/${id}/read`, { method: 'PATCH' });
      await Promise.all([loadNotifications(), loadOverview()]);
    } catch (e) {
      fail(e, 'Failed to mark notification read');
    } finally {
      setBusyId(null);
    }
  };

  const updateBillingStatus = async (id: string, status: string) => {
    try {
      setBusyId(id);
      await apiRequest('/api/billing-records', { method: 'PATCH', body: JSON.stringify({ id, status }) });
      await Promise.all([loadBilling(), loadOverview()]);
    } catch (e) {
      fail(e, 'Failed to update billing');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-brand-gray px-4 py-12">
      <AuthGate title="Operations Dashboard">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-4xl font-bold uppercase text-brand-black">Operations Dashboard</h1>
              <p className="mt-2 text-sm text-gray-600">
                Internal backend console: leads, jobs, customers, billing, notifications and reports.
              </p>
            </div>
            <Button variant="outline" onClick={loadOverview}>Refresh KPIs</Button>
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] ${
                    tab === t.key ? 'bg-brand-black text-white' : 'border border-neutral-300 bg-white text-neutral-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {tab === 'overview' && (
            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
              {[
                ['Total Leads', metrics.totalLeads || 0],
                ['New Leads', metrics.newLeads || 0],
                ['In Service', metrics.inService || 0],
                ['Completed', metrics.completed || 0],
                ['Unread Notifications', metrics.unreadNotifications || 0],
                ['Outstanding Billing', `$${Number(metrics.billingOutstanding || 0).toFixed(2)}`],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">{label}</p>
                  <p className="mt-2 text-2xl font-bold text-brand-black">{value}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'leads' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 md:grid-cols-5">
                  <input className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" placeholder="Search" value={leadFilters.search} onChange={(e) => setLeadFilters((p) => ({ ...p, page: 1, search: e.target.value }))} />
                  <select className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" value={leadFilters.status} onChange={(e) => setLeadFilters((p) => ({ ...p, page: 1, status: e.target.value }))}>
                    <option value="">All statuses</option>
                    {leadStatuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                  <input className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" placeholder="Service type" value={leadFilters.serviceType} onChange={(e) => setLeadFilters((p) => ({ ...p, page: 1, serviceType: e.target.value }))} />
                  <select className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" value={leadFilters.assigneeId} onChange={(e) => setLeadFilters((p) => ({ ...p, page: 1, assigneeId: e.target.value }))}>
                    <option value="">All assignees</option>
                    {assignees.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.id}</option>)}
                  </select>
                  <Button onClick={loadLeads}>Apply</Button>
                </div>
              </div>
              <div className="grid gap-4 xl:grid-cols-4">
                {leadStatuses.map((status) => (
                  <div key={status} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
                      {status.replace('_', ' ')} ({groupedLeads[status].length})
                    </p>
                    <div className="space-y-2">
                      {groupedLeads[status].map((lead) => (
                        <div key={lead.id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                          <p className="font-semibold text-brand-black">{lead.name}</p>
                          <p className="text-xs text-gray-500">{lead.email}</p>
                          <p className="mt-1 text-xs text-gray-600">{lead.service_type || 'General enquiry'}</p>
                          <div className="mt-2 grid gap-2">
                            <select className="rounded border border-neutral-300 px-2 py-1 text-xs" value={lead.status} disabled={busyId === lead.id} onChange={(e) => updateLead(lead.id, { status: e.target.value })}>
                              {leadStatuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                            </select>
                            <select className="rounded border border-neutral-300 px-2 py-1 text-xs" value={lead.assignee_id || ''} disabled={busyId === lead.id} onChange={(e) => updateLead(lead.id, { assigneeId: e.target.value || null })}>
                              <option value="">Unassigned</option>
                              {assignees.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.id}</option>)}
                            </select>
                            <Button variant="outline" className="px-2 py-1 text-xs" disabled={busyId === lead.id} onClick={() => convertLead(lead)}>
                              Convert
                            </Button>
                          </div>
                        </div>
                      ))}
                      {!groupedLeads[status].length && <p className="text-xs text-gray-400">No leads.</p>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-sm text-gray-600">Page {leadsPagination.page} / {leadsPagination.totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={leadFilters.page <= 1} onClick={() => setLeadFilters((p) => ({ ...p, page: p.page - 1 }))}>Prev</Button>
                  <Button variant="outline" disabled={leadFilters.page >= leadsPagination.totalPages} onClick={() => setLeadFilters((p) => ({ ...p, page: p.page + 1 }))}>Next</Button>
                </div>
              </div>
            </div>
          )}

          {tab === 'jobs' && (
            <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="grid gap-3 md:grid-cols-6">
                    <input className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" placeholder="Search" value={jobFilters.search} onChange={(e) => setJobFilters((p) => ({ ...p, page: 1, search: e.target.value }))} />
                    <select className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" value={jobFilters.status} onChange={(e) => setJobFilters((p) => ({ ...p, page: 1, status: e.target.value }))}>
                      <option value="">All statuses</option>
                      {jobStatuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                    <select className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" value={jobFilters.assigneeId} onChange={(e) => setJobFilters((p) => ({ ...p, page: 1, assigneeId: e.target.value }))}>
                      <option value="">All assignees</option>
                      {assignees.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.id}</option>)}
                    </select>
                    <input type="date" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" value={calendarDate} onChange={(e) => setCalendarDate(e.target.value)} />
                    <div className="flex gap-2">
                      <Button variant={jobView === 'week' ? 'primary' : 'outline'} onClick={() => setJobView('week')}>Week</Button>
                      <Button variant={jobView === 'list' ? 'primary' : 'outline'} onClick={() => setJobView('list')}>List</Button>
                    </div>
                    <Button onClick={loadJobs}>Apply</Button>
                  </div>
                </div>
                {jobView === 'week' ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {weekDays.map((d) => {
                      const key = d.toISOString().slice(0, 10);
                      const items = jobsByDate[key] || [];
                      return (
                        <div key={key} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">{d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                          <div className="mt-2 space-y-2">
                            {items.map((job) => (
                              <button key={job.id} onClick={() => { setSelectedJobId(job.id); loadTimeline(job.id); }} className="w-full rounded-lg border border-neutral-200 bg-neutral-50 p-2 text-left">
                                <p className="text-sm font-semibold text-brand-black">{job.client_name}</p>
                                <p className="text-xs text-gray-600">{job.service_type}</p>
                              </button>
                            ))}
                            {!items.length && <p className="text-xs text-gray-400">No jobs.</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="space-y-2">
                      {jobs.map((job) => (
                        <div key={job.id} className="grid gap-2 rounded-lg border border-neutral-200 p-3 md:grid-cols-[1.2fr_1fr_1fr_auto]">
                          <div>
                            <p className="font-semibold text-brand-black">{job.client_name}</p>
                            <p className="text-xs text-gray-500">{job.service_type} | {fmt(job.scheduled_at)}</p>
                          </div>
                          <select className="rounded border border-neutral-300 px-2 py-1 text-xs" value={job.status} disabled={busyId === job.id} onChange={(e) => updateJob(job.id, { status: e.target.value })}>
                            {[...new Set([...jobStatuses, job.status])].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                          </select>
                          <select className="rounded border border-neutral-300 px-2 py-1 text-xs" value={job.assignee_id || ''} disabled={busyId === job.id} onChange={(e) => updateJob(job.id, { assigneeId: e.target.value || null })}>
                            <option value="">Unassigned</option>
                            {assignees.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.id}</option>)}
                          </select>
                          <Button variant="outline" onClick={() => { setSelectedJobId(job.id); loadTimeline(job.id); }}>Timeline</Button>
                        </div>
                      ))}
                      {!jobs.length && <p className="text-sm text-gray-500">No jobs found.</p>}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-sm text-gray-600">Page {jobsPagination.page} / {jobsPagination.totalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" disabled={jobFilters.page <= 1} onClick={() => setJobFilters((p) => ({ ...p, page: p.page - 1 }))}>Prev</Button>
                    <Button variant="outline" disabled={jobFilters.page >= jobsPagination.totalPages} onClick={() => setJobFilters((p) => ({ ...p, page: p.page + 1 }))}>Next</Button>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <h3 className="font-display text-xl font-semibold uppercase text-brand-black">Timeline</h3>
                {!selectedJobId && <p className="mt-3 text-sm text-gray-500">Select a job to view timeline.</p>}
                {selectedJobId && (
                  <div className="mt-3 space-y-2">
                    <textarea className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" rows={3} placeholder="Add note" value={timelineNote} onChange={(e) => setTimelineNote(e.target.value)} />
                    <Button className="w-full" disabled={!timelineNote.trim() || busyId === selectedJobId} onClick={addTimelineEvent}>Add Event</Button>
                    <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                      {timeline.map((ev) => (
                        <div key={ev.id} className="rounded-lg border border-neutral-200 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-mclaren">{ev.event_type}</p>
                          {ev.note && <p className="mt-1 text-sm text-gray-700">{ev.note}</p>}
                          <p className="text-xs text-gray-500">{fmt(ev.created_at)}</p>
                        </div>
                      ))}
                      {!timeline.length && <p className="text-sm text-gray-500">No events.</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'customers' && (
            <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="grid gap-2">
                  <input className="rounded border border-neutral-300 px-3 py-2 text-sm" placeholder="Search customer" value={clientFilters.search} onChange={(e) => setClientFilters((p) => ({ ...p, page: 1, search: e.target.value }))} />
                  <select className="rounded border border-neutral-300 px-3 py-2 text-sm" value={clientFilters.assigneeId} onChange={(e) => setClientFilters((p) => ({ ...p, page: 1, assigneeId: e.target.value }))}>
                    <option value="">All assignees</option>
                    {assignees.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.id}</option>)}
                  </select>
                  <Button onClick={loadClients}>Apply</Button>
                </div>
                <div className="mt-4 max-h-[640px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                  {clients.map((client) => (
                    <button key={client.id} onClick={() => setSelectedClientId(client.id)} className={`w-full rounded-lg border p-3 text-left ${selectedClientId === client.id ? 'border-brand-mclaren bg-orange-50' : 'border-neutral-200 bg-white'}`}>
                      <p className="font-semibold text-brand-black">{client.name}</p>
                      <p className="text-xs text-gray-600">{client.email || '-'} | {client.phone || '-'}</p>
                    </button>
                  ))}
                  {!clients.length && <p className="text-sm text-gray-500">No customers found.</p>}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span>Page {clientsPagination.page} / {clientsPagination.totalPages}</span>
                  <div className="flex gap-2">
                    <button className="rounded border border-neutral-300 px-2 py-1" disabled={clientFilters.page <= 1} onClick={() => setClientFilters((p) => ({ ...p, page: p.page - 1 }))}>Prev</button>
                    <button className="rounded border border-neutral-300 px-2 py-1" disabled={clientFilters.page >= clientsPagination.totalPages} onClick={() => setClientFilters((p) => ({ ...p, page: p.page + 1 }))}>Next</button>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                {!clientDetails && <p className="text-sm text-gray-500">Select a customer to inspect profile, vehicles, history and linked records.</p>}
                {clientDetails && (
                  <div className="space-y-4">
                    <h3 className="font-display text-2xl font-semibold uppercase text-brand-black">{clientDetails.client.name}</h3>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-neutral-200 p-3"><p className="text-xs uppercase tracking-[0.08em] text-gray-500">Vehicles</p><p className="mt-1 text-2xl font-bold text-brand-black">{clientDetails.vehicles.length}</p></div>
                      <div className="rounded-lg border border-neutral-200 p-3"><p className="text-xs uppercase tracking-[0.08em] text-gray-500">Linked Jobs</p><p className="mt-1 text-2xl font-bold text-brand-black">{clientDetails.serviceJobs.length}</p></div>
                      <div className="rounded-lg border border-neutral-200 p-3"><p className="text-xs uppercase tracking-[0.08em] text-gray-500">Linked Leads</p><p className="mt-1 text-2xl font-bold text-brand-black">{clientDetails.leads.length}</p></div>
                    </div>
                    <div className="rounded-xl border border-neutral-200 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Recent Vehicles</p>
                      <div className="mt-2 space-y-2">
                        {clientDetails.vehicles.slice(0, 8).map((v) => (
                          <div key={v.id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-2 text-sm">
                            {(v.make || '-') + ' ' + (v.model || '-') + ' ' + (v.year || '')} | Plate: {v.plate || '-'}
                          </div>
                        ))}
                        {!clientDetails.vehicles.length && <p className="text-sm text-gray-500">No vehicles.</p>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'billing' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 md:grid-cols-4">
                  <select className="rounded border border-neutral-300 px-3 py-2 text-sm" value={billingFilters.status} onChange={(e) => setBillingFilters((p) => ({ ...p, page: 1, status: e.target.value }))}>
                    <option value="">All statuses</option>
                    {billingStatuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                  <select className="rounded border border-neutral-300 px-3 py-2 text-sm" value={billingFilters.clientId} onChange={(e) => setBillingFilters((p) => ({ ...p, page: 1, clientId: e.target.value }))}>
                    <option value="">All clients</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <Button onClick={loadBilling}>Apply</Button>
                </div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="space-y-2">
                  {billing.map((b) => {
                    const outstanding = Number(b.total_amount || 0) - Number(b.amount_paid || 0);
                    return (
                      <div key={b.id} className="grid gap-2 rounded-lg border border-neutral-200 p-3 md:grid-cols-[1.3fr_1fr_1fr_auto]">
                        <div>
                          <p className="font-semibold text-brand-black">{b.record_number || b.id.slice(0, 8)}</p>
                          <p className="text-xs text-gray-500">{b.record_type} | Due {fmt(b.due_at)}</p>
                        </div>
                        <p className="text-sm text-gray-700">Total ${Number(b.total_amount || 0).toFixed(2)}</p>
                        <p className="text-sm text-gray-700">Outstanding ${outstanding.toFixed(2)}</p>
                        <select className="rounded border border-neutral-300 px-2 py-1 text-xs" value={b.status} disabled={busyId === b.id} onChange={(e) => updateBillingStatus(b.id, e.target.value)}>
                          {billingStatuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                      </div>
                    );
                  })}
                  {!billing.length && <p className="text-sm text-gray-500">No billing records found.</p>}
                </div>
              </div>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-2xl font-semibold uppercase text-brand-black">In-App Notifications</h3>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
                    Unread only
                  </label>
                  <Button onClick={loadNotifications}>Refresh</Button>
                </div>
              </div>
              <div className="space-y-2">
                {notifications.map((n) => (
                  <div key={n.id} className={`rounded-lg border p-3 ${n.read_at ? 'border-neutral-200 bg-white' : 'border-brand-mclaren bg-orange-50'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-brand-black">{n.title}</p>
                        <p className="text-sm text-gray-600">{n.message}</p>
                        <p className="text-xs text-gray-500">{fmt(n.created_at)}</p>
                      </div>
                      {!n.read_at && (
                        <Button variant="outline" disabled={busyId === n.id} onClick={() => markNotificationRead(n.id)}>
                          Mark Read
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {!notifications.length && <p className="text-sm text-gray-500">No notifications.</p>}
              </div>
            </div>
          )}

          {tab === 'reports' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 md:grid-cols-3">
                  <input type="date" className="rounded border border-neutral-300 px-3 py-2 text-sm" value={reportFilters.dateFrom} onChange={(e) => setReportFilters((p) => ({ ...p, dateFrom: e.target.value }))} />
                  <input type="date" className="rounded border border-neutral-300 px-3 py-2 text-sm" value={reportFilters.dateTo} onChange={(e) => setReportFilters((p) => ({ ...p, dateTo: e.target.value }))} />
                  <Button onClick={loadReports}>Run Report</Button>
                </div>
              </div>
              {reports && (
                <>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    {[
                      ['Total Leads', reports.summary.totalLeads || 0],
                      ['Qualified Leads', reports.summary.qualifiedLeads || 0],
                      ['Completed Jobs', reports.summary.completedJobs || 0],
                      ['Overdue', reports.summary.overdueCount || 0],
                      ['Outstanding', `$${Number(reports.summary.outstandingAmount || 0).toFixed(2)}`],
                    ].map(([k, v]) => (
                      <div key={String(k)} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.08em] text-gray-500">{k}</p>
                        <p className="mt-1 text-2xl font-bold text-brand-black">{v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => downloadCsv('leads-report.csv', reports.csvRows.leads)}>Leads CSV</Button>
                      <Button variant="outline" onClick={() => downloadCsv('jobs-report.csv', reports.csvRows.jobs)}>Jobs CSV</Button>
                      <Button variant="outline" onClick={() => downloadCsv('billing-report.csv', reports.csvRows.billing)}>Billing CSV</Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </AuthGate>
    </div>
  );
};

export default Dashboard;

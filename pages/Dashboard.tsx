import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CalendarDays,
  CircleDollarSign,
  LayoutDashboard,
  RefreshCw,
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
  findOfferingByTitle,
  getAddOnOfferings,
  getOfferingById,
  getPrimaryOfferings,
  groupOfferingsByCategory,
  resolveServiceDisplay,
} from '../lib/serviceCatalog';
import type { ServiceOffering } from '../types/cms';
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
  { id: 'reports', label: 'Reports', icon: Wrench },
];

const emptyMetrics: MetricsResponse = {
  newLeadsToday: 0,
  newCustomersToday: 0,
  newCustomersOrLeadsToday: 0,
  jobsScheduledToday: 0,
  activeCustomers: 0,
  expectedRevenueToday: 0,
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
  const [reports, setReports] = useState<ReportsResponse | null>(null);
  const [leadPagination, setLeadPagination] = useState<Pagination | null>(null);
  const [jobPagination, setJobPagination] = useState<Pagination | null>(null);
  const [clientPagination, setClientPagination] = useState<Pagination | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientDetails, setSelectedClientDetails] = useState<ClientDetailsResponse | null>(null);
  const [customerNotes, setCustomerNotes] = useState('');
  const [leadForm, setLeadForm] = useState<LeadFormState>(emptyLeadForm);
  const [jobForm, setJobForm] = useState<JobFormState>(emptyJobForm);
  const [submittingLead, setSubmittingLead] = useState(false);
  const [submittingJob, setSubmittingJob] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [search, setSearch] = useState('');
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

  const loadClientDetails = useCallback(async (clientId: string) => {
    const data = await apiRequest<ClientDetailsResponse>(`/api/clients/${clientId}`);
    setSelectedClientDetails(data);
    setCustomerNotes(data.client.notes || '');
  }, []);

  const loadDashboard = useCallback(async () => {
    setError(null);
    const [authData, metricsData, leadsData, jobsData, clientsData, notificationsData, reportsData] =
      await Promise.all([
        apiRequest<AuthMeResponse>('/api/auth/me'),
        apiRequest<MetricsResponse>('/api/dashboard/metrics'),
        apiRequest<LeadsResponse>(`/api/leads${qs({ page: 1, pageSize: 50 })}`),
        apiRequest<JobsResponse>(`/api/service-jobs${qs({ page: 1, pageSize: 50 })}`),
        apiRequest<ClientsResponse>(`/api/clients${qs({ page: 1, pageSize: 50 })}`),
        apiRequest<NotificationsResponse>('/api/notifications/in-app?limit=25'),
        apiRequest<ReportsResponse>('/api/reports/summary'),
      ]);

    setAuth(authData);
    setMetrics(metricsData);
    setLeads(leadsData.leads);
    setJobs(jobsData.serviceJobs);
    setClients(clientsData.clients);
    setNotifications(notificationsData.notifications);
    setReports(reportsData);
    setLeadPagination(leadsData.pagination);
    setJobPagination(jobsData.pagination);
    setClientPagination(clientsData.pagination);

    if (!selectedClientId && clientsData.clients.length) {
      setSelectedClientId(clientsData.clients[0].id);
    }
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

  const refreshAll = async () => {
    try {
      setRefreshing(true);
      await loadDashboard();
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
      notes: '',
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
        await apiRequest(`/api/leads/${selectedLead.id}/convert`, {
          method: 'POST',
          body: JSON.stringify({
            client: {
              name: selectedLead.name,
              email: selectedLead.email || undefined,
              phone: selectedLead.phone || undefined,
              notes: getLeadServiceDisplay(selectedLead) !== '-' ? `Requested: ${getLeadServiceDisplay(selectedLead)}` : undefined,
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

  const sortedJobs = useMemo(
    () =>
      [...jobs]
        .filter((job) => job.ui_status !== 'cancelled')
        .sort((a, b) => (a.scheduled_at || '').localeCompare(b.scheduled_at || '')),
    [jobs]
  );

  return (
    <AuthGate title="Operations Dashboard">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-[28px] border border-neutral-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-mclaren">Internal Operations</p>
            <h1 className="mt-2 font-display text-4xl font-semibold uppercase text-brand-black">Service Dashboard</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
              Intake, appointments, customer history, payment follow-up, notifications, and simple revenue tracking in one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
              <div className="font-semibold text-brand-black">{auth?.email || 'Signed in'}</div>
              <div className="text-gray-500">Role: {auth?.role || '-'}</div>
            </div>
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

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-sm text-gray-600">Loading dashboard...</div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="New Leads / Customers Today" value={metrics.newCustomersOrLeadsToday} helper={`${metrics.newLeadsToday} leads, ${metrics.newCustomersToday} customers`} />
              <MetricCard label="Jobs Scheduled Today" value={metrics.jobsScheduledToday} helper="Booked appointments on today’s calendar" />
              <MetricCard label="Active Customers" value={metrics.activeCustomers} helper="Clients with scheduled or in-service work" />
              <MetricCard label="Expected Revenue Today" value={currency(metrics.expectedRevenueToday)} helper={`${metrics.unreadNotifications} unread notifications`} accent />
            </div>

            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? 'border-brand-mclaren bg-brand-mclaren text-white'
                        : 'border-neutral-200 bg-white text-gray-700 hover:border-brand-mclaren hover:text-brand-mclaren'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {activeTab === 'overview' && (
              <div className="grid gap-6 lg:grid-cols-[1.25fr_0.95fr]">
                <Panel title="Today’s Job List" subtitle="Quick view of the appointment queue">
                  <div className="space-y-3">
                    {sortedJobs.length ? (
                      sortedJobs.slice(0, 8).map((job) => (
                        <div key={job.id} className="rounded-2xl border border-neutral-200 px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-brand-black">{job.client_name}</div>
                              <div className="mt-1 text-sm text-gray-600">{getJobServiceDisplay(job)}</div>
                              <div className="mt-1 text-xs text-gray-500">
                                {vehicleLabel(job)} | {fmtDateTime(job.scheduled_at)}
                              </div>
                            </div>
                            <StatusBadge status={job.ui_status || 'scheduled'} label={jobStatusLabel[job.ui_status || 'scheduled']} />
                          </div>
                        </div>
                      ))
                    ) : (
                      <EmptyState message="No appointments scheduled yet." />
                    )}
                  </div>
                </Panel>

                <Panel title="Unread Notifications" subtitle="Bookings and appointment reminders">
                  <div className="space-y-3">
                    {upcomingNotifications.length ? (
                      upcomingNotifications.slice(0, 8).map((notification) => (
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
                              className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:border-brand-mclaren hover:text-brand-mclaren"
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
                </Panel>
              </div>
            )}

            {activeTab === 'leads' && (
              <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
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

                <Panel title="Lead Queue" subtitle={`Showing ${leadPagination?.total || leads.length} recent leads`}>
                  <DataTable
                    columns={['Customer', 'Phone', 'Vehicle', 'Service', 'Status', 'Actions']}
                    rows={leads.map((lead) => (
                      <tr key={lead.id} className="border-t border-neutral-100">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-brand-black">{lead.name}</div>
                          <div className="text-xs text-gray-500">{fmtDateTime(lead.created_at)}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{lead.phone || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{vehicleLabel(lead)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{getLeadServiceDisplay(lead)}</td>
                        <td className="px-4 py-3">
                          <select
                            value={lead.ui_status || 'new_lead'}
                            onChange={(event) => updateLeadStatus(lead.id, event.target.value as LeadUiStatus)}
                            className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                          >
                            <option value="new_lead">New Lead</option>
                            <option value="booked">Booked</option>
                            <option value="service_completed">Service Completed</option>
                            <option value="closed_lost">Closed Lost</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => prepareJobFromLead(lead)}
                            className="rounded-xl border border-brand-mclaren px-3 py-2 text-sm font-semibold text-brand-mclaren hover:bg-brand-mclaren hover:text-white"
                          >
                            Book Appointment
                          </button>
                        </td>
                      </tr>
                    ))}
                  />
                </Panel>
              </div>
            )}

            {activeTab === 'jobs' && (
              <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
                <Panel
                  title={selectedLead ? 'Convert Lead to Appointment' : 'Create Appointment'}
                  subtitle={selectedLead ? `Booking ${selectedLead.name}` : 'Add a scheduled job directly'}
                >
                  {selectedLead && (
                    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
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
                      onServiceAddonIdsChange={(value) =>
                        syncJobServiceSelection({
                          serviceAddonIds: value,
                        })
                      }
                      onCustomServiceTypeChange={(value) =>
                        syncJobServiceSelection({
                          customServiceType: value,
                        })
                      }
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
                </Panel>

                <Panel title="Appointment Queue" subtitle={`Showing ${jobPagination?.total || jobs.length} recent jobs`}>
                  <DataTable
                    columns={['Customer', 'Vehicle', 'Service', 'Appointment', 'Status', 'Payment', 'Amount']}
                    rows={jobs.map((job) => (
                      <tr key={job.id} className="border-t border-neutral-100">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-brand-black">{job.client_name}</div>
                          <div className="text-xs text-gray-500">{job.notes || 'No notes'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{vehicleLabel(job)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{getJobServiceDisplay(job)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{fmtDateTime(job.scheduled_at)}</td>
                        <td className="px-4 py-3">
                          <select
                            value={job.ui_status || 'scheduled'}
                            onChange={(event) => updateJob(job.id, { status: event.target.value as JobUiStatus })}
                            className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                          >
                            <option value="scheduled">Scheduled</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={job.payment_status || 'unpaid'}
                            onChange={(event) => updateJob(job.id, { paymentStatus: event.target.value as JobPaymentStatus })}
                            className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                          >
                            <option value="unpaid">Unpaid</option>
                            <option value="paid">Paid</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-brand-black">{currency(job.estimated_amount)}</td>
                      </tr>
                    ))}
                  />
                </Panel>
              </div>
            )}

            {activeTab === 'customers' && (
              <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
                <Panel title="Customer List" subtitle={`Showing ${clientPagination?.total || clients.length} active customers`}>
                  <div className="mb-4">
                    <Input label="Search Customers" value={search} onChange={setSearch} placeholder="Search by name, phone, or email" />
                  </div>
                  <div className="space-y-2">
                    {filteredClients.length ? (
                      filteredClients.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => setSelectedClientId(client.id)}
                          className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                            selectedClientId === client.id
                              ? 'border-brand-mclaren bg-brand-mclaren/5'
                              : 'border-neutral-200 hover:border-brand-mclaren/40'
                          }`}
                        >
                          <div className="font-semibold text-brand-black">{client.name}</div>
                          <div className="mt-1 text-sm text-gray-600">{client.phone || client.email || '-'}</div>
                        </button>
                      ))
                    ) : (
                      <EmptyState message="No customers found." />
                    )}
                  </div>
                </Panel>

                <Panel title="Customer Profile" subtitle="History, vehicles, and service notes">
                  {selectedClientDetails ? (
                    <div className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <DetailCard label="Customer" value={selectedClientDetails.client.name} />
                        <DetailCard label="Phone" value={selectedClientDetails.client.phone || '-'} />
                        <DetailCard label="Email" value={selectedClientDetails.client.email || '-'} />
                        <DetailCard label="Vehicles" value={selectedClientDetails.vehicles.length} />
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">Vehicles</h3>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedClientDetails.vehicles.length ? (
                            selectedClientDetails.vehicles.map((vehicle) => (
                              <span key={vehicle.id} className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-sm text-gray-700">
                                {vehicleLabel(vehicle)}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-gray-500">No saved vehicles.</span>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-6 xl:grid-cols-2">
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">Service History</h3>
                          <div className="mt-3 space-y-3">
                            {selectedClientDetails.serviceJobs.length ? (
                              selectedClientDetails.serviceJobs.map((job) => (
                                <div key={job.id} className="rounded-2xl border border-neutral-200 px-4 py-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <div className="font-semibold text-brand-black">{getJobServiceDisplay(job)}</div>
                                      <div className="text-sm text-gray-600">{fmtDateTime(job.scheduled_at)}</div>
                                    </div>
                                    <StatusBadge status={job.ui_status || 'scheduled'} label={jobStatusLabel[job.ui_status || 'scheduled']} />
                                  </div>
                                </div>
                              ))
                            ) : (
                              <EmptyState message="No service history yet." />
                            )}
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">Customer Notes</h3>
                          <div className="mt-3 space-y-3">
                            <TextArea value={customerNotes} onChange={setCustomerNotes} rows={8} placeholder="Regular customer, prefers interior detail, requested morning drop-off..." />
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
                  ) : (
                    <EmptyState message="Select a customer to view details." />
                  )}
                </Panel>
              </div>
            )}

            {activeTab === 'payments' && (
              <Panel title="Payment Tracker" subtitle="Simple paid and unpaid follow-up from scheduled jobs">
                <DataTable
                  columns={['Customer', 'Service', 'Appointment', 'Amount', 'Payment Status']}
                  rows={jobs.map((job) => (
                    <tr key={job.id} className="border-t border-neutral-100">
                      <td className="px-4 py-3 font-semibold text-brand-black">{job.client_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{getJobServiceDisplay(job)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{fmtDateTime(job.scheduled_at)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-brand-black">{currency(job.estimated_amount)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <StatusBadge status={job.payment_status || 'unpaid'} label={(job.payment_status || 'unpaid').toUpperCase()} />
                          <button
                            type="button"
                            onClick={() =>
                              updateJob(job.id, {
                                paymentStatus: job.payment_status === 'paid' ? 'unpaid' : 'paid',
                              })
                            }
                            className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-brand-mclaren hover:text-brand-mclaren"
                          >
                            Mark as {job.payment_status === 'paid' ? 'Unpaid' : 'Paid'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                />
              </Panel>
            )}

            {activeTab === 'notifications' && (
              <Panel title="Notifications" subtitle="New booking alerts and upcoming appointment reminders">
                <div className="space-y-3">
                  {notifications.length ? (
                    notifications.map((notification) => (
                      <div key={notification.id} className="flex flex-col gap-3 rounded-2xl border border-neutral-200 px-4 py-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-brand-black">{notification.title}</div>
                            {!notification.read_at && <StatusBadge status="new_lead" label="Unread" />}
                          </div>
                          <div className="mt-1 text-sm text-gray-600">{notification.message}</div>
                          <div className="mt-2 text-xs text-gray-500">
                            {notification.category} | {fmtDateTime(notification.created_at)}
                          </div>
                        </div>
                        {!notification.read_at && (
                          <button
                            type="button"
                            onClick={() => markNotificationRead(notification.id)}
                            className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-brand-mclaren hover:text-brand-mclaren"
                          >
                            Mark Read
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <EmptyState message="No notifications yet." />
                  )}
                </div>
              </Panel>
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
              </div>
            )}
          </>
        )}
      </div>
    </AuthGate>
  );
};

const Panel: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-6">
    <div className="mb-5">
      <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">{title}</h2>
      {subtitle && <p className="mt-2 text-sm text-gray-600">{subtitle}</p>}
    </div>
    {children}
  </section>
);

const MetricCard: React.FC<{ label: string; value: React.ReactNode; helper?: string; accent?: boolean }> = ({ label, value, helper, accent }) => (
  <div className={`rounded-[24px] border p-5 ${accent ? 'border-brand-mclaren/20 bg-[#fff4eb]' : 'border-neutral-200 bg-white'}`}>
    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{label}</div>
    <div className="mt-3 text-3xl font-semibold text-brand-black">{value}</div>
    {helper && <div className="mt-2 text-sm text-gray-600">{helper}</div>}
  </div>
);

const DataTable: React.FC<{ columns: string[]; rows: React.ReactNode[] }> = ({ columns, rows }) => (
  <div className="overflow-hidden rounded-2xl border border-neutral-200">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-neutral-200">
        <thead className="bg-neutral-50">
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
      className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm text-brand-black outline-none transition focus:border-brand-mclaren"
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
      className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm text-brand-black outline-none transition focus:border-brand-mclaren"
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
      className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm text-brand-black outline-none transition focus:border-brand-mclaren"
    />
  </label>
);

const DetailCard: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4">
    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{label}</div>
    <div className="mt-2 text-sm font-semibold text-brand-black">{value}</div>
  </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center text-sm text-gray-500">
    {message}
  </div>
);

export default Dashboard;


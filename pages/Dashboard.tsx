import React, { useEffect, useMemo, useState } from 'react';
import AuthGate from '../components/AuthGate';
import Button from '../components/Button';
import { apiRequest, ApiError } from '../lib/apiClient';
import type { Lead, ServiceJob } from '../types/platform';

const leadStatuses = ['lead', 'contacted', 'quoted', 'booked', 'in_service', 'completed', 'closed_lost'];

interface LeadFilters {
  status: string;
  sourcePage: string;
  serviceType: string;
  dateFrom: string;
  dateTo: string;
}

const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [leads, setLeads] = useState<Lead[]>([]);
  const [serviceJobs, setServiceJobs] = useState<ServiceJob[]>([]);
  const [filters, setFilters] = useState<LeadFilters>({
    status: '',
    sourcePage: '',
    serviceType: '',
    dateFrom: '',
    dateTo: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);

  const loadData = async (activeFilters: LeadFilters = filters) => {
    try {
      setLoading(true);
      setError(null);
      const leadQuery = new URLSearchParams();
      if (activeFilters.status) leadQuery.set('status', activeFilters.status);
      if (activeFilters.sourcePage) leadQuery.set('sourcePage', activeFilters.sourcePage);
      if (activeFilters.serviceType) leadQuery.set('serviceType', activeFilters.serviceType);
      if (activeFilters.dateFrom) leadQuery.set('dateFrom', activeFilters.dateFrom);
      if (activeFilters.dateTo) leadQuery.set('dateTo', activeFilters.dateTo);
      leadQuery.set('limit', '300');
      const leadsUrl = `/api/leads${leadQuery.toString() ? `?${leadQuery.toString()}` : ''}`;

      const [metricsResponse, leadsResponse, jobsResponse] = await Promise.all([
        apiRequest<Record<string, number>>('/api/dashboard/metrics'),
        apiRequest<{ leads: Lead[] }>(leadsUrl),
        apiRequest<{ serviceJobs: ServiceJob[] }>('/api/service-jobs'),
      ]);

      setMetrics(metricsResponse);
      setLeads(leadsResponse.leads || []);
      setServiceJobs(jobsResponse.serviceJobs || []);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load dashboard';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const groupedLeads = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const status of leadStatuses) {
      map[status] = [];
    }
    for (const lead of leads) {
      if (!map[lead.status]) map[lead.status] = [];
      map[lead.status].push(lead);
    }
    return map;
  }, [leads]);

  const updateLeadStatus = async (leadId: string, status: string) => {
    try {
      setUpdatingLeadId(leadId);
      await apiRequest(`/api/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadData(filters);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update lead status');
    } finally {
      setUpdatingLeadId(null);
    }
  };

  const applyFilters = async () => {
    await loadData(filters);
  };

  const clearFilters = async () => {
    const resetFilters: LeadFilters = {
      status: '',
      sourcePage: '',
      serviceType: '',
      dateFrom: '',
      dateTo: '',
    };
    setFilters(resetFilters);
    await loadData(resetFilters);
  };

  return (
    <div className="min-h-screen bg-brand-gray px-4 py-12">
      <AuthGate title="Operations Dashboard">
        <div className="mx-auto max-w-7xl space-y-6">
          <div>
            <h1 className="font-display text-4xl font-bold uppercase text-brand-black">Operations Dashboard</h1>
            <p className="mt-2 text-sm text-gray-600">Track enquiries, active service work, and conversion progress.</p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">Lead Filters</h2>
              <div className="flex gap-2">
                <Button variant="outline" onClick={clearFilters}>
                  Clear
                </Button>
                <Button onClick={applyFilters}>Apply</Button>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-5">
              <select
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">All statuses</option>
                {leadStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status.replace('_', ' ')}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={filters.sourcePage}
                onChange={(e) => setFilters((prev) => ({ ...prev, sourcePage: e.target.value }))}
                placeholder="Source page (booking)"
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={filters.serviceType}
                onChange={(e) => setFilters((prev) => ({ ...prev, serviceType: e.target.value }))}
                placeholder="Service type"
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: 'Total Leads', value: metrics.totalLeads || 0 },
              { label: 'New Leads', value: metrics.newLeads || 0 },
              { label: 'In Service', value: metrics.inService || 0 },
              { label: 'Completed', value: metrics.completed || 0 },
              { label: 'Today Enquiries', value: metrics.enquiriesToday || 0 },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">{card.label}</p>
                <p className="mt-2 text-3xl font-bold text-brand-black">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">Lead Pipeline</h2>
                <Button variant="outline" onClick={() => loadData(filters)}>
                  Refresh
                </Button>
              </div>
              {loading ? (
                <p className="text-sm text-gray-500">Loading leads...</p>
              ) : (
                <div className="space-y-4">
                  {leadStatuses.map((status) => (
                    <div key={status} className="rounded-xl border border-neutral-200 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
                        {status.replace('_', ' ')} ({groupedLeads[status]?.length || 0})
                      </p>
                      <div className="space-y-2">
                        {(groupedLeads[status] || []).slice(0, 6).map((lead) => (
                          <div key={lead.id} className="rounded-lg bg-neutral-50 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="font-semibold text-brand-black">{lead.name}</p>
                                <p className="text-xs text-gray-500">
                                  {lead.email} {lead.phone ? `| ${lead.phone}` : ''}
                                </p>
                              </div>
                              <select
                                value={lead.status}
                                disabled={updatingLeadId === lead.id}
                                onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
                              >
                                {leadStatuses.map((option) => (
                                  <option key={option} value={option}>
                                    {option.replace('_', ' ')}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                        {!groupedLeads[status]?.length && (
                          <p className="text-xs text-gray-400">No leads in this stage.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">Enquiry Queue</h2>
                <div className="mt-4 space-y-3">
                  {leads.slice(0, 10).map((lead) => (
                    <div key={lead.id} className="rounded-lg border border-neutral-200 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-brand-black">{lead.name}</p>
                        <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs uppercase tracking-[0.08em] text-gray-600">
                          {lead.source_page}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{lead.service_type || 'General enquiry'}</p>
                      <p className="mt-1 text-xs text-gray-500">{new Date(lead.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                  {!leads.length && !loading && (
                    <p className="text-sm text-gray-500">No enquiries found for current filters.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">Service Queue</h2>
                <div className="mt-4 space-y-3">
                  {serviceJobs.slice(0, 12).map((job) => (
                    <div key={job.id} className="rounded-lg border border-neutral-200 p-3">
                      <p className="font-semibold text-brand-black">{job.client_name}</p>
                      <p className="text-sm text-gray-600">{job.service_type}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.08em] text-brand-mclaren">
                        {job.status.replace('_', ' ')}
                      </p>
                    </div>
                  ))}
                  {!serviceJobs.length && !loading && (
                    <p className="text-sm text-gray-500">No service jobs available.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </AuthGate>
    </div>
  );
};

export default Dashboard;

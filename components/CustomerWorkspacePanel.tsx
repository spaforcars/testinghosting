import React, { useMemo } from 'react';
import { CalendarClock, CarFront, Clipboard, Mail, Phone, UserRound } from 'lucide-react';
import { DEFAULT_APP_TIME_ZONE, formatDateTimeInTimeZone } from '../lib/timeZone';
import type { CustomerVehicle, CustomerWorkspaceResponse, ServiceJob } from '../types/platform';

export type CustomerWorkspaceSection = 'overview' | 'history' | 'notes';

export interface CustomerWorkspacePanelProps {
  workspace: CustomerWorkspaceResponse | null;
  customerNotes: string;
  onCustomerNotesChange: (value: string) => void;
  onSaveCustomerNotes: () => void;
  savingCustomer: boolean;
  activeSection: CustomerWorkspaceSection;
  onSectionChange: (value: CustomerWorkspaceSection) => void;
  customerPrimaryVehicle: CustomerVehicle | null;
  emptyTitle?: string;
  emptyMessage?: string;
}

const sectionOptions: Array<{ id: CustomerWorkspaceSection; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'history', label: 'History' },
  { id: 'notes', label: 'Notes' },
];

const fmtDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return formatDateTimeInTimeZone(date, { month: 'short', day: 'numeric', weekday: 'short' }, DEFAULT_APP_TIME_ZONE);
};

const fmtDateTime = (value?: string | null) => {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';
  return formatDateTimeInTimeZone(date, {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }, DEFAULT_APP_TIME_ZONE);
};

const fmtRelative = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.round(diffMs / 3_600_000);
  if (Math.abs(diffHours) < 24) {
    if (diffHours === 0) return 'just now';
    return diffHours > 0 ? `${diffHours}h ago` : `in ${Math.abs(diffHours)}h`;
  }
  const diffDays = Math.round(diffHours / 24);
  return diffDays > 0 ? `${diffDays}d ago` : `in ${Math.abs(diffDays)}d`;
};

const vehicleLabel = (
  vehicle?: {
    vehicle_year?: number | null;
    vehicle_make?: string | null;
    vehicle_model?: string | null;
    year?: number | null;
    make?: string | null;
    model?: string | null;
  } | null
) => {
  if (!vehicle) return 'Vehicle not captured';
  const year = vehicle.vehicle_year ?? vehicle.year;
  const make = vehicle.vehicle_make ?? vehicle.make;
  const model = vehicle.vehicle_model ?? vehicle.model;
  return [year, make, model].filter(Boolean).join(' ') || 'Vehicle not captured';
};

const cardClass = 'rounded-[30px] border border-neutral-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]';

const EmptyPanel: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <div className={`${cardClass} flex h-full min-h-[360px] items-center justify-center p-8`}>
    <div className="max-w-sm text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Customer Details</div>
      <h3 className="mt-3 text-2xl font-semibold tracking-tight text-brand-black">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-gray-600">{message}</p>
    </div>
  </div>
);

const DetailTile: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-[22px] border border-neutral-200 bg-neutral-50 px-4 py-4">
    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">{label}</div>
    <div className="mt-2 text-sm font-medium text-brand-black">{value}</div>
  </div>
);

const statusTone = (status?: string | null) => {
  if (status === 'completed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'cancelled') return 'border-neutral-200 bg-neutral-100 text-neutral-600';
  return 'border-neutral-200 bg-white text-gray-600';
};

const ServiceJobRow: React.FC<{ job: ServiceJob }> = ({ job }) => (
  <div className="rounded-[24px] border border-neutral-200 bg-white px-4 py-4">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="font-semibold text-brand-black">{job.service_type}</div>
          {job.ui_status && job.ui_status !== 'scheduled' && (
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusTone(job.ui_status)}`}>
              {job.ui_status}
            </span>
          )}
        </div>
        <div className="mt-2 text-sm text-gray-600">{fmtDateTime(job.scheduled_at)}</div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
          <span className="rounded-full bg-neutral-100 px-2.5 py-1">{vehicleLabel(job)}</span>
          {job.booking_reference ? <span className="rounded-full bg-neutral-100 px-2.5 py-1">Ref {job.booking_reference}</span> : null}
        </div>
        {job.notes ? <div className="mt-3 text-sm leading-6 text-gray-600">{job.notes}</div> : null}
      </div>
    </div>
  </div>
);

const SectionCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="rounded-[26px] border border-neutral-200 bg-neutral-50/70 p-5">
    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
      {icon}
      {title}
    </div>
    <div className="mt-4 space-y-3">{children}</div>
  </div>
);

const CustomerWorkspacePanel: React.FC<CustomerWorkspacePanelProps> = ({
  workspace,
  customerNotes,
  onCustomerNotesChange,
  onSaveCustomerNotes,
  savingCustomer,
  activeSection,
  onSectionChange,
  customerPrimaryVehicle,
  emptyTitle = 'Select a booking',
  emptyMessage = 'Choose a scheduled client to load customer details and service history.',
}) => {
  const upcomingJobs = useMemo(() => {
    if (!workspace) return [];
    return [...workspace.serviceJobs]
      .filter((job) => job.ui_status !== 'cancelled' && job.scheduled_at)
      .sort((left, right) => (left.scheduled_at || '').localeCompare(right.scheduled_at || ''))
      .slice(0, 4);
  }, [workspace]);

  const historyJobs = useMemo(() => {
    if (!workspace) return [];
    return [...workspace.serviceJobs].sort((left, right) => (right.scheduled_at || '').localeCompare(left.scheduled_at || ''));
  }, [workspace]);

  if (!workspace) {
    return <EmptyPanel title={emptyTitle} message={emptyMessage} />;
  }

  const { client, summary, serviceJobs } = workspace;

  return (
    <div className={`${cardClass} flex h-full min-h-[360px] flex-col overflow-hidden`}>
      <div className="border-b border-neutral-200 px-6 py-6">
        <div className="flex flex-col gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Customer Record</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-brand-black">{client.name}</h2>
            {client.company_name ? <div className="mt-2 text-sm text-gray-500">{client.company_name}</div> : null}
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-gray-600">
            {client.phone ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-neutral-50 px-3 py-2">
                <Phone className="h-4 w-4" />
                {client.phone}
              </span>
            ) : null}
            {client.email ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-neutral-50 px-3 py-2">
                <Mail className="h-4 w-4" />
                {client.email}
              </span>
            ) : null}
            {[client.city, client.province].filter(Boolean).length ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-neutral-50 px-3 py-2">
                <UserRound className="h-4 w-4" />
                {[client.city, client.province].filter(Boolean).join(', ')}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-b border-neutral-200 px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {sectionOptions.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => onSectionChange(section.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeSection === section.id
                  ? 'bg-brand-black text-white'
                  : 'border border-neutral-200 bg-white text-gray-600 hover:border-brand-black hover:text-brand-black'
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {activeSection === 'overview' && (
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <DetailTile label="Primary Vehicle" value={vehicleLabel(customerPrimaryVehicle)} />
              <DetailTile
                label="Next Appointment"
                value={summary.nextAppointment ? fmtDateTime(summary.nextAppointment.scheduled_at) : 'No future booking'}
              />
              <DetailTile
                label="Last Completed"
                value={summary.lastCompletedService ? fmtDate(summary.lastCompletedService.completed_at || summary.lastCompletedService.scheduled_at) : 'Not available'}
              />
              <DetailTile label="Recent Contact" value={summary.recentContactAt ? fmtRelative(summary.recentContactAt) : 'No recent contact'} />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard title="Upcoming Services" icon={<CalendarClock className="h-4 w-4" />}>
                {upcomingJobs.length ? (
                  upcomingJobs.map((job) => <ServiceJobRow key={job.id} job={job} />)
                ) : (
                  <div className="rounded-[22px] border border-dashed border-neutral-200 bg-white px-4 py-6 text-sm text-gray-500">
                    No scheduled services are linked to this customer yet.
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Customer Snapshot" icon={<CarFront className="h-4 w-4" />}>
                <div className="rounded-[24px] border border-neutral-200 bg-white px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Service Count</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-brand-black">{serviceJobs.length}</div>
                  <div className="mt-2 text-sm leading-6 text-gray-600">
                    Keep this view focused on the client identity, upcoming work, and the notes needed before the booking begins.
                  </div>
                </div>
                <div className="rounded-[24px] border border-neutral-200 bg-white px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Customer Notes</div>
                  <div className="mt-2 text-sm leading-6 text-gray-600">
                    {client.notes?.trim() ? client.notes : 'No saved notes on this customer record yet.'}
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {activeSection === 'history' && (
          <div className="space-y-4">
            {historyJobs.length ? (
              historyJobs.map((job) => <ServiceJobRow key={job.id} job={job} />)
            ) : (
              <div className="rounded-[22px] border border-dashed border-neutral-200 bg-neutral-50 px-4 py-10 text-center text-sm text-gray-500">
                No service history has been recorded for this customer yet.
              </div>
            )}
          </div>
        )}

        {activeSection === 'notes' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
              <Clipboard className="h-4 w-4" />
              Internal Notes
            </div>
            <textarea
              value={customerNotes}
              onChange={(event) => onCustomerNotesChange(event.target.value)}
              rows={12}
              className="w-full rounded-[28px] border border-neutral-200 px-5 py-4 text-sm leading-6 text-brand-black outline-none transition focus:border-brand-black"
              placeholder="Capture context, preferences, access notes, and prep reminders for future services."
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onSaveCustomerNotes}
                disabled={savingCustomer}
                className="rounded-full bg-brand-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingCustomer ? 'Saving...' : 'Save notes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerWorkspacePanel;

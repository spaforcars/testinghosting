import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchDashboardJobs, isMissingTableError, loadAssigneeNameLookup } from './dashboardData';
import { mapLeadToUiStatus } from './dashboardStatus';

const readString = (value: unknown) => (typeof value === 'string' ? value : '');
const readNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const readRecord = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const toDate = (value: unknown) => {
  if (typeof value !== 'string' || !value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const computeRecentContactAt = (
  enquiries: Array<Record<string, unknown>>,
  messageLogs: Array<Record<string, unknown>>
) => {
  const timestamps = [
    ...enquiries.map((enquiry) => readString(enquiry.created_at)).filter(Boolean),
    ...messageLogs.map((entry) => readString(entry.created_at)).filter(Boolean),
  ]
    .map((value) => toDate(value))
    .filter((value): value is Date => Boolean(value))
    .sort((left, right) => right.getTime() - left.getTime());

  return timestamps[0]?.toISOString() || null;
};

const buildRecommendedNextAction = (input: {
  unpaidBalance: number;
  nextAppointment: Record<string, unknown> | null;
  unassignedUpcomingCount: number;
  openMessageCount: number;
  fleetCount: number;
}) => {
  if (input.unpaidBalance > 0) return 'Send a payment reminder and confirm collection status.';
  if (input.unassignedUpcomingCount > 0) return 'Assign an owner to the upcoming appointment and confirm prep.';
  if (input.openMessageCount > 0) return 'Reply to the latest customer message and log the response.';
  if (input.fleetCount > 0) return 'Review the fleet enquiry and send a proposal follow-up.';
  if (input.nextAppointment) return 'Prepare the upcoming appointment and confirm logistics.';
  return 'Review the customer history and schedule the next follow-up touchpoint.';
};

const buildRiskFlags = (input: {
  unpaidBalance: number;
  unpaidCount: number;
  nextAppointment: Record<string, unknown> | null;
  unassignedUpcomingCount: number;
  openMessageCount: number;
  lastCompletedServiceAt: string | null;
}) => {
  const flags: string[] = [];
  if (input.unpaidBalance > 0) flags.push('Unpaid balance outstanding');
  if (input.unpaidCount > 1) flags.push('Multiple jobs still unpaid');
  if (input.unassignedUpcomingCount > 0) flags.push('Upcoming work is still unassigned');
  if (input.openMessageCount > 0) flags.push('Customer messages need a reply');
  if (!input.lastCompletedServiceAt && !input.nextAppointment) flags.push('No completed service history yet');
  return flags;
};

export const getCustomerWorkspaceContext = async (supabase: SupabaseClient, clientId: string) => {
  const [clientResult, vehiclesResult, timelineResult, billingResult, allLeadsResult] =
    await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).maybeSingle(),
      supabase
        .from('customer_vehicles')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
      supabase
        .from('job_timeline_events')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(250),
      supabase
        .from('billing_records')
        .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(150),
      supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(250),
    ]);

  if (clientResult.error) throw new Error(clientResult.error.message);
  if (!clientResult.data) throw new Error('Client not found');
  if (vehiclesResult.error && !isMissingTableError(vehiclesResult.error.message, 'customer_vehicles')) {
    throw new Error(vehiclesResult.error.message);
  }
  if (timelineResult.error && !isMissingTableError(timelineResult.error.message, 'job_timeline_events')) {
    throw new Error(timelineResult.error.message);
  }
  if (billingResult.error && !isMissingTableError(billingResult.error.message, 'billing_records')) {
    throw new Error(billingResult.error.message);
  }
  if (allLeadsResult.error) throw new Error(allLeadsResult.error.message);

  const jobs = await fetchDashboardJobs(supabase, {
    clientId,
    limit: 250,
    sortMode: 'operator',
  });
  const jobIds = jobs.map((job) => readString(job.id)).filter(Boolean);
  const assigneeLookup = await loadAssigneeNameLookup(
    supabase,
    [
      readString(clientResult.data.assignee_id),
      ...jobs.map((job) => readString(job.assignee_id)),
      ...((allLeadsResult.data || []) as Array<Record<string, unknown>>).map((lead) => readString(lead.assignee_id)),
    ].filter(Boolean)
  );

  const [clientAuditLogsResult, jobAuditLogsResult] = await Promise.all([
    supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_id', clientId)
      .order('created_at', { ascending: false })
      .limit(300),
    jobIds.length
      ? supabase
          .from('audit_logs')
          .select('*')
          .eq('module', 'services')
          .eq('entity_type', 'service_job')
          .in('entity_id', jobIds)
          .order('created_at', { ascending: false })
          .limit(300)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (clientAuditLogsResult.error) throw new Error(clientAuditLogsResult.error.message);
  if (jobAuditLogsResult.error) throw new Error(jobAuditLogsResult.error.message);

  const clientAuditLogs = (clientAuditLogsResult.data || []) as Array<Record<string, unknown>>;
  const jobAuditLogs = (jobAuditLogsResult.data || []) as Array<Record<string, unknown>>;

  const linkedLeadIds = new Set(jobs.map((job) => readString(job.lead_id)).filter(Boolean));
  const leads: Array<Record<string, unknown> & { ui_status: ReturnType<typeof mapLeadToUiStatus>; assignee_label: string }> = ((allLeadsResult.data || []) as Array<Record<string, unknown>>)
    .filter((lead) => {
      if (linkedLeadIds.has(readString(lead.id))) return true;
      if (readString(clientResult.data.email) && readString(lead.email) === readString(clientResult.data.email)) return true;
      if (readString(clientResult.data.phone) && readString(lead.phone) === readString(clientResult.data.phone)) return true;
      return false;
    })
    .map((lead) => ({
      ...lead,
      ui_status: mapLeadToUiStatus(readString(lead.status)),
      assignee_label:
        assigneeLookup.get(readString(lead.assignee_id)) || readString(lead.assignee_id) || 'Unassigned',
    }));

  const enquiryIds = Array.from(
    new Set(
      leads.map((lead) => readString(lead.enquiry_id)).filter(Boolean)
    )
  );
  const enquiryResult = enquiryIds.length
    ? await supabase.from('enquiries').select('*').in('id', enquiryIds)
    : { data: [], error: null as { message: string } | null };
  if (enquiryResult.error && !isMissingTableError(enquiryResult.error.message, 'enquiries')) {
    throw new Error(enquiryResult.error.message);
  }
  const enquiries = (enquiryResult.data || []) as Array<Record<string, unknown>>;

  let aiRuns: Array<Record<string, unknown>> = [];
  try {
    const relatedJobIds = jobs.map((job) => readString(job.id)).filter(Boolean);
    const relatedLeadIds = leads.map((lead) => readString(lead.id)).filter(Boolean);

    const [customerRunsResult, jobRunsResult, leadRunsResult] = await Promise.all([
      supabase
        .from('ai_runs')
        .select('*')
        .eq('entity_type', 'customer')
        .eq('entity_id', clientId)
        .order('created_at', { ascending: false })
        .limit(20),
      relatedJobIds.length
        ? supabase
            .from('ai_runs')
            .select('*')
            .eq('entity_type', 'service_job')
            .in('entity_id', relatedJobIds)
            .order('created_at', { ascending: false })
            .limit(40)
        : Promise.resolve({ data: [], error: null }),
      relatedLeadIds.length
        ? supabase
            .from('ai_runs')
            .select('*')
            .eq('entity_type', 'lead')
            .in('entity_id', relatedLeadIds)
            .order('created_at', { ascending: false })
            .limit(40)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (customerRunsResult.error && !isMissingTableError(customerRunsResult.error.message, 'ai_runs')) {
      throw new Error(customerRunsResult.error.message);
    }
    if (jobRunsResult.error && !isMissingTableError(jobRunsResult.error.message, 'ai_runs')) {
      throw new Error(jobRunsResult.error.message);
    }
    if (leadRunsResult.error && !isMissingTableError(leadRunsResult.error.message, 'ai_runs')) {
      throw new Error(leadRunsResult.error.message);
    }

    aiRuns = [
      ...((customerRunsResult.data || []) as Array<Record<string, unknown>>),
      ...((jobRunsResult.data || []) as Array<Record<string, unknown>>),
      ...((leadRunsResult.data || []) as Array<Record<string, unknown>>),
    ];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isMissingTableError(message, 'ai_runs')) {
      throw error;
    }
  }

  const serviceHistory = jobs.map((job) => ({
    ...job,
    assignee_label:
      assigneeLookup.get(readString(job.assignee_id)) || readString(job.assignee_id) || 'Unassigned',
  }));
  const unpaidJobs = serviceHistory.filter((job) => readString(job.payment_status) !== 'paid');
  const paidJobs = serviceHistory.filter((job) => readString(job.payment_status) === 'paid');
  const nextAppointment =
    serviceHistory.find((job) => {
      const scheduledAt = toDate(job.scheduled_at);
      return scheduledAt && scheduledAt.getTime() >= Date.now() && readString(job.ui_status) === 'scheduled';
    }) || null;
  const lastCompletedService =
    serviceHistory.find((job) => readString(job.ui_status) === 'completed') || null;
  const lifetimeEstimatedRevenue = serviceHistory.reduce((sum, job) => sum + readNumber(job.estimated_amount), 0);
  const unpaidBalance = unpaidJobs.reduce((sum, job) => sum + readNumber(job.estimated_amount), 0);
  const recentContactAt = computeRecentContactAt(
    enquiries,
    clientAuditLogs.filter(
      (entry) => readString(entry.entity_type) === 'client_message'
    )
  );
  const lastPaymentChangeAt =
    jobAuditLogs
      .find((entry) => {
        const details = readRecord(entry.details);
        return Boolean(readRecord(details.payment_status).to);
      })
      ?.created_at || null;
  const unassignedUpcomingCount = serviceHistory.filter(
    (job) => job.is_unassigned && !job.is_overdue && readString(job.ui_status) === 'scheduled'
  ).length;
  const openMessageCount = enquiries.length;
  const fleetCount = enquiries.filter((enquiry) => readString(enquiry.source_page) === 'fleet').length;

  const summary = {
    assignedOwnerLabel:
      assigneeLookup.get(readString(clientResult.data.assignee_id)) ||
      readString(clientResult.data.assignee_id) ||
      'Unassigned',
    lifetimeEstimatedRevenue,
    unpaidBalance,
    nextAppointment,
    lastCompletedService,
    recentContactAt,
    lastPaymentChangeAt,
    unassignedUpcomingCount,
    riskFlags: buildRiskFlags({
      unpaidBalance,
      unpaidCount: unpaidJobs.length,
      nextAppointment,
      unassignedUpcomingCount,
      openMessageCount,
      lastCompletedServiceAt: readString(lastCompletedService?.completed_at) || null,
    }),
    recommendedNextAction: buildRecommendedNextAction({
      unpaidBalance,
      nextAppointment,
      unassignedUpcomingCount,
      openMessageCount,
      fleetCount,
    }),
  };

  const messageLogs = clientAuditLogs
    .filter((entry) => readString(entry.entity_type) === 'client_message')
    .map((entry) => {
      const details = readRecord(entry.details);
      return {
        id: readString(entry.id),
        created_at: readString(entry.created_at),
        action: readString(entry.action),
        channel: readString(details.channel) || 'internal',
        subject: readString(details.subject) || null,
        body: readString(details.body) || '',
        recipient: readString(details.recipient) || null,
        intent: readString(details.intent) || null,
        status: readString(details.status) || 'logged',
        direction: readString(details.direction) || 'outbound',
        templateId: readString(details.templateId) || null,
      };
    });

  const timeline = [
    ...serviceHistory.map((job) => ({
      id: `job-${readString(job.id)}`,
      kind: 'job',
      createdAt: readString(job.scheduled_at) || readString(job.created_at),
      title: readString(job.client_name) || 'Service job',
      subtitle: `${readString(job.service_type)} | ${readString(job.ui_status) || readString(job.status)}`,
      note: readString(job.follow_up_reason) || null,
      entityId: readString(job.id),
      entityType: 'service_job',
      category: 'Jobs',
    })),
    ...((timelineResult.data || []) as Array<Record<string, unknown>>).map((event) => ({
      id: `timeline-${readString(event.id)}`,
      kind: 'note',
      createdAt: readString(event.created_at),
      title: readString(event.event_type).replace(/_/g, ' ') || 'Timeline event',
      subtitle: readString(event.note) || 'Job timeline update',
      note: readString(event.note) || null,
      entityId: readString(event.service_job_id),
      entityType: 'timeline_event',
      category: 'Notes',
    })),
    ...messageLogs.map((message) => ({
      id: `message-${message.id}`,
      kind: 'message',
      createdAt: message.created_at,
      title: `${message.channel.toUpperCase()} ${message.status}`,
      subtitle: message.subject || message.body.slice(0, 120),
      note: message.body,
      entityId: message.id,
      entityType: 'client_message',
      category: 'Messages',
    })),
    ...enquiries.map((enquiry) => ({
      id: `enquiry-${readString(enquiry.id)}`,
      kind: 'message',
      createdAt: readString(enquiry.created_at),
      title: `${readString(enquiry.name) || 'Customer'} enquiry`,
      subtitle: readString(enquiry.service_type) || readString(enquiry.source_page) || 'Inbound message',
      note: readString(enquiry.message) || null,
      entityId: readString(enquiry.id),
      entityType: 'enquiry',
      category: 'Messages',
    })),
    ...((billingResult.data || []) as Array<Record<string, unknown>>).map((record) => ({
      id: `billing-${readString(record.id)}`,
      kind: 'payment',
      createdAt: readString(record.updated_at) || readString(record.created_at),
      title: readString(record.record_type) || 'Billing record',
      subtitle: `${readString(record.status)} | ${readString(record.record_number) || 'No record number'}`,
      note: null,
      entityId: readString(record.id),
      entityType: 'billing_record',
      category: 'Payments',
    })),
    ...jobAuditLogs
      .filter((entry) => {
        const details = readRecord(entry.details);
        return Boolean(readRecord(details.payment_status).to);
      })
      .map((entry) => {
        const details = readRecord(entry.details);
        const paymentStatus = readString(readRecord(details.payment_status).to) || 'updated';
        return {
          id: `payment-audit-${readString(entry.id)}`,
          kind: 'payment' as const,
          createdAt: readString(entry.created_at),
          title: `Payment ${paymentStatus}`,
          subtitle: readString(entry.action).replace(/_/g, ' ') || 'Payment state changed',
          note: null,
          entityId: readString(entry.entity_id),
          entityType: 'service_job',
          category: 'Payments' as const,
        };
      }),
    ...clientAuditLogs
      .filter((entry) => readString(entry.entity_type) === 'client')
      .map((entry) => ({
        id: `audit-${readString(entry.id)}`,
        kind: 'note',
        createdAt: readString(entry.created_at),
        title: readString(entry.action).replace(/_/g, ' ') || 'Client updated',
        subtitle: 'Customer profile changed',
        note: Object.keys(readRecord(entry.details)).join(', ') || null,
        entityId: readString(entry.entity_id),
        entityType: 'client',
        category: 'Notes',
      })),
    ...aiRuns.map((run) => ({
      id: `ai-${readString(run.id)}`,
      kind: 'ai',
      createdAt: readString(run.created_at),
      title: readString(run.feature_name).replace(/_/g, ' ') || 'AI run',
      subtitle: `${readString(run.status)} | ${readString(run.entity_type)}`,
      note: readString(readRecord(run.output_snapshot).summary) || null,
      entityId: readString(run.id),
      entityType: 'ai_run',
      category: 'AI',
    })),
  ]
    .filter((item) => item.createdAt)
    .sort((left, right) => {
      const leftTime = toDate(left.createdAt)?.getTime() || 0;
      const rightTime = toDate(right.createdAt)?.getTime() || 0;
      return rightTime - leftTime;
    });

  return {
    client: {
      ...clientResult.data,
      assignee_label:
        assigneeLookup.get(readString(clientResult.data.assignee_id)) ||
        readString(clientResult.data.assignee_id) ||
        'Unassigned',
    },
    summary,
    vehicles: (vehiclesResult.data || []) as Array<Record<string, unknown>>,
    serviceJobs: serviceHistory,
    unpaidJobs,
    paidJobs,
    leads,
    enquiries,
    messageLogs,
    billingRecords: (billingResult.data || []) as Array<Record<string, unknown>>,
    aiRuns,
    timeline,
  };
};

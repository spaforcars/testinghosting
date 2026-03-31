import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from './_lib/auth';
import { getSupabaseAdmin } from './_lib/supabaseAdmin';
import { badRequest, forbidden, methodNotAllowed, serverError, unauthorized } from './_lib/http';
import { writeAuditLog } from './_lib/audit';
import { createInAppNotification } from './_lib/inAppNotifications';
import { isFeatureEnabled } from './_lib/featureFlags';
import { fetchDashboardJobs, loadAssigneeNameLookup } from './_lib/dashboardData';
import { mapJobToUiStatus, mapJobUiStatusToInternal } from './_lib/dashboardStatus';
import {
  BOOKING_CAPACITY_CONFLICT_MESSAGE,
  checkInstantBookingCapacity,
  getBookingServiceSelection,
  getBookingSettings,
  getScheduledEndAt,
} from './_lib/booking';
import { getJobOperatorMeta } from './_lib/operatorWorkflow';
import { normalizeServiceAddonIds, normalizeServiceCatalogId } from './_lib/serviceSelection';

const isMissingColumnError = (message: string, column: string) =>
  message.includes(`Could not find the '${column}' column`) ||
  new RegExp(`column\\s+(?:[a-z0-9_]+\\.)?${column}\\s+does not exist`, 'i').test(message);

const normalizePagination = (req: VercelRequest) => {
  const rawPage = Number(req.query.page || 1);
  const rawPageSize = Number(req.query.pageSize || req.query.limit || 50);

  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
  const pageSize = Number.isFinite(rawPageSize)
    ? Math.min(Math.max(Math.floor(rawPageSize), 1), 200)
    : 50;

  const offset = (page - 1) * pageSize;
  const to = offset + pageSize - 1;
  return { page, pageSize, offset, to };
};

const parseBooleanFilter = (value: unknown) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
};

const readLegacyPaymentStatus = (details: unknown): 'paid' | 'unpaid' | null => {
  if (!details || typeof details !== 'object') return null;
  const record = details as Record<string, unknown>;
  const paymentStatus = record.payment_status;
  if (!paymentStatus || typeof paymentStatus !== 'object') return null;
  const nextValue = (paymentStatus as Record<string, unknown>).to;
  return nextValue === 'paid' || nextValue === 'unpaid' ? nextValue : null;
};

const loadPaymentStatusOverrides = async (
  supabase: ReturnType<typeof getSupabaseAdmin>,
  jobIds: string[]
) => {
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
    if (paymentStatus) {
      overrides.set(row.entity_id, paymentStatus);
    }
  }

  return overrides;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);

    const opsEnabled = await isFeatureEnabled(supabase, 'ops_v1_enabled', true);
    if (!opsEnabled) return forbidden(res);

    if (req.method === 'GET') {
      if (!hasPermission(auth, 'services', 'read')) return forbidden(res);

      const { page, pageSize, offset, to } = normalizePagination(req);
      const filteredJobs = await fetchDashboardJobs(supabase, {
        limit: 1000,
        scheduledFrom: typeof req.query.scheduledFrom === 'string' ? req.query.scheduledFrom : null,
        scheduledTo: typeof req.query.scheduledTo === 'string' ? req.query.scheduledTo : null,
        search: typeof req.query.search === 'string' ? req.query.search : null,
        status: typeof req.query.status === 'string' ? req.query.status : 'all',
        paymentStatus:
          req.query.paymentStatus === 'paid' || req.query.paymentStatus === 'unpaid'
            ? req.query.paymentStatus
            : 'all',
        assigneeId: typeof req.query.assigneeId === 'string' ? req.query.assigneeId : 'all',
        clientId: typeof req.query.clientId === 'string' ? req.query.clientId : null,
        leadId: typeof req.query.leadId === 'string' ? req.query.leadId : null,
        unassignedOnly: parseBooleanFilter(req.query.unassignedOnly) === true,
        overdueOnly: parseBooleanFilter(req.query.overdueOnly) === true,
        needsPaymentFollowUp: parseBooleanFilter(req.query.needsPaymentFollowUp) === true,
      });

      const total = filteredJobs.length;
      const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;
      const pageItems = filteredJobs.slice(offset, to + 1);
      const assigneeLookup = await loadAssigneeNameLookup(
        supabase,
        pageItems.map((job) => String(job.assignee_id || '')).filter(Boolean)
      );

      return res.status(200).json({
        serviceJobs: pageItems.map((job) => {
          const operatorMeta = getJobOperatorMeta(job);
          return {
            ...job,
            assignee_label:
              assigneeLookup.get(String(job.assignee_id || '')) || String(job.assignee_id || '') || null,
            aging_state: operatorMeta.agingState,
            follow_up_reason: operatorMeta.followUpReason || null,
            is_unassigned: operatorMeta.isUnassigned,
            is_overdue: operatorMeta.isOverdue,
            needs_payment_follow_up: operatorMeta.needsPaymentFollowUp,
          };
        }),
        pagination: { page, pageSize, total, totalPages },
      });
    }

    if (req.method === 'POST') {
      if (!hasPermission(auth, 'services', 'write')) return forbidden(res);
      const body = req.body as {
        leadId?: string;
        clientId?: string;
        clientName?: string;
        serviceType?: string;
        serviceCatalogId?: string | null;
        serviceAddonIds?: string[] | null;
        status?: string;
        scheduledAt?: string | null;
        assigneeId?: string | null;
        notes?: string | null;
        vehicleMake?: string | null;
        vehicleModel?: string | null;
        vehicleYear?: number | null;
        estimatedAmount?: number | null;
        paymentStatus?: 'unpaid' | 'paid' | null;
        bookingSource?: string | null;
        bookingReference?: string | null;
        pickupRequested?: boolean | null;
        pickupAddress?: Record<string, unknown> | null;
      };
      if (!body.clientName || !body.serviceType) {
        return badRequest(res, 'clientName and serviceType are required');
      }
      const serviceCatalogId = normalizeServiceCatalogId(body.serviceCatalogId);
      const serviceAddonIds = normalizeServiceAddonIds(body.serviceAddonIds);
      const bookingSettings = await getBookingSettings(supabase);
      const selection = serviceCatalogId
        ? await getBookingServiceSelection(serviceCatalogId, serviceAddonIds)
        : null;
      if (body.scheduledAt && selection?.primaryService.bookingMode === 'instant') {
        const capacity = await checkInstantBookingCapacity(supabase, {
          serviceId: selection.primaryService.id,
          addOnIds: serviceAddonIds,
          scheduledAt: body.scheduledAt,
          ignoreCalendarBlocks: true,
        });
        if (!capacity.isAvailable) {
          return res.status(409).json({ error: BOOKING_CAPACITY_CONFLICT_MESSAGE });
        }
      }
      const scheduledEndAt = getScheduledEndAt(
        body.scheduledAt || null,
        selection?.primaryService || null,
        selection?.addOns || [],
        bookingSettings
      );

      const { data, error } = await supabase
        .from('service_jobs')
        .insert({
          lead_id: body.leadId || null,
          client_id: body.clientId || null,
          client_name: body.clientName,
          service_type: body.serviceType,
          service_catalog_id: serviceCatalogId,
          service_addon_ids: serviceAddonIds.length ? serviceAddonIds : null,
          status: mapJobUiStatusToInternal(body.status || 'scheduled')[0] || 'booked',
          scheduled_at: body.scheduledAt || null,
          scheduled_end_at: scheduledEndAt,
          assignee_id: body.assigneeId || null,
          notes: body.notes || null,
          vehicle_make: body.vehicleMake || null,
          vehicle_model: body.vehicleModel || null,
          vehicle_year: typeof body.vehicleYear === 'number' ? body.vehicleYear : null,
          estimated_amount: typeof body.estimatedAmount === 'number' ? body.estimatedAmount : 0,
          payment_status: body.paymentStatus || 'unpaid',
          booking_source: body.bookingSource || 'ops',
          booking_reference: body.bookingReference || null,
          pickup_requested: Boolean(body.pickupRequested),
          pickup_address: body.pickupAddress || null,
          completed_at: body.status === 'completed' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();
      if (error) throw new Error(error.message);

      await supabase.from('job_timeline_events').insert({
        service_job_id: data.id,
        lead_id: data.lead_id,
        client_id: data.client_id,
        event_type: 'job_created',
        note: 'Service job created',
        metadata: {
          status: data.status,
          scheduledAt: data.scheduled_at,
        },
        created_by: auth.userId,
      });

      await writeAuditLog(supabase, {
        userId: auth.userId,
        action: 'create',
        module: 'services',
        entityType: 'service_job',
        entityId: data.id,
      });

      if (data.assignee_id) {
        await createInAppNotification(supabase, data.assignee_id, {
          category: 'service_job',
          title: 'New service job assigned',
          message: `${data.client_name} | ${data.service_type}`,
          entityType: 'service_job',
          entityId: data.id,
          metadata: {
            status: data.status,
          },
        });
      }

      return res.status(201).json({
        serviceJob: {
          ...data,
          ui_status: mapJobToUiStatus(data.status),
        },
      });
    }

    if (req.method === 'PATCH') {
      if (!hasPermission(auth, 'services', 'write')) return forbidden(res);
      const body = req.body as {
        id?: string;
        status?: string;
        scheduledAt?: string | null;
        assigneeId?: string | null;
        notes?: string | null;
        serviceType?: string;
        serviceCatalogId?: string | null;
        serviceAddonIds?: string[] | null;
        clientName?: string;
        clientId?: string | null;
        vehicleMake?: string | null;
        vehicleModel?: string | null;
        vehicleYear?: number | null;
        estimatedAmount?: number | null;
        paymentStatus?: 'unpaid' | 'paid' | null;
        bookingSource?: string | null;
        bookingReference?: string | null;
        pickupRequested?: boolean | null;
        pickupAddress?: Record<string, unknown> | null;
      };
      if (!body.id) return badRequest(res, 'id is required');

      const { data: previousJob } = await supabase
        .from('service_jobs')
        .select('*')
        .eq('id', body.id)
        .maybeSingle();
      if (!previousJob) return badRequest(res, 'Service job not found');

      const updates: Record<string, unknown> = {};
      if (body.status) {
        const internalStatus = mapJobUiStatusToInternal(body.status)[0] || body.status;
        updates.status = internalStatus;
        updates.completed_at = internalStatus === 'completed' ? new Date().toISOString() : null;
      }
      if (typeof body.scheduledAt !== 'undefined') updates.scheduled_at = body.scheduledAt || null;
      if (typeof body.assigneeId !== 'undefined') updates.assignee_id = body.assigneeId || null;
      if (typeof body.notes !== 'undefined') updates.notes = body.notes || null;
      if (typeof body.serviceType !== 'undefined') updates.service_type = body.serviceType;
      if (typeof body.serviceCatalogId !== 'undefined') {
        updates.service_catalog_id = normalizeServiceCatalogId(body.serviceCatalogId);
      }
      if (typeof body.serviceAddonIds !== 'undefined') {
        const serviceAddonIds = normalizeServiceAddonIds(body.serviceAddonIds);
        updates.service_addon_ids = serviceAddonIds.length ? serviceAddonIds : null;
      }
      if (typeof body.clientName !== 'undefined') updates.client_name = body.clientName;
      if (typeof body.clientId !== 'undefined') updates.client_id = body.clientId || null;
      if (typeof body.vehicleMake !== 'undefined') updates.vehicle_make = body.vehicleMake || null;
      if (typeof body.vehicleModel !== 'undefined') updates.vehicle_model = body.vehicleModel || null;
      if (typeof body.vehicleYear !== 'undefined') updates.vehicle_year = body.vehicleYear || null;
      if (typeof body.estimatedAmount === 'number') updates.estimated_amount = body.estimatedAmount;
      if (typeof body.paymentStatus !== 'undefined') updates.payment_status = body.paymentStatus || 'unpaid';
      if (typeof body.bookingSource !== 'undefined') updates.booking_source = body.bookingSource || null;
      if (typeof body.bookingReference !== 'undefined') updates.booking_reference = body.bookingReference || null;
      if (typeof body.pickupRequested !== 'undefined') updates.pickup_requested = Boolean(body.pickupRequested);
      if (typeof body.pickupAddress !== 'undefined') updates.pickup_address = body.pickupAddress || null;

      const serviceCatalogIdForEnd =
        typeof body.serviceCatalogId !== 'undefined'
          ? normalizeServiceCatalogId(body.serviceCatalogId)
          : previousJob.service_catalog_id;
      const serviceAddonIdsForEnd =
        typeof body.serviceAddonIds !== 'undefined'
          ? normalizeServiceAddonIds(body.serviceAddonIds)
          : previousJob.service_addon_ids || [];
      const scheduledAtForEnd =
        typeof body.scheduledAt !== 'undefined' ? body.scheduledAt || null : previousJob.scheduled_at;
      if (
        typeof body.scheduledAt !== 'undefined' ||
        typeof body.serviceCatalogId !== 'undefined' ||
        typeof body.serviceAddonIds !== 'undefined'
      ) {
        const bookingSettings = await getBookingSettings(supabase);
        const selection = serviceCatalogIdForEnd
          ? await getBookingServiceSelection(serviceCatalogIdForEnd, serviceAddonIdsForEnd)
          : null;
        if (scheduledAtForEnd && selection?.primaryService.bookingMode === 'instant') {
          const capacity = await checkInstantBookingCapacity(supabase, {
            serviceId: selection.primaryService.id,
            addOnIds: serviceAddonIdsForEnd,
            scheduledAt: scheduledAtForEnd,
            excludeJobId: body.id,
            ignoreCalendarBlocks: true,
          });
          if (!capacity.isAvailable) {
            return res.status(409).json({ error: BOOKING_CAPACITY_CONFLICT_MESSAGE });
          }
        }
        updates.scheduled_end_at = getScheduledEndAt(
          scheduledAtForEnd,
          selection?.primaryService || null,
          selection?.addOns || [],
          bookingSettings
        );
      }
      updates.updated_at = new Date().toISOString();

      if (!Object.keys(updates).length) return badRequest(res, 'No updates provided');

      let { data, error } = await supabase
        .from('service_jobs')
        .update(updates)
        .eq('id', body.id)
        .select('*')
        .single();

      if (error && isMissingColumnError(error.message, 'payment_status') && 'payment_status' in updates) {
        const { payment_status, ...legacyUpdates } = updates;
        ({ data, error } = await supabase
          .from('service_jobs')
          .update(legacyUpdates)
          .eq('id', body.id)
          .select('*')
          .single());
      }
      if (error) throw new Error(error.message);

      const metadata: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        metadata[key] = {
          from: (previousJob as Record<string, unknown>)[key],
          to: value,
        };
      }

      await supabase.from('job_timeline_events').insert({
        service_job_id: data.id,
        lead_id: data.lead_id,
        client_id: data.client_id,
        event_type: 'job_updated',
        note: 'Service job updated',
        metadata,
        created_by: auth.userId,
      });

      await writeAuditLog(supabase, {
        userId: auth.userId,
        action: 'update',
        module: 'services',
        entityType: 'service_job',
        entityId: body.id,
        details: updates,
      });

      if (
        typeof body.assigneeId !== 'undefined' &&
        body.assigneeId &&
        body.assigneeId !== previousJob.assignee_id
      ) {
        await createInAppNotification(supabase, body.assigneeId, {
          category: 'service_job',
          title: 'Service job assigned',
          message: `${data.client_name} | ${data.service_type}`,
          entityType: 'service_job',
          entityId: data.id,
          metadata: {
            status: data.status,
            scheduledAt: data.scheduled_at,
          },
        });
      }

      return res.status(200).json({
        serviceJob: {
          ...data,
          payment_status:
            (typeof body.paymentStatus !== 'undefined' ? body.paymentStatus : data.payment_status) || 'unpaid',
          ui_status: mapJobToUiStatus(data.status),
        },
      });
    }

    return methodNotAllowed(res);
  } catch (error) {
    return serverError(res, error);
  }
}

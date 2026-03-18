import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../../_lib/auth';
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin';
import { badRequest, forbidden, methodNotAllowed, readRouteId, serverError, unauthorized } from '../../_lib/http';
import { writeAuditLog } from '../../_lib/audit';
import { createInAppNotification } from '../../_lib/inAppNotifications';
import { getBookingServiceSelection, getBookingSettings, getScheduledEndAt } from '../../_lib/booking';
import { isFeatureEnabled } from '../../_lib/featureFlags';
import { normalizeServiceAddonIds, normalizeServiceCatalogId } from '../../_lib/serviceSelection';

interface ConvertLeadBody {
  clientId?: string;
  createClient?: boolean;
  createServiceJob?: boolean;
  client?: {
    name?: string;
    companyName?: string;
    email?: string;
    phone?: string;
    notes?: string;
    assigneeId?: string | null;
  };
  serviceJob?: {
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
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);
    if (!hasPermission(auth, 'leads', 'write')) return forbidden(res);
    if (!hasPermission(auth, 'clients', 'write')) return forbidden(res);

    const opsEnabled = await isFeatureEnabled(supabase, 'ops_v1_enabled', true);
    if (!opsEnabled) return forbidden(res);

    const leadId = readRouteId(req, 1);
    if (!leadId) return badRequest(res, 'lead id is required');

    const body = (req.body || {}) as ConvertLeadBody;
    const createClient = body.createClient !== false;
    const createServiceJob = body.createServiceJob !== false;

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .maybeSingle();

    if (leadError) throw new Error(leadError.message);
    if (!lead) return badRequest(res, 'Lead not found');

    let clientId = body.clientId || null;
    let clientRecord: Record<string, unknown> | null = null;

    const vehicleMake = body.serviceJob?.vehicleMake ?? lead.vehicle_make;
    const vehicleModel = body.serviceJob?.vehicleModel ?? lead.vehicle_model;
    const vehicleYear = body.serviceJob?.vehicleYear ?? lead.vehicle_year;
    const serviceCatalogId = normalizeServiceCatalogId(
      body.serviceJob?.serviceCatalogId ?? lead.service_catalog_id
    );
    const serviceAddonIds = normalizeServiceAddonIds(
      body.serviceJob?.serviceAddonIds ?? lead.service_addon_ids
    );
    const serviceType = body.serviceJob?.serviceType || lead.service_type || 'General Service';
    const leadIntakeMetadata =
      lead.intake_metadata && typeof lead.intake_metadata === 'object'
        ? (lead.intake_metadata as Record<string, unknown>)
        : {};

    if (!clientId && createClient) {
      const clientInsert = {
        name: body.client?.name || lead.name,
        company_name: body.client?.companyName || null,
        email: body.client?.email || lead.email || null,
        phone: body.client?.phone || lead.phone || null,
        notes: body.client?.notes || null,
        assignee_id: typeof body.client?.assigneeId !== 'undefined' ? body.client.assigneeId : lead.assignee_id,
        archived: false,
      };

      const { data: createdClient, error: clientError } = await supabase
        .from('clients')
        .insert(clientInsert)
        .select('*')
        .single();

      if (clientError) throw new Error(clientError.message);
      clientId = createdClient.id;
      clientRecord = createdClient;

      if (vehicleMake || vehicleModel || vehicleYear) {
        await supabase.from('customer_vehicles').insert({
          client_id: createdClient.id,
          make: vehicleMake || null,
          model: vehicleModel || null,
          year: vehicleYear || null,
        });
      }
    }

    let serviceJobRecord: Record<string, unknown> | null = null;
    if (createServiceJob) {
      if (!hasPermission(auth, 'services', 'write')) return forbidden(res);
      const bookingSettings = await getBookingSettings(supabase);
      const selection = serviceCatalogId
        ? await getBookingServiceSelection(serviceCatalogId, serviceAddonIds)
        : null;
      const jobPayload = {
        lead_id: lead.id,
        client_id: clientId,
        client_name: clientRecord?.name || lead.name,
        service_type: serviceType,
        service_catalog_id: serviceCatalogId,
        service_addon_ids: serviceAddonIds.length ? serviceAddonIds : null,
        status: body.serviceJob?.status || 'booked',
        scheduled_at: body.serviceJob?.scheduledAt || null,
        scheduled_end_at: getScheduledEndAt(
          body.serviceJob?.scheduledAt || null,
          selection?.primaryService || null,
          selection?.addOns || [],
          bookingSettings
        ),
        assignee_id:
          typeof body.serviceJob?.assigneeId !== 'undefined'
            ? body.serviceJob.assigneeId
            : lead.assignee_id,
        notes: body.serviceJob?.notes || null,
        vehicle_make: vehicleMake || null,
        vehicle_model: vehicleModel || null,
        vehicle_year: vehicleYear || null,
        estimated_amount:
          typeof body.serviceJob?.estimatedAmount === 'number' ? body.serviceJob.estimatedAmount : 0,
        payment_status: body.serviceJob?.paymentStatus || 'unpaid',
        booking_source:
          body.serviceJob?.bookingSource ||
          (lead.booking_mode === 'instant' || lead.booking_mode === 'request' ? 'public' : 'ops'),
        booking_reference:
          body.serviceJob?.bookingReference || String(leadIntakeMetadata.bookingReference || '') || null,
        pickup_requested: Boolean(body.serviceJob?.pickupRequested || leadIntakeMetadata.pickupRequested),
        pickup_address: body.serviceJob?.pickupAddress || leadIntakeMetadata.pickupAddress || null,
        completed_at: body.serviceJob?.status === 'completed' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      const { data: createdJob, error: jobError } = await supabase
        .from('service_jobs')
        .insert(jobPayload)
        .select('*')
        .single();

      if (jobError) throw new Error(jobError.message);
      serviceJobRecord = createdJob;

      await supabase.from('job_timeline_events').insert({
        service_job_id: createdJob.id,
        lead_id: lead.id,
        client_id: clientId,
        event_type: 'job_created',
        note: 'Service job created from lead conversion',
        metadata: {
          source: 'lead_convert',
          leadStatusBefore: lead.status,
        },
        created_by: auth.userId,
      });
    }

    const leadUpdate: Record<string, unknown> = {
      status: createServiceJob ? 'booked' : 'contacted',
      service_type: serviceType,
      service_catalog_id: serviceCatalogId,
      service_addon_ids: serviceAddonIds.length ? serviceAddonIds : null,
      updated_at: new Date().toISOString(),
    };

    if (serviceJobRecord && serviceJobRecord.client_id) {
      leadUpdate.assignee_id = serviceJobRecord.assignee_id || lead.assignee_id;
    }

    const { data: updatedLead, error: leadUpdateError } = await supabase
      .from('leads')
      .update(leadUpdate)
      .eq('id', lead.id)
      .select('*')
      .single();

    if (leadUpdateError) throw new Error(leadUpdateError.message);

    await writeAuditLog(supabase, {
      userId: auth.userId,
      action: 'convert',
      module: 'leads',
      entityType: 'lead',
      entityId: lead.id,
      details: {
        clientId,
        serviceJobId: serviceJobRecord?.id || null,
      },
    });

    const assigneeId = String(serviceJobRecord?.assignee_id || updatedLead.assignee_id || '');
    if (assigneeId) {
      await createInAppNotification(supabase, assigneeId, {
        category: 'lead',
        title: 'Lead converted to service job',
        message: `${updatedLead.name} was converted and is ready for execution.`,
        entityType: 'service_job',
        entityId: String(serviceJobRecord?.id || ''),
        metadata: {
          leadId: lead.id,
          clientId,
        },
      });
    }

    return res.status(200).json({
      lead: updatedLead,
      client: clientRecord,
      serviceJob: serviceJobRecord,
    });
  } catch (error) {
    return serverError(res, error);
  }
}

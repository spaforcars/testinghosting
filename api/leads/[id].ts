import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../_lib/auth';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { badRequest, forbidden, methodNotAllowed, readRouteId, serverError, unauthorized } from '../_lib/http';
import { writeAuditLog } from '../_lib/audit';
import { createInAppNotification } from '../_lib/inAppNotifications';
import { isFeatureEnabled } from '../_lib/featureFlags';
import { mapLeadToUiStatus, mapLeadUiStatusToInternal } from '../_lib/dashboardStatus';
import { normalizeServiceAddonIds, normalizeServiceCatalogId } from '../_lib/serviceSelection';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') return methodNotAllowed(res);

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);
    if (!hasPermission(auth, 'leads', 'write')) return forbidden(res);

    const opsEnabled = await isFeatureEnabled(supabase, 'ops_v1_enabled', true);
    if (!opsEnabled) return forbidden(res);

    const id = readRouteId(req);
    if (!id) return badRequest(res, 'id is required');

    const body = req.body as {
      status?: string;
      assigneeId?: string | null;
      serviceType?: string | null;
      serviceCatalogId?: string | null;
      serviceAddonIds?: string[] | null;
      sourcePage?: string;
      phone?: string | null;
      email?: string | null;
      vehicleMake?: string | null;
      vehicleModel?: string | null;
      vehicleYear?: number | null;
      notes?: string | null;
      bookingMode?: 'instant' | 'request' | null;
      intakeMetadata?: Record<string, unknown> | null;
    };

    if (
      !body.status &&
      typeof body.assigneeId === 'undefined' &&
      typeof body.serviceType === 'undefined' &&
      typeof body.serviceCatalogId === 'undefined' &&
      typeof body.serviceAddonIds === 'undefined' &&
      typeof body.sourcePage === 'undefined' &&
      typeof body.phone === 'undefined' &&
      typeof body.email === 'undefined' &&
      typeof body.vehicleMake === 'undefined' &&
      typeof body.vehicleModel === 'undefined' &&
      typeof body.vehicleYear === 'undefined' &&
      typeof body.bookingMode === 'undefined' &&
      typeof body.intakeMetadata === 'undefined'
    ) {
      return badRequest(res, 'At least one update field is required');
    }

    const { data: currentLead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!currentLead) return badRequest(res, 'Lead not found');

    const updates: Record<string, unknown> = {};
    if (body.status) updates.status = mapLeadUiStatusToInternal(body.status)[0] || body.status;
    if (typeof body.assigneeId !== 'undefined') updates.assignee_id = body.assigneeId || null;
    if (typeof body.serviceType !== 'undefined') updates.service_type = body.serviceType || null;
    if (typeof body.serviceCatalogId !== 'undefined') {
      updates.service_catalog_id = normalizeServiceCatalogId(body.serviceCatalogId);
    }
    if (typeof body.serviceAddonIds !== 'undefined') {
      const serviceAddonIds = normalizeServiceAddonIds(body.serviceAddonIds);
      updates.service_addon_ids = serviceAddonIds.length ? serviceAddonIds : null;
    }
    if (typeof body.sourcePage !== 'undefined') updates.source_page = body.sourcePage || currentLead.source_page;
    if (typeof body.phone !== 'undefined') updates.phone = body.phone || null;
    if (typeof body.email !== 'undefined') updates.email = body.email || currentLead.email;
    if (typeof body.vehicleMake !== 'undefined') updates.vehicle_make = body.vehicleMake || null;
    if (typeof body.vehicleModel !== 'undefined') updates.vehicle_model = body.vehicleModel || null;
    if (typeof body.vehicleYear !== 'undefined') updates.vehicle_year = body.vehicleYear || null;
    if (typeof body.bookingMode !== 'undefined') updates.booking_mode = body.bookingMode || null;
    if (typeof body.intakeMetadata !== 'undefined') updates.intake_metadata = body.intakeMetadata || {};
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    if (typeof body.assigneeId !== 'undefined' && body.assigneeId && body.assigneeId !== currentLead.assignee_id) {
      await createInAppNotification(supabase, body.assigneeId, {
        category: 'lead',
        title: 'Lead assigned',
        message: `${data.name} has been assigned to you.`,
        entityType: 'lead',
        entityId: data.id,
        metadata: {
          sourcePage: data.source_page,
          serviceType: data.service_type,
        },
      });
    }

    await writeAuditLog(supabase, {
      userId: auth.userId,
      action: 'update',
      module: 'leads',
      entityType: 'lead',
      entityId: id,
      details: updates,
    });

    return res.status(200).json({
      lead: {
        ...data,
        ui_status: mapLeadToUiStatus(data.status),
      },
    });
  } catch (error) {
    return serverError(res, error);
  }
}

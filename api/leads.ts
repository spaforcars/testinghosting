import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from './_lib/auth';
import { getSupabaseAdmin } from './_lib/supabaseAdmin';
import { badRequest, forbidden, methodNotAllowed, serverError, unauthorized } from './_lib/http';
import { writeAuditLog } from './_lib/audit';
import { isFeatureEnabled } from './_lib/featureFlags';
import { mapLeadToUiStatus, mapLeadUiStatusToInternal } from './_lib/dashboardStatus';
import { loadAssigneeNameLookup } from './_lib/dashboardData';
import { getLeadOperatorMeta, type LeadSourceGroup } from './_lib/operatorWorkflow';
import { normalizeServiceAddonIds, normalizeServiceCatalogId } from './_lib/serviceSelection';

const allowedLeadStatuses = new Set([
  'lead',
  'contacted',
  'quoted',
  'booked',
  'in_service',
  'completed',
  'closed_lost',
]);

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);

    const opsEnabled = await isFeatureEnabled(supabase, 'ops_v1_enabled', true);
    if (!opsEnabled) {
      return forbidden(res);
    }

    if (req.method === 'GET') {
      if (!hasPermission(auth, 'leads', 'read')) return forbidden(res);

      const { page, pageSize, offset, to } = normalizePagination(req);
      const sourceGroup =
        typeof req.query.sourceGroup === 'string' &&
        ['fleet', 'contact', 'booking', 'all'].includes(req.query.sourceGroup)
          ? (req.query.sourceGroup as LeadSourceGroup)
          : 'all';
      const bookingMode =
        req.query.bookingMode === 'instant' || req.query.bookingMode === 'request'
          ? req.query.bookingMode
          : null;
      const unassignedOnly = parseBooleanFilter(req.query.unassignedOnly) === true;
      const needsFollowUp = parseBooleanFilter(req.query.needsFollowUp) === true;

      let query = supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (req.query.status) {
        const statuses = mapLeadUiStatusToInternal(String(req.query.status));
        query = statuses.length > 1 ? query.in('status', statuses) : query.eq('status', statuses[0]);
      }
      if (req.query.sourcePage) {
        query = query.eq('source_page', String(req.query.sourcePage));
      }
      if (req.query.serviceType) {
        query = query.eq('service_type', String(req.query.serviceType));
      }
      if (req.query.assigneeId) {
        query = query.eq('assignee_id', String(req.query.assigneeId));
      }
      if (bookingMode) {
        query = query.eq('booking_mode', bookingMode);
      }
      if (req.query.dateFrom) {
        const parsed = new Date(String(req.query.dateFrom));
        if (!Number.isNaN(parsed.getTime())) {
          query = query.gte('created_at', parsed.toISOString());
        }
      }
      if (req.query.dateTo) {
        const rawDateTo = String(req.query.dateTo);
        const parsed = /^\d{4}-\d{2}-\d{2}$/.test(rawDateTo)
          ? new Date(`${rawDateTo}T23:59:59.999Z`)
          : new Date(rawDateTo);
        if (!Number.isNaN(parsed.getTime())) {
          query = query.lte('created_at', parsed.toISOString());
        }
      }
      if (req.query.search) {
        const term = String(req.query.search).trim();
        if (term) {
          const escaped = term.replace(/,/g, ' ').replace(/%/g, '');
          query = query.or(
            `name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%,service_type.ilike.%${escaped}%,vehicle_make.ilike.%${escaped}%,vehicle_model.ilike.%${escaped}%`
          );
        }
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      const assigneeLookup = await loadAssigneeNameLookup(
        supabase,
        ((data || []) as Array<Record<string, unknown>>)
          .map((lead) => String(lead.assignee_id || ''))
          .filter(Boolean)
      );

      const normalized = ((data || []) as Array<Record<string, unknown>>)
        .map((lead) => {
          const operatorMeta = getLeadOperatorMeta(lead as never);
          return {
            ...lead,
            ui_status: mapLeadToUiStatus(String(lead.status || '')),
            assignee_label:
              assigneeLookup.get(String(lead.assignee_id || '')) || String(lead.assignee_id || '') || null,
            aging_state: operatorMeta.agingState,
            follow_up_reason: operatorMeta.followUpReason || null,
            is_unassigned: operatorMeta.isUnassigned,
            is_reviewed: operatorMeta.isReviewed,
            reviewed_at: operatorMeta.reviewedAt,
            reviewed_by: operatorMeta.reviewedBy,
            source_group: operatorMeta.sourceGroup,
          };
        })
        .filter((lead) => {
          if (sourceGroup !== 'all' && lead.source_group !== sourceGroup) return false;
          if (unassignedOnly && !lead.is_unassigned) return false;
          if (needsFollowUp && lead.aging_state === 'fresh') return false;
          return true;
        });

      const total = normalized.length;
      const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;
      const paginated = normalized.slice(offset, to + 1);

      return res.status(200).json({
        leads: paginated,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
        },
      });
    }

    if (req.method === 'POST') {
      if (!hasPermission(auth, 'leads', 'write')) return forbidden(res);
      const body = req.body as {
        name?: string;
        email?: string;
        phone?: string;
        serviceType?: string;
        serviceCatalogId?: string | null;
        serviceAddonIds?: string[] | null;
        sourcePage?: string;
        status?: string;
        assigneeId?: string | null;
        vehicleMake?: string | null;
        vehicleModel?: string | null;
        vehicleYear?: number | null;
        bookingMode?: 'instant' | 'request' | null;
        intakeMetadata?: Record<string, unknown> | null;
      };

      if (!body.name || !body.phone || !body.sourcePage) {
        return badRequest(res, 'name, phone and sourcePage are required');
      }

      const status = body.status
        ? mapLeadUiStatusToInternal(body.status)[0] || 'lead'
        : 'lead';
      const serviceCatalogId = normalizeServiceCatalogId(body.serviceCatalogId);
      const serviceAddonIds = normalizeServiceAddonIds(body.serviceAddonIds);

      const { data, error } = await supabase
        .from('leads')
        .insert({
          name: body.name,
          email: body.email || `${body.phone.replace(/\s+/g, '')}@placeholder.local`,
          phone: body.phone || null,
          service_type: body.serviceType || null,
          service_catalog_id: serviceCatalogId,
          service_addon_ids: serviceAddonIds.length ? serviceAddonIds : null,
          source_page: body.sourcePage,
          status,
          assignee_id: body.assigneeId || null,
          vehicle_make: body.vehicleMake || null,
          vehicle_model: body.vehicleModel || null,
          vehicle_year: typeof body.vehicleYear === 'number' ? body.vehicleYear : null,
          booking_mode: body.bookingMode || null,
          intake_metadata: body.intakeMetadata || {},
        })
        .select('*')
        .single();

      if (error) throw new Error(error.message);

      await writeAuditLog(supabase, {
        userId: auth.userId,
        action: 'create',
        module: 'leads',
        entityType: 'lead',
        entityId: data.id,
      });

      return res.status(201).json({
        lead: {
          ...data,
          ui_status: mapLeadToUiStatus(data.status),
        },
      });
    }

    return methodNotAllowed(res);
  } catch (error) {
    return serverError(res, error);
  }
}

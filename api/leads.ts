import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from './_lib/auth';
import { getSupabaseAdmin } from './_lib/supabaseAdmin';
import { badRequest, forbidden, methodNotAllowed, serverError, unauthorized } from './_lib/http';
import { writeAuditLog } from './_lib/audit';
import { isFeatureEnabled } from './_lib/featureFlags';
import { mapLeadToUiStatus, mapLeadUiStatusToInternal } from './_lib/dashboardStatus';
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
      let query = supabase
        .from('leads')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

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

      const { data, error, count } = await query.range(offset, to);
      if (error) throw new Error(error.message);

      const total = count || 0;
      const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;

      return res.status(200).json({
        leads: (data || []).map((lead) => ({
          ...lead,
          ui_status: mapLeadToUiStatus(lead.status),
        })),
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

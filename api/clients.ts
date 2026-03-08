import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from './_lib/auth';
import { getSupabaseAdmin } from './_lib/supabaseAdmin';
import { badRequest, forbidden, methodNotAllowed, serverError, unauthorized } from './_lib/http';
import { writeAuditLog } from './_lib/audit';
import { isFeatureEnabled } from './_lib/featureFlags';

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
    if (!opsEnabled) return forbidden(res);

    if (req.method === 'GET') {
      if (!hasPermission(auth, 'clients', 'read')) return forbidden(res);

      const { page, pageSize, offset, to } = normalizePagination(req);
      let query = supabase
        .from('clients')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (req.query.archived) {
        query = query.eq('archived', String(req.query.archived) === 'true');
      } else {
        query = query.eq('archived', false);
      }

      if (req.query.assigneeId) {
        query = query.eq('assignee_id', String(req.query.assigneeId));
      }

      if (req.query.search) {
        const term = String(req.query.search).trim();
        if (term) {
          const escaped = term.replace(/,/g, ' ').replace(/%/g, '');
          query = query.or(
            `name.ilike.%${escaped}%,company_name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%`
          );
        }
      }

      const { data, error, count } = await query.range(offset, to);
      if (error) throw new Error(error.message);

      const total = count || 0;
      const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;

      return res.status(200).json({
        clients: data || [],
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
        },
      });
    }

    if (req.method === 'POST') {
      if (!hasPermission(auth, 'clients', 'write')) return forbidden(res);
      const body = req.body as {
        name?: string;
        companyName?: string;
        email?: string;
        phone?: string;
        alternatePhone?: string;
        addressLine1?: string;
        addressLine2?: string;
        city?: string;
        province?: string;
        postalCode?: string;
        country?: string;
        tags?: string[];
        notes?: string;
        assigneeId?: string | null;
      };

      if (!body.name) return badRequest(res, 'name is required');

      const { data, error } = await supabase
        .from('clients')
        .insert({
          name: body.name,
          company_name: body.companyName || null,
          email: body.email || null,
          phone: body.phone || null,
          alternate_phone: body.alternatePhone || null,
          address_line1: body.addressLine1 || null,
          address_line2: body.addressLine2 || null,
          city: body.city || null,
          province: body.province || null,
          postal_code: body.postalCode || null,
          country: body.country || null,
          tags: Array.isArray(body.tags) ? body.tags : [],
          notes: body.notes || null,
          assignee_id: body.assigneeId || null,
          archived: false,
        })
        .select('*')
        .single();

      if (error) throw new Error(error.message);

      await writeAuditLog(supabase, {
        userId: auth.userId,
        action: 'create',
        module: 'clients',
        entityType: 'client',
        entityId: data.id,
      });

      return res.status(201).json({ client: data });
    }

    return methodNotAllowed(res);
  } catch (error) {
    return serverError(res, error);
  }
}

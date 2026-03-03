import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from './_lib/auth';
import { getSupabaseAdmin } from './_lib/supabaseAdmin';
import { badRequest, forbidden, methodNotAllowed, serverError, unauthorized } from './_lib/http';
import { writeAuditLog } from './_lib/audit';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);

    if (req.method === 'GET') {
      if (!hasPermission(auth, 'leads', 'read')) return forbidden(res);

      let query = supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (req.query.status) {
        query = query.eq('status', String(req.query.status));
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

      const requestedLimit = Number(req.query.limit || 200);
      const safeLimit = Number.isFinite(requestedLimit)
        ? Math.min(Math.max(requestedLimit, 1), 500)
        : 200;

      const { data, error } = await query.limit(safeLimit);
      if (error) throw new Error(error.message);

      return res.status(200).json({ leads: data || [] });
    }

    if (req.method === 'POST') {
      if (!hasPermission(auth, 'leads', 'write')) return forbidden(res);
      const body = req.body as {
        name?: string;
        email?: string;
        phone?: string;
        serviceType?: string;
        sourcePage?: string;
      };

      if (!body.name || !body.email || !body.sourcePage) {
        return badRequest(res, 'name, email and sourcePage are required');
      }

      const { data, error } = await supabase
        .from('leads')
        .insert({
          name: body.name,
          email: body.email,
          phone: body.phone || null,
          service_type: body.serviceType || null,
          source_page: body.sourcePage,
          status: 'lead',
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

      return res.status(201).json({ lead: data });
    }

    return methodNotAllowed(res);
  } catch (error) {
    return serverError(res, error);
  }
}

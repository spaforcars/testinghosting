import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from './_lib/auth';
import { getSupabaseAdmin } from './_lib/supabaseAdmin';
import { badRequest, forbidden, methodNotAllowed, serverError, unauthorized } from './_lib/http';
import { writeAuditLog } from './_lib/audit';
import { isFeatureEnabled } from './_lib/featureFlags';

const allowedBillingStatuses = new Set([
  'draft',
  'sent',
  'partially_paid',
  'paid',
  'overdue',
  'void',
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

    const billingEnabled = await isFeatureEnabled(supabase, 'ops_billing_enabled', true);
    if (!billingEnabled) return forbidden(res);

    if (req.method === 'GET') {
      if (!hasPermission(auth, 'billing', 'read')) return forbidden(res);

      const { page, pageSize, offset, to } = normalizePagination(req);
      let query = supabase
        .from('billing_records')
        .select('*', { count: 'exact' })
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (req.query.status) query = query.eq('status', String(req.query.status));
      if (req.query.clientId) query = query.eq('client_id', String(req.query.clientId));
      if (req.query.serviceJobId) query = query.eq('service_job_id', String(req.query.serviceJobId));
      if (req.query.dateFrom) {
        const parsed = new Date(String(req.query.dateFrom));
        if (!Number.isNaN(parsed.getTime())) query = query.gte('created_at', parsed.toISOString());
      }
      if (req.query.dateTo) {
        const parsed = new Date(String(req.query.dateTo));
        if (!Number.isNaN(parsed.getTime())) query = query.lte('created_at', parsed.toISOString());
      }

      const { data, error, count } = await query.range(offset, to);
      if (error) throw new Error(error.message);

      const total = count || 0;
      const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;

      return res.status(200).json({
        records: data || [],
        pagination: { page, pageSize, total, totalPages },
      });
    }

    if (req.method === 'POST') {
      if (!hasPermission(auth, 'billing', 'write')) return forbidden(res);
      const body = req.body as {
        leadId?: string | null;
        clientId?: string | null;
        serviceJobId?: string | null;
        recordNumber?: string | null;
        recordType?: string;
        status?: string;
        currency?: string;
        subtotalAmount?: number;
        taxAmount?: number;
        totalAmount?: number;
        amountPaid?: number;
        dueAt?: string | null;
        issuedAt?: string | null;
        paidAt?: string | null;
        notes?: string | null;
      };

      if (!body.recordType) return badRequest(res, 'recordType is required');

      const status = body.status && allowedBillingStatuses.has(body.status) ? body.status : 'draft';

      const { data, error } = await supabase
        .from('billing_records')
        .insert({
          lead_id: body.leadId || null,
          client_id: body.clientId || null,
          service_job_id: body.serviceJobId || null,
          record_number: body.recordNumber || null,
          record_type: body.recordType,
          status,
          currency: body.currency || 'CAD',
          subtotal_amount: body.subtotalAmount || 0,
          tax_amount: body.taxAmount || 0,
          total_amount: body.totalAmount || 0,
          amount_paid: body.amountPaid || 0,
          due_at: body.dueAt || null,
          issued_at: body.issuedAt || null,
          paid_at: body.paidAt || null,
          notes: body.notes || null,
          created_by: auth.userId,
          updated_by: auth.userId,
        })
        .select('*')
        .single();

      if (error) throw new Error(error.message);

      await writeAuditLog(supabase, {
        userId: auth.userId,
        action: 'create',
        module: 'billing',
        entityType: 'billing_record',
        entityId: data.id,
      });

      return res.status(201).json({ record: data });
    }

    if (req.method === 'PATCH') {
      if (!hasPermission(auth, 'billing', 'write')) return forbidden(res);
      const body = req.body as {
        id?: string;
        status?: string;
        dueAt?: string | null;
        issuedAt?: string | null;
        paidAt?: string | null;
        amountPaid?: number;
        subtotalAmount?: number;
        taxAmount?: number;
        totalAmount?: number;
        notes?: string | null;
      };

      if (!body.id) return badRequest(res, 'id is required');
      if (body.status && !allowedBillingStatuses.has(body.status)) {
        return badRequest(res, 'Invalid billing status');
      }

      const updates: Record<string, unknown> = { updated_by: auth.userId };
      if (typeof body.status !== 'undefined') updates.status = body.status;
      if (typeof body.dueAt !== 'undefined') updates.due_at = body.dueAt || null;
      if (typeof body.issuedAt !== 'undefined') updates.issued_at = body.issuedAt || null;
      if (typeof body.paidAt !== 'undefined') updates.paid_at = body.paidAt || null;
      if (typeof body.amountPaid === 'number') updates.amount_paid = body.amountPaid;
      if (typeof body.subtotalAmount === 'number') updates.subtotal_amount = body.subtotalAmount;
      if (typeof body.taxAmount === 'number') updates.tax_amount = body.taxAmount;
      if (typeof body.totalAmount === 'number') updates.total_amount = body.totalAmount;
      if (typeof body.notes !== 'undefined') updates.notes = body.notes || null;

      const { data, error } = await supabase
        .from('billing_records')
        .update(updates)
        .eq('id', body.id)
        .select('*')
        .single();

      if (error) throw new Error(error.message);

      await writeAuditLog(supabase, {
        userId: auth.userId,
        action: 'update',
        module: 'billing',
        entityType: 'billing_record',
        entityId: body.id,
        details: updates,
      });

      return res.status(200).json({ record: data });
    }

    return methodNotAllowed(res);
  } catch (error) {
    return serverError(res, error);
  }
}

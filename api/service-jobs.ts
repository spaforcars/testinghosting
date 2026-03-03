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
      if (!hasPermission(auth, 'services', 'read')) return forbidden(res);
      const { data, error } = await supabase
        .from('service_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return res.status(200).json({ serviceJobs: data || [] });
    }

    if (req.method === 'POST') {
      if (!hasPermission(auth, 'services', 'write')) return forbidden(res);
      const body = req.body as {
        leadId?: string;
        clientName?: string;
        serviceType?: string;
        status?: string;
        scheduledAt?: string;
      };
      if (!body.clientName || !body.serviceType) {
        return badRequest(res, 'clientName and serviceType are required');
      }

      const { data, error } = await supabase
        .from('service_jobs')
        .insert({
          lead_id: body.leadId || null,
          client_name: body.clientName,
          service_type: body.serviceType,
          status: body.status || 'booked',
          scheduled_at: body.scheduledAt || null,
        })
        .select('*')
        .single();
      if (error) throw new Error(error.message);

      await writeAuditLog(supabase, {
        userId: auth.userId,
        action: 'create',
        module: 'services',
        entityType: 'service_job',
        entityId: data.id,
      });

      return res.status(201).json({ serviceJob: data });
    }

    if (req.method === 'PATCH') {
      if (!hasPermission(auth, 'services', 'write')) return forbidden(res);
      const body = req.body as { id?: string; status?: string };
      if (!body.id || !body.status) return badRequest(res, 'id and status are required');

      const { data, error } = await supabase
        .from('service_jobs')
        .update({ status: body.status })
        .eq('id', body.id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);

      await writeAuditLog(supabase, {
        userId: auth.userId,
        action: 'update_status',
        module: 'services',
        entityType: 'service_job',
        entityId: body.id,
        details: { status: body.status },
      });

      return res.status(200).json({ serviceJob: data });
    }

    return methodNotAllowed(res);
  } catch (error) {
    return serverError(res, error);
  }
}

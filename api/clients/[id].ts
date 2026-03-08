import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../_lib/auth';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { badRequest, forbidden, methodNotAllowed, serverError, unauthorized } from '../_lib/http';
import { writeAuditLog } from '../_lib/audit';
import { isFeatureEnabled } from '../_lib/featureFlags';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);

    const opsEnabled = await isFeatureEnabled(supabase, 'ops_v1_enabled', true);
    if (!opsEnabled) return forbidden(res);

    const clientId = String(req.query.id || '');
    if (!clientId) return badRequest(res, 'client id is required');

    if (req.method === 'GET') {
      if (!hasPermission(auth, 'clients', 'read')) return forbidden(res);

      const [
        clientResult,
        vehiclesResult,
        jobsResult,
        leadsResult,
        timelineResult,
        billingResult,
      ] = await Promise.all([
        supabase.from('clients').select('*').eq('id', clientId).maybeSingle(),
        supabase
          .from('customer_vehicles')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false }),
        supabase
          .from('service_jobs')
          .select('*')
          .eq('client_id', clientId)
          .order('scheduled_at', { ascending: false, nullsFirst: false })
          .limit(150),
        supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(150),
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
      ]);

      if (clientResult.error) throw new Error(clientResult.error.message);
      if (!clientResult.data) return badRequest(res, 'Client not found');
      if (vehiclesResult.error) throw new Error(vehiclesResult.error.message);
      if (jobsResult.error) throw new Error(jobsResult.error.message);
      if (leadsResult.error) throw new Error(leadsResult.error.message);
      if (timelineResult.error) throw new Error(timelineResult.error.message);
      if (billingResult.error) throw new Error(billingResult.error.message);

      const linkedLeadIds = new Set((jobsResult.data || []).map((job) => job.lead_id).filter(Boolean));
      const relatedLeads = (leadsResult.data || []).filter((lead) => linkedLeadIds.has(lead.id));

      return res.status(200).json({
        client: clientResult.data,
        vehicles: vehiclesResult.data || [],
        serviceJobs: jobsResult.data || [],
        leads: relatedLeads,
        timelineEvents: timelineResult.data || [],
        billingRecords: billingResult.data || [],
      });
    }

    if (req.method === 'PATCH') {
      if (!hasPermission(auth, 'clients', 'write')) return forbidden(res);

      const body = req.body as {
        name?: string;
        companyName?: string | null;
        email?: string | null;
        phone?: string | null;
        alternatePhone?: string | null;
        addressLine1?: string | null;
        addressLine2?: string | null;
        city?: string | null;
        province?: string | null;
        postalCode?: string | null;
        country?: string | null;
        tags?: string[];
        notes?: string | null;
        assigneeId?: string | null;
        archived?: boolean;
      };

      const updates: Record<string, unknown> = {};
      if (typeof body.name !== 'undefined') updates.name = body.name;
      if (typeof body.companyName !== 'undefined') updates.company_name = body.companyName || null;
      if (typeof body.email !== 'undefined') updates.email = body.email || null;
      if (typeof body.phone !== 'undefined') updates.phone = body.phone || null;
      if (typeof body.alternatePhone !== 'undefined') updates.alternate_phone = body.alternatePhone || null;
      if (typeof body.addressLine1 !== 'undefined') updates.address_line1 = body.addressLine1 || null;
      if (typeof body.addressLine2 !== 'undefined') updates.address_line2 = body.addressLine2 || null;
      if (typeof body.city !== 'undefined') updates.city = body.city || null;
      if (typeof body.province !== 'undefined') updates.province = body.province || null;
      if (typeof body.postalCode !== 'undefined') updates.postal_code = body.postalCode || null;
      if (typeof body.country !== 'undefined') updates.country = body.country || null;
      if (typeof body.tags !== 'undefined') updates.tags = Array.isArray(body.tags) ? body.tags : [];
      if (typeof body.notes !== 'undefined') updates.notes = body.notes || null;
      if (typeof body.assigneeId !== 'undefined') updates.assignee_id = body.assigneeId || null;
      if (typeof body.archived === 'boolean') updates.archived = body.archived;

      if (!Object.keys(updates).length) return badRequest(res, 'No updates provided');

      const { data, error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', clientId)
        .select('*')
        .single();

      if (error) throw new Error(error.message);

      await writeAuditLog(supabase, {
        userId: auth.userId,
        action: 'update',
        module: 'clients',
        entityType: 'client',
        entityId: clientId,
        details: updates,
      });

      return res.status(200).json({ client: data });
    }

    return methodNotAllowed(res);
  } catch (error) {
    return serverError(res, error);
  }
}

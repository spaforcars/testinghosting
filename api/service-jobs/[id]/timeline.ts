import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../../_lib/auth';
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin';
import { badRequest, forbidden, methodNotAllowed, serverError, unauthorized } from '../../_lib/http';
import { writeAuditLog } from '../../_lib/audit';
import { isFeatureEnabled } from '../../_lib/featureFlags';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);

    const opsEnabled = await isFeatureEnabled(supabase, 'ops_v1_enabled', true);
    if (!opsEnabled) return forbidden(res);

    const serviceJobId = String(req.query.id || '');
    if (!serviceJobId) return badRequest(res, 'service job id is required');

    if (req.method === 'GET') {
      if (!hasPermission(auth, 'services', 'read')) return forbidden(res);

      const { data, error } = await supabase
        .from('job_timeline_events')
        .select('*')
        .eq('service_job_id', serviceJobId)
        .order('created_at', { ascending: false })
        .limit(300);

      if (error) throw new Error(error.message);
      return res.status(200).json({ events: data || [] });
    }

    if (req.method === 'POST') {
      if (!hasPermission(auth, 'services', 'write')) return forbidden(res);
      const body = req.body as {
        eventType?: string;
        note?: string;
        leadId?: string | null;
        clientId?: string | null;
        metadata?: Record<string, unknown>;
      };

      const { data, error } = await supabase
        .from('job_timeline_events')
        .insert({
          service_job_id: serviceJobId,
          lead_id: body.leadId || null,
          client_id: body.clientId || null,
          event_type: body.eventType || 'note',
          note: body.note || null,
          metadata: body.metadata || {},
          created_by: auth.userId,
        })
        .select('*')
        .single();

      if (error) throw new Error(error.message);

      await writeAuditLog(supabase, {
        userId: auth.userId,
        action: 'create_timeline_event',
        module: 'services',
        entityType: 'service_job',
        entityId: serviceJobId,
        details: {
          eventType: body.eventType || 'note',
        },
      });

      return res.status(201).json({ event: data });
    }

    return methodNotAllowed(res);
  } catch (error) {
    return serverError(res, error);
  }
}

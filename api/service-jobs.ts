import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from './_lib/auth';
import { getSupabaseAdmin } from './_lib/supabaseAdmin';
import { badRequest, forbidden, methodNotAllowed, serverError, unauthorized } from './_lib/http';
import { writeAuditLog } from './_lib/audit';
import { createInAppNotification } from './_lib/inAppNotifications';
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
      if (!hasPermission(auth, 'services', 'read')) return forbidden(res);

      const { page, pageSize, offset, to } = normalizePagination(req);
      let query = supabase
        .from('service_jobs')
        .select('*', { count: 'exact' })
        .order('scheduled_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (req.query.status) query = query.eq('status', String(req.query.status));
      if (req.query.assigneeId) query = query.eq('assignee_id', String(req.query.assigneeId));
      if (req.query.clientId) query = query.eq('client_id', String(req.query.clientId));
      if (req.query.leadId) query = query.eq('lead_id', String(req.query.leadId));
      if (req.query.scheduledFrom) {
        const parsed = new Date(String(req.query.scheduledFrom));
        if (!Number.isNaN(parsed.getTime())) query = query.gte('scheduled_at', parsed.toISOString());
      }
      if (req.query.scheduledTo) {
        const parsed = new Date(String(req.query.scheduledTo));
        if (!Number.isNaN(parsed.getTime())) query = query.lte('scheduled_at', parsed.toISOString());
      }
      if (req.query.search) {
        const term = String(req.query.search).trim();
        if (term) {
          const escaped = term.replace(/,/g, ' ').replace(/%/g, '');
          query = query.or(
            `client_name.ilike.%${escaped}%,service_type.ilike.%${escaped}%,notes.ilike.%${escaped}%`
          );
        }
      }

      const { data, error, count } = await query.range(offset, to);
      if (error) throw new Error(error.message);

      const total = count || 0;
      const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;

      return res.status(200).json({
        serviceJobs: data || [],
        pagination: { page, pageSize, total, totalPages },
      });
    }

    if (req.method === 'POST') {
      if (!hasPermission(auth, 'services', 'write')) return forbidden(res);
      const body = req.body as {
        leadId?: string;
        clientId?: string;
        clientName?: string;
        serviceType?: string;
        status?: string;
        scheduledAt?: string | null;
        assigneeId?: string | null;
        notes?: string | null;
      };
      if (!body.clientName || !body.serviceType) {
        return badRequest(res, 'clientName and serviceType are required');
      }

      const { data, error } = await supabase
        .from('service_jobs')
        .insert({
          lead_id: body.leadId || null,
          client_id: body.clientId || null,
          client_name: body.clientName,
          service_type: body.serviceType,
          status: body.status || 'booked',
          scheduled_at: body.scheduledAt || null,
          assignee_id: body.assigneeId || null,
          notes: body.notes || null,
        })
        .select('*')
        .single();
      if (error) throw new Error(error.message);

      await supabase.from('job_timeline_events').insert({
        service_job_id: data.id,
        lead_id: data.lead_id,
        client_id: data.client_id,
        event_type: 'job_created',
        note: 'Service job created',
        metadata: {
          status: data.status,
          scheduledAt: data.scheduled_at,
        },
        created_by: auth.userId,
      });

      await writeAuditLog(supabase, {
        userId: auth.userId,
        action: 'create',
        module: 'services',
        entityType: 'service_job',
        entityId: data.id,
      });

      if (data.assignee_id) {
        await createInAppNotification(supabase, data.assignee_id, {
          category: 'service_job',
          title: 'New service job assigned',
          message: `${data.client_name} | ${data.service_type}`,
          entityType: 'service_job',
          entityId: data.id,
          metadata: {
            status: data.status,
          },
        });
      }

      return res.status(201).json({ serviceJob: data });
    }

    if (req.method === 'PATCH') {
      if (!hasPermission(auth, 'services', 'write')) return forbidden(res);
      const body = req.body as {
        id?: string;
        status?: string;
        scheduledAt?: string | null;
        assigneeId?: string | null;
        notes?: string | null;
        serviceType?: string;
        clientName?: string;
        clientId?: string | null;
      };
      if (!body.id) return badRequest(res, 'id is required');

      const { data: previousJob } = await supabase
        .from('service_jobs')
        .select('*')
        .eq('id', body.id)
        .maybeSingle();
      if (!previousJob) return badRequest(res, 'Service job not found');

      const updates: Record<string, unknown> = {};
      if (body.status) updates.status = body.status;
      if (typeof body.scheduledAt !== 'undefined') updates.scheduled_at = body.scheduledAt || null;
      if (typeof body.assigneeId !== 'undefined') updates.assignee_id = body.assigneeId || null;
      if (typeof body.notes !== 'undefined') updates.notes = body.notes || null;
      if (typeof body.serviceType !== 'undefined') updates.service_type = body.serviceType;
      if (typeof body.clientName !== 'undefined') updates.client_name = body.clientName;
      if (typeof body.clientId !== 'undefined') updates.client_id = body.clientId || null;

      if (!Object.keys(updates).length) return badRequest(res, 'No updates provided');

      const { data, error } = await supabase
        .from('service_jobs')
        .update(updates)
        .eq('id', body.id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);

      const metadata: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        metadata[key] = {
          from: (previousJob as Record<string, unknown>)[key],
          to: value,
        };
      }

      await supabase.from('job_timeline_events').insert({
        service_job_id: data.id,
        lead_id: data.lead_id,
        client_id: data.client_id,
        event_type: 'job_updated',
        note: 'Service job updated',
        metadata,
        created_by: auth.userId,
      });

      await writeAuditLog(supabase, {
        userId: auth.userId,
        action: 'update',
        module: 'services',
        entityType: 'service_job',
        entityId: body.id,
        details: updates,
      });

      if (
        typeof body.assigneeId !== 'undefined' &&
        body.assigneeId &&
        body.assigneeId !== previousJob.assignee_id
      ) {
        await createInAppNotification(supabase, body.assigneeId, {
          category: 'service_job',
          title: 'Service job assigned',
          message: `${data.client_name} | ${data.service_type}`,
          entityType: 'service_job',
          entityId: data.id,
          metadata: {
            status: data.status,
            scheduledAt: data.scheduled_at,
          },
        });
      }

      return res.status(200).json({ serviceJob: data });
    }

    return methodNotAllowed(res);
  } catch (error) {
    return serverError(res, error);
  }
}

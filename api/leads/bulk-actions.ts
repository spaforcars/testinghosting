import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../_lib/auth';
import { writeAuditLog } from '../_lib/audit';
import { isFeatureEnabled } from '../_lib/featureFlags';
import { badRequest, forbidden, methodNotAllowed, serverError, unauthorized } from '../_lib/http';
import { createInAppNotification } from '../_lib/inAppNotifications';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';

const allowedLeadStatuses = new Set([
  'lead',
  'contacted',
  'quoted',
  'booked',
  'in_service',
  'completed',
  'closed_lost',
]);

const readRecord = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);
    if (!hasPermission(auth, 'leads', 'write')) return forbidden(res);

    const opsEnabled = await isFeatureEnabled(supabase, 'ops_v1_enabled', true);
    if (!opsEnabled) return forbidden(res);

    const body = req.body as {
      ids?: string[];
      action?: 'assign' | 'set_status' | 'mark_reviewed';
      assigneeId?: string | null;
      status?: string;
    };

    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];
    if (!ids.length) return badRequest(res, 'At least one lead id is required');
    if (!body.action) return badRequest(res, 'action is required');

    const { data: currentLeads, error: leadsError } = await supabase.from('leads').select('*').in('id', ids);
    if (leadsError) throw new Error(leadsError.message);
    const leads = currentLeads || [];
    if (!leads.length) return badRequest(res, 'No matching leads found');

    if (body.action === 'set_status' && (!body.status || !allowedLeadStatuses.has(body.status))) {
      return badRequest(res, 'A valid internal lead status is required');
    }

    const updated: Array<Record<string, unknown>> = [];
    for (const lead of leads) {
      let updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (body.action === 'assign') {
        updates.assignee_id = body.assigneeId || null;
      } else if (body.action === 'set_status') {
        updates.status = body.status;
      } else if (body.action === 'mark_reviewed') {
        const intakeMetadata = readRecord(lead.intake_metadata);
        updates.intake_metadata = {
          ...intakeMetadata,
          dashboardReview: {
            ...readRecord(intakeMetadata.dashboardReview),
            reviewedAt: new Date().toISOString(),
            reviewedBy: auth.userId,
          },
        };
      }

      const { data, error } = await supabase.from('leads').update(updates).eq('id', lead.id).select('*').single();
      if (error) throw new Error(error.message);

      if (body.action === 'assign' && body.assigneeId && body.assigneeId !== lead.assignee_id) {
        await createInAppNotification(supabase, body.assigneeId, {
          category: 'lead',
          title: 'Lead assigned',
          message: `${lead.name} | ${lead.service_type || 'Lead queue'}`,
          entityType: 'lead',
          entityId: lead.id,
          metadata: { status: data.status },
        });
      }

      await writeAuditLog(supabase, {
        userId: auth.userId,
        action: `bulk_${body.action}`,
        module: 'leads',
        entityType: 'lead',
        entityId: lead.id,
        details:
          body.action === 'assign'
            ? { assignee_id: body.assigneeId || null }
            : body.action === 'set_status'
              ? { status: body.status }
              : { reviewed_at: (updates.intake_metadata as Record<string, unknown>)?.dashboardReview },
      });

      updated.push(data);
    }

    return res.status(200).json({ success: true, updatedCount: updated.length, leads: updated });
  } catch (error) {
    return serverError(res, error);
  }
}

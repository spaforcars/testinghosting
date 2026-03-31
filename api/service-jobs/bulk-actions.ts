import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../_lib/auth';
import { writeAuditLog } from '../_lib/audit';
import { getBookingServiceSelection, getBookingSettings, getScheduledEndAt } from '../_lib/booking';
import { mapJobUiStatusToInternal } from '../_lib/dashboardStatus';
import { isFeatureEnabled } from '../_lib/featureFlags';
import { badRequest, forbidden, methodNotAllowed, serverError, unauthorized } from '../_lib/http';
import { createInAppNotification } from '../_lib/inAppNotifications';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';

const isMissingColumnError = (message: string, column: string) =>
  message.includes(`Could not find the '${column}' column`) ||
  new RegExp(`column\\s+(?:[a-z0-9_]+\\.)?${column}\\s+does not exist`, 'i').test(message);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);
    if (!hasPermission(auth, 'services', 'write')) return forbidden(res);

    const opsEnabled = await isFeatureEnabled(supabase, 'ops_v1_enabled', true);
    if (!opsEnabled) return forbidden(res);

    const body = req.body as {
      ids?: string[];
      action?: 'assign' | 'set_status' | 'set_payment_status';
      assigneeId?: string | null;
      status?: string;
      paymentStatus?: 'paid' | 'unpaid';
    };

    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];
    if (!ids.length) return badRequest(res, 'At least one service job id is required');
    if (!body.action) return badRequest(res, 'action is required');

    const { data: currentJobs, error: jobsError } = await supabase.from('service_jobs').select('*').in('id', ids);
    if (jobsError) throw new Error(jobsError.message);
    const jobs = currentJobs || [];
    if (!jobs.length) return badRequest(res, 'No matching service jobs found');

    if (body.action === 'set_payment_status' && body.paymentStatus !== 'paid' && body.paymentStatus !== 'unpaid') {
      return badRequest(res, 'paymentStatus must be paid or unpaid');
    }

    const bookingSettings = await getBookingSettings(supabase);
    const updated: Array<Record<string, unknown>> = [];
    for (const job of jobs) {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (body.action === 'assign') {
        updates.assignee_id = body.assigneeId || null;
      } else if (body.action === 'set_status') {
        const internalStatus = mapJobUiStatusToInternal(body.status || '')[0] || body.status || job.status;
        updates.status = internalStatus;
        updates.completed_at = internalStatus === 'completed' ? new Date().toISOString() : null;
      } else if (body.action === 'set_payment_status') {
        updates.payment_status = body.paymentStatus;
      }

      // Keep end time coherent if status reopen touches a scheduled booking.
      if (typeof updates.status !== 'undefined' && job.scheduled_at && job.service_catalog_id) {
        const selection = await getBookingServiceSelection(job.service_catalog_id, job.service_addon_ids || []);
        updates.scheduled_end_at = getScheduledEndAt(
          job.scheduled_at,
          selection?.primaryService || null,
          selection?.addOns || [],
          bookingSettings
        );
      }

      let result = await supabase.from('service_jobs').update(updates).eq('id', job.id).select('*').single();
      if (result.error && isMissingColumnError(result.error.message, 'payment_status') && 'payment_status' in updates) {
        const { payment_status, ...legacyUpdates } = updates;
        result = await supabase.from('service_jobs').update(legacyUpdates).eq('id', job.id).select('*').single();
      }
      if (result.error) throw new Error(result.error.message);

      await supabase.from('job_timeline_events').insert({
        service_job_id: job.id,
        lead_id: job.lead_id,
        client_id: job.client_id,
        event_type: `bulk_${body.action}`,
        note:
          body.action === 'assign'
            ? 'Assignee updated in bulk'
            : body.action === 'set_status'
              ? 'Status updated in bulk'
              : 'Payment status updated in bulk',
        metadata: updates,
        created_by: auth.userId,
      });

      await writeAuditLog(supabase, {
        userId: auth.userId,
        action: `bulk_${body.action}`,
        module: 'services',
        entityType: 'service_job',
        entityId: job.id,
        details: updates,
      });

      if (body.action === 'assign' && body.assigneeId && body.assigneeId !== job.assignee_id) {
        await createInAppNotification(supabase, body.assigneeId, {
          category: 'service_job',
          title: 'Service job assigned',
          message: `${job.client_name} | ${job.service_type}`,
          entityType: 'service_job',
          entityId: job.id,
          metadata: {
            status: result.data?.status || job.status,
            scheduledAt: result.data?.scheduled_at || job.scheduled_at,
          },
        });
      }

      updated.push(result.data);
    }

    return res.status(200).json({ success: true, updatedCount: updated.length, serviceJobs: updated });
  } catch (error) {
    return serverError(res, error);
  }
}

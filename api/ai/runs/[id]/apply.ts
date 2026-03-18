import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../../../_lib/auth';
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin';
import { badRequest, forbidden, methodNotAllowed, readRouteId, serverError, unauthorized } from '../../../_lib/http';
import { writeAuditLog } from '../../../_lib/audit';
import { applyAiRunSuggestion, getAiRunById } from '../../../_lib/ai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);

    const runId = readRouteId(req, 1);
    if (!runId) return badRequest(res, 'run id is required');

    const run = await getAiRunById(supabase, runId);
    if (!run) return badRequest(res, 'AI run not found');

    if (run.entity_type === 'lead' && !hasPermission(auth, 'leads', 'write')) return forbidden(res);
    if (run.entity_type === 'service_job' && !hasPermission(auth, 'services', 'write')) return forbidden(res);
    if (run.entity_type === 'report') return forbidden(res);

    const actionIndex = Number(req.body?.actionIndex || 0);
    const result = await applyAiRunSuggestion(supabase, run, Number.isFinite(actionIndex) ? actionIndex : 0);

    await writeAuditLog(supabase, {
      userId: auth.userId,
      action: 'apply_ai_run',
      module: run.entity_type === 'lead' ? 'leads' : 'services',
      entityType: 'ai_run',
      entityId: runId,
      details: {
        targetEntityType: run.entity_type,
        targetEntityId: run.entity_id,
        action: result.action,
      },
    });

    return res.status(200).json({
      runId,
      action: result.action,
      entity: result.entity,
    });
  } catch (error) {
    return serverError(res, error);
  }
}


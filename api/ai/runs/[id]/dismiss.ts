import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../../../_lib/auth';
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin';
import { badRequest, forbidden, methodNotAllowed, readRouteId, serverError, unauthorized } from '../../../_lib/http';
import { writeAuditLog } from '../../../_lib/audit';
import { dismissAiRun, getAiRunById } from '../../../_lib/ai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);
    if (!hasPermission(auth, 'notifications', 'write')) return forbidden(res);

    const runId = readRouteId(req, 1);
    if (!runId) return badRequest(res, 'run id is required');

    const run = await getAiRunById(supabase, runId);
    if (!run) return badRequest(res, 'AI run not found');

    await dismissAiRun(supabase, run);

    await writeAuditLog(supabase, {
      userId: auth.userId,
      action: 'dismiss_ai_run',
      module: 'notifications',
      entityType: 'ai_run',
      entityId: runId,
      details: {
        targetEntityType: run.entity_type,
        targetEntityId: run.entity_id,
      },
    });

    return res.status(200).json({ success: true, runId });
  } catch (error) {
    return serverError(res, error);
  }
}

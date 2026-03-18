import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../../../_lib/auth';
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin';
import { badRequest, forbidden, methodNotAllowed, readRouteId, serverError, unauthorized } from '../../../_lib/http';
import { isFeatureEnabled } from '../../../_lib/featureFlags';
import { writeAuditLog } from '../../../_lib/audit';
import { buildLeadReplyDraftSuggestion } from '../../../_lib/ai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);
    if (!hasPermission(auth, 'leads', 'read')) return forbidden(res);

    const opsEnabled = await isFeatureEnabled(supabase, 'ops_v1_enabled', true);
    if (!opsEnabled) return forbidden(res);

    const leadId = readRouteId(req, 1);
    if (!leadId) return badRequest(res, 'lead id is required');

    const suggestion = await buildLeadReplyDraftSuggestion(supabase, leadId, auth.userId);

    await writeAuditLog(supabase, {
      userId: auth.userId,
      action: 'generate_ai_reply_draft',
      module: 'leads',
      entityType: 'lead',
      entityId: leadId,
      details: {
        runId: suggestion.runId,
        status: suggestion.status,
      },
    });

    return res.status(200).json({ suggestion });
  } catch (error) {
    return serverError(res, error);
  }
}


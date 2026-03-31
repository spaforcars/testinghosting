import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../../../_lib/auth';
import { buildCustomerWorkspaceBriefSuggestion } from '../../../_lib/ai';
import { writeAuditLog } from '../../../_lib/audit';
import { isFeatureEnabled } from '../../../_lib/featureFlags';
import { badRequest, forbidden, methodNotAllowed, readRouteId, serverError, unauthorized } from '../../../_lib/http';
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);
    if (!hasPermission(auth, 'clients', 'read')) return forbidden(res);

    const opsEnabled = await isFeatureEnabled(supabase, 'ops_v1_enabled', true);
    if (!opsEnabled) return forbidden(res);

    const clientId = readRouteId(req, 1);
    if (!clientId) return badRequest(res, 'client id is required');

    const suggestion = await buildCustomerWorkspaceBriefSuggestion(supabase, clientId, auth.userId);

    await writeAuditLog(supabase, {
      userId: auth.userId,
      action: 'generate_customer_ai_brief',
      module: 'clients',
      entityType: 'customer',
      entityId: clientId,
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

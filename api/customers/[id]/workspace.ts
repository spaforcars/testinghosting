import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../../_lib/auth';
import { getCustomerWorkspaceContext } from '../../_lib/customerWorkspace';
import { isFeatureEnabled } from '../../_lib/featureFlags';
import { badRequest, forbidden, methodNotAllowed, readRouteId, serverError, unauthorized } from '../../_lib/http';
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);
    if (!hasPermission(auth, 'clients', 'read')) return forbidden(res);

    const opsEnabled = await isFeatureEnabled(supabase, 'ops_v1_enabled', true);
    if (!opsEnabled) return forbidden(res);

    const clientId = readRouteId(req, 1);
    if (!clientId) return badRequest(res, 'client id is required');

    const workspace = await getCustomerWorkspaceContext(supabase, clientId);
    return res.status(200).json(workspace);
  } catch (error) {
    return serverError(res, error);
  }
}

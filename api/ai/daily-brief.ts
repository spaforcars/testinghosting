import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../_lib/auth';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { forbidden, methodNotAllowed, serverError, unauthorized } from '../_lib/http';
import { isFeatureEnabled } from '../_lib/featureFlags';
import { writeAuditLog } from '../_lib/audit';
import { buildDailyBriefSuggestion } from '../_lib/ai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);
    if (!hasPermission(auth, 'reports', 'read')) return forbidden(res);

    const opsEnabled = await isFeatureEnabled(supabase, 'ops_v1_enabled', true);
    if (!opsEnabled) return forbidden(res);

    const scope = req.body?.scope === 'weekly' ? 'weekly' : 'daily';
    const suggestion = await buildDailyBriefSuggestion(supabase, {
      scope,
      userId: auth.userId,
    });

    await writeAuditLog(supabase, {
      userId: auth.userId,
      action: 'generate_ai_brief',
      module: 'reports',
      entityType: 'ai_run',
      entityId: suggestion.runId,
      details: {
        feature: suggestion.feature,
        scope,
        status: suggestion.status,
      },
    });

    return res.status(200).json({ suggestion });
  } catch (error) {
    return serverError(res, error);
  }
}


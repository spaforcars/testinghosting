import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../_lib/auth';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { forbidden, methodNotAllowed, serverError, unauthorized } from '../_lib/http';
import { isFeatureEnabled } from '../_lib/featureFlags';
import { listAiRuns } from '../_lib/ai';

const isMissingTableError = (message: string, table: string) =>
  message.includes(`Could not find the table 'public.${table}'`) ||
  new RegExp(`relation ["']?public\\.${table}["']? does not exist`, 'i').test(message);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);
    if (!hasPermission(auth, 'notifications', 'read')) return forbidden(res);

    const opsEnabled = await isFeatureEnabled(supabase, 'ops_v1_enabled', true);
    if (!opsEnabled) return forbidden(res);

    const rawLimit = Number(req.query.limit || 20);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20;

    let runs = [] as Awaited<ReturnType<typeof listAiRuns>>;
    try {
      runs = await listAiRuns(supabase, {
        limit,
        entityType: typeof req.query.entityType === 'string' ? (req.query.entityType as any) : null,
        status: typeof req.query.status === 'string' ? (req.query.status as any) : null,
        feature: typeof req.query.feature === 'string' ? (req.query.feature as any) : null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!isMissingTableError(message, 'ai_runs')) {
        throw error;
      }
    }

    return res.status(200).json({ runs });
  } catch (error) {
    return serverError(res, error);
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../../../_lib/auth';
import { buildCustomerMessageDraftSuggestion } from '../../../_lib/ai';
import { writeAuditLog } from '../../../_lib/audit';
import { isFeatureEnabled } from '../../../_lib/featureFlags';
import { badRequest, forbidden, methodNotAllowed, readRouteId, serverError, unauthorized } from '../../../_lib/http';
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin';
import type { AiDraft } from '../../../../types/ai';

const isDraftChannel = (value: unknown): value is AiDraft['channel'] =>
  value === 'email' || value === 'sms' || value === 'whatsapp' || value === 'internal';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);
    if (!hasPermission(auth, 'clients', 'read')) return forbidden(res);

    const opsEnabled = await isFeatureEnabled(supabase, 'ops_v1_enabled', true);
    if (!opsEnabled) return forbidden(res);

    const clientId = readRouteId(req, 2);
    if (!clientId) return badRequest(res, 'client id is required');

    const body = (req.body || {}) as {
      intent?: string;
      channel?: AiDraft['channel'];
    };

    const intent = typeof body.intent === 'string' && body.intent.trim() ? body.intent.trim() : 'general_follow_up';
    const channel = isDraftChannel(body.channel) ? body.channel : 'email';

    const suggestion = await buildCustomerMessageDraftSuggestion(supabase, clientId, {
      intent,
      channel,
      userId: auth.userId,
    });

    await writeAuditLog(supabase, {
      userId: auth.userId,
      action: 'generate_customer_message_draft',
      module: 'clients',
      entityType: 'customer',
      entityId: clientId,
      details: {
        runId: suggestion.runId,
        intent,
        channel,
        status: suggestion.status,
      },
    });

    return res.status(200).json({ suggestion });
  } catch (error) {
    return serverError(res, error);
  }
}

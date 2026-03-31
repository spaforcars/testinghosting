import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../../../_lib/auth';
import { writeAuditLog } from '../../../_lib/audit';
import { isFeatureEnabled } from '../../../_lib/featureFlags';
import { badRequest, forbidden, methodNotAllowed, readRouteId, serverError, unauthorized } from '../../../_lib/http';
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin';

const isDirection = (value: unknown): value is 'outbound' | 'inbound' =>
  value === 'outbound' || value === 'inbound';

const isMessageStatus = (value: unknown): value is 'drafted' | 'copied' | 'sent' | 'logged' =>
  value === 'drafted' || value === 'copied' || value === 'sent' || value === 'logged';

const isChannel = (value: unknown): value is 'email' | 'sms' | 'whatsapp' | 'internal' =>
  value === 'email' || value === 'sms' || value === 'whatsapp' || value === 'internal';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);
    if (!hasPermission(auth, 'clients', 'write')) return forbidden(res);

    const opsEnabled = await isFeatureEnabled(supabase, 'ops_v1_enabled', true);
    if (!opsEnabled) return forbidden(res);

    const clientId = readRouteId(req, 2);
    if (!clientId) return badRequest(res, 'client id is required');

    const body = (req.body || {}) as {
      channel?: 'email' | 'sms' | 'whatsapp' | 'internal';
      subject?: string;
      body?: string;
      recipient?: string;
      intent?: string;
      status?: 'drafted' | 'copied' | 'sent' | 'logged';
      direction?: 'outbound' | 'inbound';
      templateId?: string;
    };

    if (typeof body.body !== 'string' || !body.body.trim()) {
      return badRequest(res, 'message body is required');
    }

    const channel = isChannel(body.channel) ? body.channel : 'internal';
    const status = isMessageStatus(body.status) ? body.status : 'logged';
    const direction = isDirection(body.direction) ? body.direction : 'outbound';

    await writeAuditLog(supabase, {
      userId: auth.userId,
      action: `message_${status}`,
      module: 'clients',
      entityType: 'client_message',
      entityId: clientId,
      details: {
        channel,
        subject: body.subject || null,
        body: body.body.trim(),
        recipient: body.recipient || null,
        intent: body.intent || null,
        status,
        direction,
        templateId: body.templateId || null,
      },
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    return serverError(res, error);
  }
}

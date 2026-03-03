import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../_lib/auth';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { badRequest, forbidden, methodNotAllowed, serverError, unauthorized } from '../_lib/http';
import { writeAuditLog } from '../_lib/audit';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') return methodNotAllowed(res);

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);
    if (!hasPermission(auth, 'leads', 'write')) return forbidden(res);

    const id = String(req.query.id || '');
    const { status, assigneeId } = req.body as { status?: string; assigneeId?: string | null };
    if (!id || !status) return badRequest(res, 'id and status are required');

    const { data, error } = await supabase
      .from('leads')
      .update({
        status,
        assignee_id: assigneeId || null,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    await writeAuditLog(supabase, {
      userId: auth.userId,
      action: 'update_status',
      module: 'leads',
      entityType: 'lead',
      entityId: id,
      details: { status, assigneeId: assigneeId || null },
    });

    return res.status(200).json({ lead: data });
  } catch (error) {
    return serverError(res, error);
  }
}

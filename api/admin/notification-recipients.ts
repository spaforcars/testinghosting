import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../_lib/auth';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { badRequest, forbidden, methodNotAllowed, serverError, unauthorized } from '../_lib/http';
import { writeAuditLog } from '../_lib/audit';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);
    if (!hasPermission(auth, 'notifications', 'read')) return forbidden(res);

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('admin_notification_recipients')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return res.status(200).json({ recipients: data || [] });
    }

    if (req.method === 'POST') {
      if (!hasPermission(auth, 'notifications', 'write')) return forbidden(res);
      const body = req.body as { email?: string };
      if (!body.email) return badRequest(res, 'email is required');

      const { data, error } = await supabase
        .from('admin_notification_recipients')
        .insert({ email: body.email, enabled: true })
        .select('*')
        .single();
      if (error) throw new Error(error.message);

      await writeAuditLog(supabase, {
        userId: auth.userId,
        action: 'add_recipient',
        module: 'notifications',
        entityType: 'admin_notification_recipient',
        entityId: data.id,
        details: { email: body.email },
      });

      return res.status(201).json({ recipient: data });
    }

    if (req.method === 'PATCH') {
      if (!hasPermission(auth, 'notifications', 'write')) return forbidden(res);
      const body = req.body as { id?: string; enabled?: boolean };
      if (!body.id || typeof body.enabled !== 'boolean') {
        return badRequest(res, 'id and enabled are required');
      }

      const { data, error } = await supabase
        .from('admin_notification_recipients')
        .update({ enabled: body.enabled })
        .eq('id', body.id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);

      await writeAuditLog(supabase, {
        userId: auth.userId,
        action: 'toggle_recipient',
        module: 'notifications',
        entityType: 'admin_notification_recipient',
        entityId: body.id,
        details: { enabled: body.enabled },
      });

      return res.status(200).json({ recipient: data });
    }

    return methodNotAllowed(res);
  } catch (error) {
    return serverError(res, error);
  }
}

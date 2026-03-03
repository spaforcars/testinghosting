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
    if (!hasPermission(auth, 'settings', 'read')) return forbidden(res);

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('key', { ascending: true });
      if (error) throw new Error(error.message);
      return res.status(200).json({ settings: data || [] });
    }

    if (req.method === 'PATCH') {
      if (!hasPermission(auth, 'settings', 'write')) return forbidden(res);
      const body = req.body as { key?: string; value?: unknown };
      if (!body.key) return badRequest(res, 'key is required');

      const { data, error } = await supabase
        .from('system_settings')
        .upsert({
          key: body.key,
          value: body.value ?? null,
          updated_by: auth.userId,
        })
        .select('*')
        .single();
      if (error) throw new Error(error.message);

      await writeAuditLog(supabase, {
        userId: auth.userId,
        action: 'update_setting',
        module: 'settings',
        entityType: 'system_setting',
        entityId: body.key,
        details: { value: body.value ?? null },
      });

      return res.status(200).json({ setting: data });
    }

    return methodNotAllowed(res);
  } catch (error) {
    return serverError(res, error);
  }
}

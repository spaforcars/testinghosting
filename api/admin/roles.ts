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
    if (!hasPermission(auth, 'roles', 'read')) return forbidden(res);

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('role, module, action')
        .order('role', { ascending: true });
      if (error) throw new Error(error.message);
      return res.status(200).json({ rolePermissions: data || [] });
    }

    if (req.method === 'POST') {
      if (!hasPermission(auth, 'roles', 'write')) return forbidden(res);
      const body = req.body as {
        role?: string;
        permissions?: Array<{ module: string; action: string }>;
      };
      if (!body.role || !Array.isArray(body.permissions)) {
        return badRequest(res, 'role and permissions are required');
      }

      await supabase.from('role_permissions').delete().eq('role', body.role);
      const inserts = body.permissions.map((permission) => ({
        role: body.role,
        module: permission.module,
        action: permission.action,
      }));
      const { error } = await supabase.from('role_permissions').insert(inserts);
      if (error) throw new Error(error.message);

      await writeAuditLog(supabase, {
        userId: auth.userId,
        action: 'upsert_permissions',
        module: 'roles',
        entityType: 'role',
        entityId: body.role,
        details: { count: inserts.length },
      });

      return res.status(200).json({ success: true });
    }

    return methodNotAllowed(res);
  } catch (error) {
    return serverError(res, error);
  }
}

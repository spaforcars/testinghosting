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
    if (!hasPermission(auth, 'users', 'read')) return forbidden(res);

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, role, is_active, created_at')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return res.status(200).json({ users: data || [] });
    }

    if (req.method === 'POST') {
      if (!hasPermission(auth, 'users', 'write')) return forbidden(res);
      const body = req.body as {
        userId?: string;
        fullName?: string;
        role?: string;
        isActive?: boolean;
      };
      if (!body.userId || !body.role) return badRequest(res, 'userId and role are required');

      const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
          id: body.userId,
          full_name: body.fullName || null,
          role: body.role,
          is_active: body.isActive ?? true,
        })
        .select('*')
        .single();

      if (error) throw new Error(error.message);

      await writeAuditLog(supabase, {
        userId: auth.userId,
        action: 'upsert',
        module: 'users',
        entityType: 'user_profile',
        entityId: body.userId,
        details: { role: body.role },
      });

      return res.status(200).json({ user: data });
    }

    if (req.method === 'PATCH') {
      if (!hasPermission(auth, 'users', 'write')) return forbidden(res);
      const body = req.body as {
        userId?: string;
        role?: string;
        isActive?: boolean;
      };
      if (!body.userId) return badRequest(res, 'userId is required');

      const updates: Record<string, unknown> = {};
      if (body.role) updates.role = body.role;
      if (typeof body.isActive === 'boolean') updates.is_active = body.isActive;

      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', body.userId)
        .select('*')
        .single();
      if (error) throw new Error(error.message);

      await writeAuditLog(supabase, {
        userId: auth.userId,
        action: 'update',
        module: 'users',
        entityType: 'user_profile',
        entityId: body.userId,
        details: updates,
      });

      return res.status(200).json({ user: data });
    }

    return methodNotAllowed(res);
  } catch (error) {
    return serverError(res, error);
  }
}

import type { VercelRequest } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuthContext {
  userId: string;
  email?: string;
  role: string;
  permissions: Set<string>;
}

const extractToken = (req: VercelRequest): string | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.replace('Bearer ', '').trim();
};

const rolePermissionsFallback: Record<string, string[]> = {
  super_admin: ['*'],
  admin: [
    'dashboard.read',
    'leads.read',
    'leads.write',
    'services.read',
    'services.write',
    'clients.read',
    'clients.write',
    'users.read',
    'roles.read',
    'settings.read',
    'settings.write',
    'notifications.read',
    'notifications.write',
  ],
  staff: [
    'dashboard.read',
    'leads.read',
    'leads.write',
    'services.read',
    'services.write',
    'clients.read',
    'clients.write',
    'notifications.read',
  ],
  client: ['content.read', 'content.write', 'ads.read', 'ads.write', 'dashboard.read', 'leads.read'],
};

const resolveRolePermissions = async (supabase: SupabaseClient, role: string): Promise<Set<string>> => {
  const { data, error } = await supabase
    .from('role_permissions')
    .select('module, action')
    .eq('role', role);

  if (error || !data?.length) {
    return new Set(rolePermissionsFallback[role] || []);
  }

  const permissions = new Set<string>();
  for (const row of data) {
    permissions.add(`${row.module}.${row.action}`);
  }
  return permissions;
};

export const getAuthContext = async (
  req: VercelRequest,
  supabase: SupabaseClient
): Promise<AuthContext | null> => {
  const token = extractToken(req);
  if (!token) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role =
    profile?.role ||
    (typeof user.app_metadata?.role === 'string' ? user.app_metadata.role : undefined) ||
    'staff';

  const permissions = await resolveRolePermissions(supabase, role);

  return {
    userId: user.id,
    email: user.email,
    role,
    permissions,
  };
};

export const hasPermission = (
  auth: AuthContext,
  module: string,
  action: string
): boolean => {
  if (auth.role === 'super_admin') return true;
  if (auth.permissions.has('*')) return true;
  return auth.permissions.has(`${module}.${action}`);
};

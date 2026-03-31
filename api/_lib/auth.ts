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
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) return authHeader.replace('Bearer ', '').trim();
    if (authHeader.trim()) return authHeader.trim();
  }

  const tunneledHeader = req.headers['x-supabase-access-token'];
  if (typeof tunneledHeader === 'string' && tunneledHeader.trim()) {
    return tunneledHeader.trim();
  }
  if (Array.isArray(tunneledHeader)) {
    const token = tunneledHeader.find((value) => typeof value === 'string' && value.trim());
    if (token) return token.trim();
  }

  const cookieHeader = req.headers.cookie;
  const cookieString = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader || '';
  const cookieMatch = cookieString.match(/(?:^|;\s*)spa_session_token=([^;]+)/);
  if (cookieMatch?.[1]) {
    try {
      return decodeURIComponent(cookieMatch[1]);
    } catch {
      return cookieMatch[1];
    }
  }

  return null;
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
    'billing.read',
    'billing.write',
    'reports.read',
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
    'notifications.write',
    'billing.read',
    'billing.write',
    'reports.read',
  ],
  client: ['content.read', 'content.write', 'ads.read', 'ads.write', 'dashboard.read', 'leads.read'],
};

const resolveRolePermissions = async (supabase: SupabaseClient, role: string): Promise<Set<string>> => {
  const fallbackPermissions = new Set(rolePermissionsFallback[role] || []);
  const { data, error } = await supabase
    .from('role_permissions')
    .select('module, action')
    .eq('role', role);

  if (error || !data?.length) {
    return fallbackPermissions;
  }

  const permissions = new Set<string>(fallbackPermissions);
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

import React, { useEffect, useMemo, useState } from 'react';
import AuthGate from '../components/AuthGate';
import Button from '../components/Button';
import { apiRequest, ApiError } from '../lib/apiClient';
import type { AdminRecipient, NotificationEvent } from '../types/platform';

interface AuthMeResponse {
  userId: string;
  email?: string;
  role: string;
  permissions: string[];
}

type SettingRecord = { key: string; value: unknown };
type RolePermission = { role: string; module: string; action: string };
type UserProfileRow = { id: string; full_name?: string; role: string; is_active: boolean };

const featureSettingLabels: Array<{ key: string; label: string; description: string }> = [
  {
    key: 'enquiry_alerts_enabled',
    label: 'Enquiry Email Alerts',
    description: 'Send admin emails when new enquiry/request is submitted.',
  },
  {
    key: 'ops_v1_enabled',
    label: 'Operations Dashboard',
    description: 'Enable /#/dashboard operations modules for internal team.',
  },
  {
    key: 'ops_billing_enabled',
    label: 'Billing Module',
    description: 'Allow billing records API and billing tracker tab.',
  },
  {
    key: 'ops_reports_enabled',
    label: 'Reports Module',
    description: 'Allow KPI/report summary API and reports tab.',
  },
];

const defaultModuleActions: Array<{ module: string; actions: string[] }> = [
  { module: 'dashboard', actions: ['read'] },
  { module: 'leads', actions: ['read', 'write'] },
  { module: 'services', actions: ['read', 'write'] },
  { module: 'clients', actions: ['read', 'write'] },
  { module: 'billing', actions: ['read', 'write'] },
  { module: 'reports', actions: ['read'] },
  { module: 'notifications', actions: ['read', 'write'] },
  { module: 'users', actions: ['read', 'write'] },
  { module: 'roles', actions: ['read', 'write'] },
  { module: 'settings', actions: ['read', 'write'] },
];

const AdminDashboard: React.FC = () => {
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [recipients, setRecipients] = useState<AdminRecipient[]>([]);
  const [notificationEvents, setNotificationEvents] = useState<NotificationEvent[]>([]);
  const [settings, setSettings] = useState<SettingRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<Array<Record<string, unknown>>>([]);
  const [users, setUsers] = useState<UserProfileRow[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [selectedRole, setSelectedRole] = useState('staff');
  const [permissionDraft, setPermissionDraft] = useState<string[]>([]);
  const [newRecipientEmail, setNewRecipientEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [resendingEnquiryId, setResendingEnquiryId] = useState<string | null>(null);

  const parseError = (err: unknown, fallback: string) =>
    err instanceof ApiError ? err.message : fallback;

  const getSettingBool = (key: string, fallback = true) => {
    const raw = settings.find((item) => item.key === key)?.value;
    if (typeof raw === 'boolean') return raw;
    return fallback;
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [meResponse, recipientsResponse, eventsResponse, settingsResponse, auditResponse, usersResponse, rolesResponse] =
        await Promise.all([
          apiRequest<AuthMeResponse>('/api/auth/me'),
          apiRequest<{ recipients: AdminRecipient[] }>('/api/admin/notification-recipients'),
          apiRequest<{ events: NotificationEvent[] }>('/api/admin/notification-events'),
          apiRequest<{ settings: SettingRecord[] }>('/api/admin/settings'),
          apiRequest<{ auditLogs: Array<Record<string, unknown>> }>('/api/admin/audit-logs'),
          apiRequest<{ users: UserProfileRow[] }>('/api/admin/users'),
          apiRequest<{ rolePermissions: RolePermission[] }>('/api/admin/roles'),
        ]);

      setMe(meResponse);
      setRecipients(recipientsResponse.recipients || []);
      setNotificationEvents(eventsResponse.events || []);
      setSettings(settingsResponse.settings || []);
      setAuditLogs(auditResponse.auditLogs || []);
      setUsers(usersResponse.users || []);
      setRolePermissions(rolesResponse.rolePermissions || []);
    } catch (err) {
      setError(parseError(err, 'Failed to load admin dashboard'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const availableRoles = useMemo(
    () => Array.from(new Set(['super_admin', 'admin', 'staff', 'client', ...rolePermissions.map((row) => row.role)])),
    [rolePermissions]
  );

  const moduleActionGrid = useMemo(() => {
    const map = new Map<string, Set<string>>();
    defaultModuleActions.forEach((row) => {
      map.set(row.module, new Set(row.actions));
    });
    rolePermissions.forEach((row) => {
      if (!map.has(row.module)) map.set(row.module, new Set<string>());
      map.get(row.module)?.add(row.action);
    });
    return Array.from(map.entries())
      .map(([module, actionSet]) => ({ module, actions: Array.from(actionSet.values()).sort() }))
      .sort((a, b) => a.module.localeCompare(b.module));
  }, [rolePermissions]);

  useEffect(() => {
    const current = rolePermissions
      .filter((row) => row.role === selectedRole)
      .map((row) => `${row.module}.${row.action}`);
    setPermissionDraft(current);
  }, [selectedRole, rolePermissions]);

  const setSetting = async (key: string, value: unknown) => {
    try {
      setBusyKey(`setting:${key}`);
      await apiRequest('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ key, value }),
      });
      await load();
    } catch (err) {
      setError(parseError(err, 'Failed to update setting'));
    } finally {
      setBusyKey(null);
    }
  };

  const addRecipient = async () => {
    if (!newRecipientEmail.trim()) return;
    try {
      setBusyKey('recipient:add');
      await apiRequest('/api/admin/notification-recipients', {
        method: 'POST',
        body: JSON.stringify({ email: newRecipientEmail.trim() }),
      });
      setNewRecipientEmail('');
      await load();
    } catch (err) {
      setError(parseError(err, 'Failed to add recipient'));
    } finally {
      setBusyKey(null);
    }
  };

  const toggleRecipient = async (recipient: AdminRecipient) => {
    try {
      setBusyKey(`recipient:${recipient.id}`);
      await apiRequest('/api/admin/notification-recipients', {
        method: 'PATCH',
        body: JSON.stringify({ id: recipient.id, enabled: !recipient.enabled }),
      });
      await load();
    } catch (err) {
      setError(parseError(err, 'Failed to update recipient'));
    } finally {
      setBusyKey(null);
    }
  };

  const updateUser = async (userId: string, payload: Record<string, unknown>) => {
    try {
      setBusyKey(`user:${userId}`);
      await apiRequest('/api/admin/users', {
        method: 'PATCH',
        body: JSON.stringify({ userId, ...payload }),
      });
      await load();
    } catch (err) {
      setError(parseError(err, 'Failed to update user'));
    } finally {
      setBusyKey(null);
    }
  };

  const resendAlert = async (enquiryId: string) => {
    try {
      setResendingEnquiryId(enquiryId);
      await apiRequest(`/api/enquiries/${enquiryId}/resend-alert`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(parseError(err, 'Failed to resend alert'));
    } finally {
      setResendingEnquiryId(null);
    }
  };

  const togglePermissionDraft = (module: string, action: string) => {
    const key = `${module}.${action}`;
    setPermissionDraft((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const saveRolePermissions = async () => {
    try {
      setBusyKey(`role:${selectedRole}`);
      const permissions = permissionDraft.map((key) => {
        const [module, action] = key.split('.');
        return { module, action };
      });
      await apiRequest('/api/admin/roles', {
        method: 'POST',
        body: JSON.stringify({
          role: selectedRole,
          permissions,
        }),
      });
      await load();
    } catch (err) {
      setError(parseError(err, 'Failed to save role permissions'));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-brand-gray px-4 py-12">
      <AuthGate title="Admin Dashboard">
        <div className="mx-auto max-w-7xl space-y-6">
          <div>
            <h1 className="font-display text-4xl font-bold uppercase text-brand-black">Admin Dashboard</h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage feature flags, user access, roles, notifications, and operational controls.
            </p>
            {me && (
              <p className="mt-1 text-xs uppercase tracking-[0.08em] text-brand-mclaren">
                Signed in as {me.email || me.userId} | role: {me.role}
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">System Controls</h2>
                <Button variant="outline" onClick={load}>
                  Refresh
                </Button>
              </div>
              <div className="space-y-3">
                {featureSettingLabels.map((item) => {
                  const enabled = getSettingBool(item.key, true);
                  return (
                    <div key={item.key} className="rounded-lg border border-neutral-200 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-brand-black">{item.label}</p>
                          <p className="text-xs text-gray-500">{item.description}</p>
                        </div>
                        <button
                          onClick={() => setSetting(item.key, !enabled)}
                          disabled={busyKey === `setting:${item.key}`}
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 rounded-lg border border-neutral-200 p-4">
                <p className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-500">Alert Recipients</p>
                <div className="mt-3 space-y-2">
                  {recipients.map((recipient) => (
                    <div key={recipient.id} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
                      <span className="text-sm text-gray-700">{recipient.email}</span>
                      <button
                        onClick={() => toggleRecipient(recipient)}
                        disabled={busyKey === `recipient:${recipient.id}`}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          recipient.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-200 text-neutral-700'
                        }`}
                      >
                        {recipient.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                  ))}
                  {!recipients.length && !loading && <p className="text-sm text-gray-500">No recipients configured.</p>}
                </div>

                <div className="mt-4 flex gap-2">
                  <input
                    type="email"
                    value={newRecipientEmail}
                    onChange={(e) => setNewRecipientEmail(e.target.value)}
                    placeholder="admin@domain.com"
                    className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  />
                  <Button onClick={addRecipient} disabled={busyKey === 'recipient:add'}>
                    Add
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">Email Delivery Health</h2>
              <div className="mt-4 space-y-2">
                {notificationEvents.slice(0, 12).map((event) => (
                  <div key={event.id} className="rounded-lg border border-neutral-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-brand-black">{event.event_type}</p>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          event.status === 'sent'
                            ? 'bg-emerald-100 text-emerald-700'
                            : event.status === 'failed'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {event.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Attempts: {event.attempt_count} | Entity: {event.entity_id}
                    </p>
                    {event.last_error && <p className="mt-1 text-xs text-red-600">Error: {event.last_error}</p>}
                    {event.status !== 'sent' && (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          onClick={() => resendAlert(event.entity_id)}
                          disabled={resendingEnquiryId === event.entity_id}
                        >
                          {resendingEnquiryId === event.entity_id ? 'Resending...' : 'Resend Alert'}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                {!notificationEvents.length && !loading && (
                  <p className="text-sm text-gray-500">No notification events yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">Role Permissions</h2>
              <div className="flex items-center gap-2">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                >
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <Button onClick={saveRolePermissions} disabled={busyKey === `role:${selectedRole}`}>
                  Save Role
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              {moduleActionGrid.map((row) => (
                <div key={row.module} className="rounded-lg border border-neutral-200 p-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">{row.module}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {row.actions.map((action) => {
                      const key = `${row.module}.${action}`;
                      const enabled = permissionDraft.includes(key);
                      return (
                        <button
                          key={key}
                          onClick={() => togglePermissionDraft(row.module, action)}
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            enabled ? 'bg-brand-black text-white' : 'bg-neutral-100 text-neutral-700'
                          }`}
                        >
                          {action}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">User Access Control</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-xs uppercase tracking-[0.08em] text-gray-500">
                    <th className="py-2 pr-4">User ID</th>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-neutral-100">
                      <td className="py-2 pr-4 text-xs text-gray-500">{user.id}</td>
                      <td className="py-2 pr-4">{user.full_name || '-'}</td>
                      <td className="py-2 pr-4">
                        <select
                          value={user.role}
                          onChange={(e) => updateUser(user.id, { role: e.target.value })}
                          disabled={busyKey === `user:${user.id}`}
                          className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                        >
                          {availableRoles.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-4">
                        <button
                          onClick={() => updateUser(user.id, { isActive: !user.is_active })}
                          disabled={busyKey === `user:${user.id}`}
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-200 text-neutral-700'
                          }`}
                        >
                          {user.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!users.length && !loading && <p className="text-sm text-gray-500">No users found in user_profiles.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">Recent Audit Logs</h2>
            <div className="mt-4 space-y-2">
              {auditLogs.slice(0, 20).map((log, index) => (
                <div key={`${String(log.id || index)}`} className="rounded-lg border border-neutral-200 p-3 text-sm">
                  <p className="font-medium text-brand-black">
                    {String(log.module || 'unknown')} | {String(log.action || 'unknown')}
                  </p>
                  <p className="text-xs text-gray-500">
                    Entity: {String(log.entity_type || '-')}:{String(log.entity_id || '-')} | {String(log.created_at || '')}
                  </p>
                </div>
              ))}
              {!auditLogs.length && !loading && <p className="text-sm text-gray-500">No audit logs found.</p>}
            </div>
          </div>
        </div>
      </AuthGate>
    </div>
  );
};

export default AdminDashboard;

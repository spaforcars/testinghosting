import React, { useEffect, useState } from 'react';
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

const AdminDashboard: React.FC = () => {
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [recipients, setRecipients] = useState<AdminRecipient[]>([]);
  const [notificationEvents, setNotificationEvents] = useState<NotificationEvent[]>([]);
  const [settings, setSettings] = useState<Array<{ key: string; value: unknown }>>([]);
  const [auditLogs, setAuditLogs] = useState<Array<Record<string, unknown>>>([]);
  const [users, setUsers] = useState<Array<{ id: string; full_name?: string; role: string; is_active: boolean }>>([]);
  const [rolePermissions, setRolePermissions] = useState<Array<{ role: string; module: string; action: string }>>([]);
  const [newRecipientEmail, setNewRecipientEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resendingEnquiryId, setResendingEnquiryId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [meResponse, recipientsResponse, eventsResponse, settingsResponse, auditResponse, usersResponse, rolesResponse] =
        await Promise.all([
          apiRequest<AuthMeResponse>('/api/auth/me'),
          apiRequest<{ recipients: AdminRecipient[] }>('/api/admin/notification-recipients'),
          apiRequest<{ events: NotificationEvent[] }>('/api/admin/notification-events'),
          apiRequest<{ settings: Array<{ key: string; value: unknown }> }>('/api/admin/settings'),
          apiRequest<{ auditLogs: Array<Record<string, unknown>> }>('/api/admin/audit-logs'),
          apiRequest<{ users: Array<{ id: string; full_name?: string; role: string; is_active: boolean }> }>('/api/admin/users'),
          apiRequest<{ rolePermissions: Array<{ role: string; module: string; action: string }> }>('/api/admin/roles'),
        ]);

      setMe(meResponse);
      setRecipients(recipientsResponse.recipients || []);
      setNotificationEvents(eventsResponse.events || []);
      setSettings(settingsResponse.settings || []);
      setAuditLogs(auditResponse.auditLogs || []);
      setUsers(usersResponse.users || []);
      setRolePermissions(rolesResponse.rolePermissions || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load admin dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const alertsEnabled =
    settings.find((item) => item.key === 'enquiry_alerts_enabled')?.value !== false;

  const toggleAlerts = async () => {
    try {
      await apiRequest('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          key: 'enquiry_alerts_enabled',
          value: !alertsEnabled,
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update alerts setting');
    }
  };

  const addRecipient = async () => {
    if (!newRecipientEmail) return;
    try {
      await apiRequest('/api/admin/notification-recipients', {
        method: 'POST',
        body: JSON.stringify({ email: newRecipientEmail }),
      });
      setNewRecipientEmail('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add recipient');
    }
  };

  const toggleRecipient = async (recipient: AdminRecipient) => {
    try {
      await apiRequest('/api/admin/notification-recipients', {
        method: 'PATCH',
        body: JSON.stringify({ id: recipient.id, enabled: !recipient.enabled }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update recipient');
    }
  };

  const updateUserRole = async (userId: string, role: string) => {
    try {
      await apiRequest('/api/admin/users', {
        method: 'PATCH',
        body: JSON.stringify({ userId, role }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update user role');
    }
  };

  const resendAlert = async (enquiryId: string) => {
    try {
      setResendingEnquiryId(enquiryId);
      await apiRequest(`/api/enquiries/${enquiryId}/resend-alert`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to resend alert');
    } finally {
      setResendingEnquiryId(null);
    }
  };

  const availableRoles = Array.from(
    new Set(['super_admin', 'admin', 'staff', 'client', ...rolePermissions.map((item) => item.role)])
  );

  return (
    <div className="min-h-screen bg-brand-gray px-4 py-12">
      <AuthGate title="Admin Dashboard">
        <div className="mx-auto max-w-7xl space-y-6">
          <div>
            <h1 className="font-display text-4xl font-bold uppercase text-brand-black">Admin Dashboard</h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage access, notification controls, and system audit activity.
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
                <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">Notification Settings</h2>
                <Button variant="outline" onClick={load}>
                  Refresh
                </Button>
              </div>
              <div className="rounded-lg border border-neutral-200 p-4">
                <p className="text-sm text-gray-600">Enquiry email alerts are currently:</p>
                <p className={`mt-2 text-lg font-semibold ${alertsEnabled ? 'text-emerald-700' : 'text-red-700'}`}>
                  {alertsEnabled ? 'Enabled' : 'Disabled'}
                </p>
                <div className="mt-4">
                  <Button onClick={toggleAlerts}>{alertsEnabled ? 'Disable Alerts' : 'Enable Alerts'}</Button>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-neutral-200 p-4">
                <p className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-500">Admin Recipients</p>
                <div className="mt-3 space-y-2">
                  {recipients.map((recipient) => (
                    <div key={recipient.id} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
                      <span className="text-sm text-gray-700">{recipient.email}</span>
                      <button
                        onClick={() => toggleRecipient(recipient)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          recipient.enabled
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-neutral-200 text-neutral-700'
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
                  <Button onClick={addRecipient}>Add</Button>
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
            <h2 className="font-display text-2xl font-semibold uppercase text-brand-black">Recent Audit Logs</h2>
            <div className="mt-4 space-y-2">
              {auditLogs.slice(0, 20).map((log, index) => (
                <div key={`${String(log.id || index)}`} className="rounded-lg border border-neutral-200 p-3 text-sm">
                  <p className="font-medium text-brand-black">
                    {String(log.module || 'unknown')} | {String(log.action || 'unknown')}
                  </p>
                  <p className="text-xs text-gray-500">
                    Entity: {String(log.entity_type || '-')}:{String(log.entity_id || '-')} |{' '}
                    {String(log.created_at || '')}
                  </p>
                </div>
              ))}
              {!auditLogs.length && !loading && <p className="text-sm text-gray-500">No audit logs found.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm lg:col-span-2">
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
                          onChange={(e) => updateUserRole(user.id, e.target.value)}
                          className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                        >
                          {availableRoles.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-4">{user.is_active ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!users.length && !loading && <p className="text-sm text-gray-500">No users found in `user_profiles`.</p>}
            </div>
          </div>
        </div>
      </AuthGate>
    </div>
  );
};

export default AdminDashboard;

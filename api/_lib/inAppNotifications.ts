import type { SupabaseClient } from '@supabase/supabase-js';

interface NotificationPayload {
  category?: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export const createInAppNotification = async (
  supabase: SupabaseClient,
  recipientUserId: string,
  payload: NotificationPayload
) => {
  const { error } = await supabase.from('in_app_notifications').insert({
    recipient_user_id: recipientUserId,
    category: payload.category || 'system',
    title: payload.title,
    message: payload.message,
    entity_type: payload.entityType || null,
    entity_id: payload.entityId || null,
    metadata: payload.metadata || {},
  });

  if (error) {
    console.warn('Failed to create in-app notification:', error.message);
  }
};

export const notifyRoles = async (
  supabase: SupabaseClient,
  roles: string[],
  payload: NotificationPayload,
  options?: { excludeUserId?: string }
) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, role, is_active')
    .in('role', roles)
    .eq('is_active', true);

  if (error) {
    console.warn('Failed to load notification recipients:', error.message);
    return;
  }

  const recipients = (data || [])
    .map((item) => item.id)
    .filter((id) => Boolean(id) && id !== options?.excludeUserId);

  if (!recipients.length) return;

  const inserts = recipients.map((recipientId) => ({
    recipient_user_id: recipientId,
    category: payload.category || 'system',
    title: payload.title,
    message: payload.message,
    entity_type: payload.entityType || null,
    entity_id: payload.entityId || null,
    metadata: payload.metadata || {},
  }));

  const { error: insertError } = await supabase.from('in_app_notifications').insert(inserts);
  if (insertError) {
    console.warn('Failed to insert in-app notifications:', insertError.message);
  }
};

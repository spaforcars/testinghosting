import type { SupabaseClient } from '@supabase/supabase-js';

interface AuditPayload {
  userId?: string | null;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

export const writeAuditLog = async (supabase: SupabaseClient, payload: AuditPayload) => {
  const { error } = await supabase.from('audit_logs').insert({
    user_id: payload.userId || null,
    action: payload.action,
    module: payload.module,
    entity_type: payload.entityType || null,
    entity_id: payload.entityId || null,
    details: payload.details || {},
  });

  if (error) {
    console.warn('Failed to write audit log:', error.message);
  }
};

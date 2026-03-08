import type { SupabaseClient } from '@supabase/supabase-js';

export const isFeatureEnabled = async (
  supabase: SupabaseClient,
  key: string,
  fallback = true
): Promise<boolean> => {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    console.warn(`Failed to load feature flag ${key}:`, error.message);
    return fallback;
  }

  if (!data) return fallback;
  return data.value !== false;
};

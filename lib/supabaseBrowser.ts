import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, hasSupabaseClientEnv } from './env';

let cachedClient: SupabaseClient | null = null;

export const getSupabaseBrowserClient = (): SupabaseClient | null => {
  if (!hasSupabaseClientEnv) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient(env.supabaseUrl!, env.supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return cachedClient;
};

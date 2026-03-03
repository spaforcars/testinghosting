export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  sanityProjectId: import.meta.env.VITE_SANITY_PROJECT_ID as string | undefined,
  sanityDataset: import.meta.env.VITE_SANITY_DATASET as string | undefined,
};

export const hasSupabaseClientEnv = Boolean(env.supabaseUrl && env.supabaseAnonKey);

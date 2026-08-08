import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client. Config is read from Expo public env vars:
 *   EXPO_PUBLIC_SUPABASE_URL     e.g. https://xxxx.supabase.co
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY  e.g. eyJ...
 *
 * These are safe to embed in the client (they are public by design). The
 * anon key only enables RLS-protected reads; server-side rules gate the data.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

/** True when the backend env vars have been configured. */
export const isSupabaseConfigured = Boolean(
  supabaseUrl.startsWith('http') && supabaseAnonKey.startsWith('eyJ')
);
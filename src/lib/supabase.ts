import { createClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

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

/**
 * Redirect URL for OAuth flows.
 * - Web: uses the current origin (works with Vercel preview/production)
 * - Native: uses the Expo auth session proxy (https://auth.expo.io/@your-project)
 *   or a custom scheme configured in app.json (e.g., "myapp://")
 */
const getRedirectUrl = () => {
  if (Platform.OS === 'web') {
    return `${window.location.origin}/auth/callback`;
  }
  // Use Expo's auth proxy for native — requires adding the URL to Supabase dashboard
  return Linking.createURL('/auth/callback', { scheme: 'techrepair' });
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

/** True when the backend env vars have been configured. */
export const isSupabaseConfigured = Boolean(
  supabaseUrl.startsWith('http') && supabaseAnonKey.startsWith('eyJ')
);

export { getRedirectUrl };
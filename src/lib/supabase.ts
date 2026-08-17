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
    // Raíz de la app: al volver de Google, la app recarga aquí y
    // `detectSessionInUrl` captura la sesión (code PKCE en la URL). No existe
    // una ruta /auth/callback: el guard del router decide login vs. zona
    // protegida a partir de la sesión restaurada.
    return window.location.origin;
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

/**
 * Mensaje de error legible cuando faltan o son inválidas las variables de
 * entorno del backend (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY).
 * Devuelve null si la configuración es correcta.
 */
export function getSupabaseEnvError(): string | null {
  if (!supabaseUrl.trim()) {
    return 'EXPO_PUBLIC_SUPABASE_URL no está configurada. La app no puede conectarse a la nube.';
  }
  if (!supabaseAnonKey.trim()) {
    return 'EXPO_PUBLIC_SUPABASE_ANON_KEY no está configurada. La app no puede conectarse a la nube.';
  }
  if (!supabaseUrl.startsWith('http')) {
    return 'EXPO_PUBLIC_SUPABASE_URL no es una URL válida (debe comenzar con http).';
  }
  if (!supabaseAnonKey.startsWith('eyJ')) {
    return 'EXPO_PUBLIC_SUPABASE_ANON_KEY no parece un JWT válido.';
  }
  return null;
}

/**
 * Lanza si las variables de entorno del backend no están configuradas.
 * Usar al inicio de cada operación que requiera Supabase.
 */
export function assertSupabaseConfigured(): void {
  const err = getSupabaseEnvError();
  if (err) throw new Error(err);
}

export { getRedirectUrl };

/**
 * Resuelve el `workshop_id` del usuario autenticado con auto-aprovisionamiento
 * (self-healing):
 *
 * 1. Intenta `ensure_workshop()` — RPC `SECURITY DEFINER` (ver schema.sql) que,
 *    si la cuenta no tiene fila en `public.profiles` (cuentas creadas antes del
 *    trigger `handle_new_user`, o con trigger que tragó un error), crea el
 *    taller por defecto "Mi Taller" + el perfil con rol 'admin' y devuelve el
 *    workshop_id. Así `current_workshop_id()` NUNCA es null para un usuario
 *    autenticado activo.
 * 2. Si el RPC aún no existe en la BD (transición previa a aplicar el schema),
 *    cae a `current_workshop_id()` para no romper la app.
 *
 * Devuelve null solo si no hay sesión o ambos RPC fallan.
 */
export async function resolveWorkshopId(): Promise<string | null> {
  // Sin sesión no hay taller que asegurar: saltarse el RPC evita el 401/42501
  // "permission denied" que anon recibe por diseño (sin GRANT en schema.sql) y
  // silencia el ruido de consola en la web pública (login sin sesión).
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: ensured, error } = await supabase.rpc('ensure_workshop');
  if (!error && typeof ensured === 'string') {
    return ensured;
  }
  if (error) {
    console.error(
      '[supabase] ensure_workshop falló (¿RPC no aplicado a la BD?): ' +
        JSON.stringify({ code: error.code, message: error.message, hint: error.hint })
    );
  }
  const { data } = await supabase.rpc('current_workshop_id');
  return typeof data === 'string' ? data : null;
}
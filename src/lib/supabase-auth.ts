import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { Platform } from 'react-native';

/**
 * Capa de autenticación real sobre Supabase Auth (email + password y Google).
 * El trabajo de sesión/refresh lo hace `supabase.auth` (persistSession +
 * autoRefreshToken ya configurados en `supabase.ts`).
 *
 * Contrato con la Base de Datos: al INSERTAR un usuario en `auth.users`, el
 * trigger `handle_new_user` crea su `workshops` y su fila en `profiles`
 * (RLS) usando `raw_user_meta_data->>'workshop_name'` y `->>'full_name'`
 * (ver supabase/schema.sql). Por eso SIEMPRE pasamos esos dos campos en
 * `options.data` al registrarnos.
 *
 * Config aplicada en el proyecto (supabase.com/dashboard/project/.../auth):
 *   - site_url: https://mi-app-vibe-ten.vercel.app
 *   - uri_allow_list: localhost:8081 + Vercel
 *   - email autoconfirm: DESACTIVADO -> el usuario debe confirmar su correo
 *     con el enlace que recibe por email ANTES de poder iniciar sesión.
 *   - Google provider: habilitado (client_id/secret configurados por API).
 */

/** Perfil mínimo que la app expone (sin password, que solo conoce Supabase). */
export interface SupabaseUserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  commission_rate?: number;
  is_active?: boolean;
  specialty?: string;
  joined_at?: string;
  notes?: string;
  isGoogle: boolean;
  avatarUrl?: string;
  googleId?: string;
}

export type SignUpResult =
  | { ok: true; pendingVerification: boolean; user?: SupabaseUserProfile }
  | { ok: false; reason: 'email' | 'unknown'; message: string };

export type SignInResult =
  | { ok: true; user: SupabaseUserProfile }
  | {
      ok: false;
      reason: 'invalid' | 'unconfirmed' | 'unknown';
      message: string;
    };

/** Construye el perfil de app desde el usuario de una sesión de Supabase. */
export function toProfile(authUser: SupabaseUser): SupabaseUserProfile {
  const metadata = authUser.user_metadata ?? {};
  const googleIdentity = (authUser.identities ?? []).find(
    (identity) => identity.provider === 'google'
  );
  return {
    id: authUser.id,
    email: authUser.email ?? '',
    name: (metadata.name as string) || (metadata.full_name as string) || '',
    role: (metadata.role as string) || 'technician',
    isGoogle: authUser.app_metadata?.provider === 'google',
    avatarUrl: (metadata.avatar_url as string | undefined) ?? (metadata.picture as string | undefined),
    googleId: googleIdentity?.id ?? (metadata.sub as string | undefined),
  };
}

/**
 * Metadatos opcionales para el registro. El trigger `handle_new_user`
 * consume `full_name`, `role` y `workshop_id`/`workshop_name` para crear
 * el perfil y asociarlo al taller correcto (ver supabase/schema.sql).
 * Si se omite algo, se aplica un fallback (nunca se envía null/'').
 */
export interface SignUpMetadata {
  full_name?: string;
  role?: 'admin' | 'technician';
  workshop_id?: string;
  workshop_name?: string;
  /** Comisión del técnico (fracción, 0.30 = 30%). Se persiste en profiles.commission_rate vía el trigger handle_new_user. */
  commission_rate?: number;
}

/** Envía el correo de confirmación del registro (enlace de verificación). */
export async function supabaseSignUp(
  name: string,
  email: string,
  password: string,
  metadata?: SignUpMetadata
): Promise<SignUpResult> {
  try {
    // Fallbacks para no enviar campos null/vacíos que rompan constraints
    // o el trigger de creación de perfil.
    const fullName = (metadata?.full_name ?? name).trim();
    const workshopName = (metadata?.workshop_name ?? fullName).trim() || 'Mi Taller';
    const data: Record<string, string> = {
      full_name: fullName || 'Usuario',
    };
    if (metadata?.role) {
      data.role = metadata.role;
    }
    if (metadata?.workshop_id) {
      data.workshop_id = metadata.workshop_id;
    }
    if (typeof metadata?.commission_rate === 'number') {
      data.commission_rate = String(metadata.commission_rate);
    }
    data.workshop_name = workshopName;

    const { data: result, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data },
    });
    if (error) {
      const isDuplicate =
        /already registered|user_already_exists|email_exists/i.test(error.message) ||
        error.code === 'user_already_exists' ||
        error.code === 'email_exists';
      return {
        ok: false,
        reason: isDuplicate ? 'email' : 'unknown',
        message: error.message,
      };
    }
    // Con mailer_autoconfirm=false el registro queda pendiente de verificación;
    // session llega null hasta que el usuario confirme el correo con el enlace.
    const needsVerification =
      !result.session || result.user?.email_confirmed_at == null;
    if (needsVerification) {
      return { ok: true, pendingVerification: true };
    }
    // Caso especial (autoconfirm activo, pruebas): ya hay sesión.
    return result.user
      ? { ok: true, pendingVerification: false, user: toProfile(result.user) }
      : { ok: true, pendingVerification: true };
  } catch (cause) {
    return {
      ok: false,
      reason: 'unknown',
      message: cause instanceof Error ? cause.message : 'Error de registro.',
    };
  }
}

/** Reenvía el correo de confirmación del registro. */
export async function supabaseResendRegistration(
  email: string
): Promise<{ ok: boolean; message?: string }> {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
    });
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : 'No se pudo reenviar el código.',
    };
  }
}

/** Inicia sesión con correo + contraseña (verificados). */
export async function supabaseSignInWithPassword(
  email: string,
  password: string
): Promise<SignInResult> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      const isUnconfirmed =
        error.code === 'email_not_confirmed' ||
        /email not confirmed/i.test(error.message);
      const isInvalidCredentials =
        error.code === 'invalid_credentials' ||
        /invalid login credentials/i.test(error.message);
      return {
        ok: false,
        reason: isUnconfirmed
          ? 'unconfirmed'
          : isInvalidCredentials
            ? 'invalid'
            : 'unknown',
        message: error.message,
      };
    }
    if (!data.user) {
      return { ok: false, reason: 'unknown', message: 'Sin sesión después del inicio.' };
    }
    return { ok: true, user: toProfile(data.user) };
  } catch (cause) {
    return {
      ok: false,
      reason: 'unknown',
      message: cause instanceof Error ? cause.message : 'Error de acceso.',
    };
  }
}

/**
 * Puente Google -> Supabase: recibe el id_token que `google-auth.ts` obtuvo
 * del endpoint OAuth de Google y le pide a Supabase crear/vincular la sesión.
 * No requiere secret: el id_token es la credencial verificada.
 */
export async function supabaseSignInWithGoogleIdToken(
  idToken: string
): Promise<SignInResult> {
  try {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) {
      return { ok: false, reason: 'unknown', message: error.message };
    }
    if (!data.user) {
      return { ok: false, reason: 'unknown', message: 'No se obtuvo la sesión de Google.' };
    }
    return { ok: true, user: toProfile(data.user) };
  } catch (cause) {
    return {
      ok: false,
      reason: 'unknown',
      message: cause instanceof Error ? cause.message : 'No se pudo conectar con Google.',
    };
  }
}

/** Cierra la sesión de Supabase. */
export async function supabaseSignOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** Restaura la sesión persistida (reload / restart) y devuelve el perfil. */
export async function supabaseRestoreSession(): Promise<SupabaseUserProfile | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) return null;
    return toProfile(data.session.user);
  } catch {
    return null;
  }
}

/**
 * Google OAuth en WEB con redirección de ventana completa (SIN popups).
 *
 * 🛑 FLUJO ESTRICTO PARA WEB: SIN POPUPS, SIN WEBBROWSER.
 *
 * `skipBrowserRedirect` se deja en su default (`false`): el SDK de Supabase
 * ejecuta `window.location.assign(data.url)` y navega LA MISMA PESTAÑA
 * completa (verificado en @supabase/auth-js 2.112.2, GoTrueClient.js:2135).
 * Nunca se abre una ventana secundaria ni se usa WebBrowser.
 *
 * Al volver de Google a `redirectTo` (la raíz del sitio), `detectSessionInUrl`
 * captura el code/access_token de la URL y el listener `onAuthStateChange` del
 * AuthContext sincroniza la sesión con Expo Router.
 */
export async function supabaseSignInWithGoogleRedirect(): Promise<
  | { ok: true }
  | { ok: false; message: string }
> {
  // Guardia absoluta: este flujo SOLO existe en web. En nativo no se ejecuta.
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return { ok: false, message: 'El inicio con Google por redirección solo aplica en web.' };
  }
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // La pestaña actual (misma ventana) es la que viaja a Google y vuelve.
        redirectTo: window.location.origin,
        // skipBrowserRedirect OMITIDO (default false): el SDK navega la
        // ventana principal con window.location.assign. Sin popups.
      },
    });
    if (error) {
      return { ok: false, message: error.message };
    }
    // El SDK ya navegó la ventana principal (window.location.assign). Red de
    // seguridad: si el entorno no llegó a navegar, forzamos la misma pestaña.
    if (data?.url && window.location.href !== data.url) {
      window.location.href = data.url;
    }
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : 'No se pudo conectar con Google.',
    };
  }
}
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

/**
 * Capa de autenticación real sobre Supabase Auth (email + password, Google,
 * verificación por código OTP). El trabajo de sesión/refresh lo hace
 * `supabase.auth` (persistSession + autoRefreshToken ya configurados en
 * `supabase.ts`).
 *
 * Contrato con la Base de Datos: al INSERTAR un usuario en `auth.users`, el
 * trigger `handle_new_user` crea su `workshops` y su fila en `profiles`
 * (RLS) usando `raw_user_meta_data->>'workshop_name'`, `->>'full_name'` y
 * `->>'phone'` (ver supabase/schema.sql). Por eso SIEMPRE pasamos esos tres
 * campos en `options.data` al registrarnos.
 *
 * Config aplicada en el proyecto (supabase.com/dashboard/project/.../auth):
 *   - site_url: https://mi-app-vibe-ten.vercel.app
 *   - uri_allow_list: localhost:8081 + Vercel
 *   - mailer_otp_length: 6  (el código de verificación es de 6 dígitos)
 *   - email autoconfirm: DESACTIVADO -> el usuario debe confirmar su correo
 *     con el código que recibe por email ANTES de poder iniciar sesión.
 *   - Google provider: habilitado (client_id/secret configurados por API).
 */

/** Perfil mínimo que la app expone (sin password, que solo conoce Supabase). */
export interface SupabaseUserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
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
function toProfile(authUser: SupabaseUser): SupabaseUserProfile {
  const metadata = authUser.user_metadata ?? {};
  const googleIdentity = (authUser.identities ?? []).find(
    (identity) => identity.provider === 'google'
  );
  return {
    id: authUser.id,
    email: authUser.email ?? '',
    name: (metadata.name as string) || (metadata.full_name as string) || '',
    phone: metadata.phone as string | undefined,
    isGoogle: authUser.app_metadata?.provider === 'google',
    avatarUrl: (metadata.avatar_url as string | undefined) ?? (metadata.picture as string | undefined),
    googleId: googleIdentity?.id ?? (metadata.sub as string | undefined),
  };
}

/** Envía el correo de confirmación con código OTP de 6 dígitos. */
export async function supabaseSignUp(
  name: string,
  email: string,
  password: string,
  phone: string
): Promise<SignUpResult> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: name.trim(),
          phone: phone.replace(/\s/g, ''),
          workshop_name: name.trim() || 'Mi Taller',
        },
      },
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
    // session llega null hasta que el usuario valide el código del correo.
    const needsVerification =
      !data.session || data.user?.email_confirmed_at == null;
    if (needsVerification) {
      return { ok: true, pendingVerification: true };
    }
    // Caso especial (autoconfirm activo, pruebas): ya hay sesión.
    return data.user
      ? { ok: true, pendingVerification: false, user: toProfile(data.user) }
      : { ok: true, pendingVerification: true };
  } catch (cause) {
    return {
      ok: false,
      reason: 'unknown',
      message: cause instanceof Error ? cause.message : 'Error de registro.',
    };
  }
}

/** Valida el código OTP del correo de registro (tipo 'signup'). */
export async function supabaseVerifyRegistration(
  email: string,
  token: string
): Promise<{ ok: boolean; message?: string }> {
  try {
    const { error } = await supabase.auth.verifyOtp({
      type: 'signup',
      email: email.trim().toLowerCase(),
      token: token.trim(),
    });
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : 'No se pudo verificar el código.',
    };
  }
}

/** Reenvía el código OTP de registro al correo. */
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
      return {
        ok: false,
        reason: 'invalid' in error ? 'invalid' : 'unknown',
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
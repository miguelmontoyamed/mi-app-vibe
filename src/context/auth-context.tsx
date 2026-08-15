import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';

import type { GoogleAuthResult } from '@/lib/google-auth';
import { getSupabaseEnvError, isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  supabaseRestoreSession,
  supabaseResendRegistration,
  supabaseSignInWithGoogleIdToken,
  supabaseSignInWithPassword,
  supabaseSignOut,
  supabaseSignUp,
  toProfile,
} from '@/lib/supabase-auth';
import type { SupabaseUserProfile } from '@/lib/supabase-auth';
import {
  generateInviteToken,
  decodeInviteToken,
  validateInviteToken,
  buildInviteUrl,
  type InviteValidation,
} from '@/utils/auth-links';

export type UserRole = 'admin' | 'technician';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** Comisión del % del presupuesto (0.30 = 30%), solo para técnicos. */
  commissionRate?: number;
  isGoogle?: boolean; // Cuenta de Google (sin password)
  avatarUrl?: string; // Foto de perfil de Google
  googleId?: string; // Subject id de Google
}

/** Resultado del login: usuario autenticado o motivo del rechazo. */
export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; reason: 'invalid' | 'unconfirmed' | 'unknown' };

export interface LicenseInfo {
  isActive: boolean;
  licenseKey: string;
  plan: 'Licencia Inicial' | 'Mensual - Pro' | 'Anual';
  expiresAt: string;
  daysRemaining: number;
}

export interface InviteLink {
  /** Token criptográfico (16 chars, uppercase, sin guiones). */
  token: string;
  /** ID del admin dueño del taller que generó la invitación. */
  workshopId: string;
  /** Nombre del taller (para UX en el banner de invitación del técnico). */
  workshopName: string;
  /** URL completa que se comparte con el técnico (deep link / URL web). */
  url: string;
  /** Timestamp de expiración (epoch millis). */
  expiresAt: number;
  /** Timestamp de creación (epoch millis), para auditoría. */
  createdAt: number;
}

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  /** True cuando Supabase terminó de restaurar la sesión y cargar los
   *  miembros del taller desde `profiles`. El router debe esperarlo antes
   *  de decidir entre login y la zona protegida. */
  hydrated: boolean;
  /** Miembros del taller: filas de `public.profiles` (role technician/admin). */
  users: User[];
  license: LicenseInfo;
  inviteLink: InviteLink | null;
  /** Error visible de hidratación (env faltante), o null. */
  loadError: string | null;
  /** Login real (Supabase). Un correo sin verificar se bloquea con
   *  `reason: 'unconfirmed'`. No hay fallback local. */
  login: (email: string, password: string) => Promise<LoginResult>;
  /** Google: puentea el id_token a Supabase (crea/víncula la sesión). */
  signInWithGoogle: (auth: GoogleAuthResult) => Promise<User | null>;
  logout: () => Promise<void>;
  registerOwner: (
    name: string,
    email: string,
    password: string
  ) => Promise<{
    user: User | null;
    reason?: 'email' | 'device';
    /** True cuando hay que confirmar el correo con el enlace del email. */
    pendingVerification?: boolean;
  }>;
  /** Reenvía el correo de confirmación del registro. */
  resendRegistration: (email: string) => Promise<boolean>;
  /** Crea un técnico REAL en Supabase (cuenta pendiente de verificación).
   *  Devuelve { ok } o el motivo del rechazo. */
  createTechnician: (
    name: string,
    email: string,
    commissionRate: number
  ) => Promise<{
    ok: boolean;
    reason?: 'email' | 'limit' | 'unknown';
    message?: string;
  }>;
  /** Elimina (soft delete) un técnico. Devuelve false si no existe o es el
   *  usuario actual. */
  deleteTechnician: (id: string) => Promise<boolean>;
  verifyLicense: (key: string) => boolean;
  renewSubscription: () => void;
  /** Registra a un técnico invitado por enlace. Crea la cuenta REAL
   *  (role='technician' + workshop_id del taller del admin) y requiere
   *  confirmar el correo. Devuelve `pendingVerification: true` cuando hay
   *  que confirmar el correo. */
  registerInvitedTechnician: (
    name: string,
    email: string,
    password: string,
    workshopId: string,
    workshopName: string
  ) => Promise<{ ok: boolean; pendingVerification?: boolean; message?: string }>;
  /** Genera un enlace de invitación temporal (10 min) para que un técnico se
   *  registre y quede automáticamente asociado al taller del admin. */
  generateInviteLink: () => string | null;
  /** Valida un token de invitación decodificado; devuelve el workshopId si es válido. */
  validateInviteLink: (encodedToken: string) => InviteValidation;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Límite estricto de técnicos por taller/entorno (requisito de licenciamiento). */
export const MAX_TECHNICIANS = 5;

const EVAL_DURATION_DAYS = 90;
const EVAL_EXPIRES_AT = new Date(Date.now() + EVAL_DURATION_DAYS * 24 * 60 * 60 * 1000)
  .toISOString()
  .split('T')[0];

// Computed at module scope (not during render) to satisfy React purity rules.
const DEFAULT_LICENSE: LicenseInfo = {
  isActive: true,
  licenseKey: 'EVAL-90DAYS-ACTIVE',
  plan: 'Licencia Inicial',
  expiresAt: EVAL_EXPIRES_AT,
  daysRemaining: EVAL_DURATION_DAYS,
};

// Structural check for Pro license keys. NOTE: this is a client-side simulation —
// a production build must validate license keys against a server.
const PRO_LICENSE_REGEX = /^TR-PRO-[A-Z0-9-]{12,}$/;

/** Fila de `public.profiles` (PostgreSQL). No contiene email: vive en
 *  `auth.users` y no es consultable desde el cliente. */
interface ProfileRow {
  id: string;
  workshop_id: string;
  full_name: string | null;
  role: string;
  commission_rate: number | null;
  is_active: boolean | null;
  specialty: string | null;
  joined_at: string | null;
  notes: string | null;
  created_at: string;
}

/** Convierte el perfil de Supabase (sesión) en la forma local User de la app. */
function profileToUser(profile: SupabaseUserProfile): User {
  return {
    id: profile.id,
    name: profile.name.trim() || profile.email.split('@')[0],
    role: profile.role === 'technician' ? 'technician' : 'admin',
    email: profile.email,
    commissionRate:
      profile.commission_rate != null ? Number(profile.commission_rate) : undefined,
    isGoogle: profile.isGoogle,
    avatarUrl: profile.avatarUrl,
    googleId: profile.googleId,
  };
}

/** Convierte una fila de `profiles` en la forma local User. `email` queda ''
 *  porque la tabla no lo tiene (no se fabrica). */
function profileRowToUser(row: ProfileRow): User {
  return {
    id: row.id,
    name: row.full_name ?? '',
    email: '',
    role: row.role === 'technician' ? 'technician' : 'admin',
    commissionRate: row.commission_rate != null ? Number(row.commission_rate) : undefined,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [inviteLink, setInviteLink] = useState<InviteLink | null>(null);

  // Default Licencia Inicial (90 días de evaluación). Para probar UI se puede
  // bajar a 9 días para disparar el contador.
  const [license, setLicense] = useState<LicenseInfo>(DEFAULT_LICENSE);

  const [hydrated, setHydrated] = useState(false);
  /** Error visible de hidratación (env faltante), o null. */
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Workshop id resuelto vía `current_workshop_id()` (SECURITY DEFINER). */
  const [workshopId, setWorkshopId] = useState<string | null>(null);

  /** Muestra un error visible en web (window.alert) o nativo (Alert.alert). */
  const notifyError = (message: string) => {
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert('Error', message);
    }
  };

  /** Recarga los miembros del taller desde `profiles` (fuente de verdad). */
  const refreshUsers = useCallback(async (wid: string) => {
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .eq('workshop_id', wid)
      .order('created_at', { ascending: true });
    if (!profilesError && profilesData) {
      setUsers(
        (profilesData as ProfileRow[])
          .filter((row) => row.is_active !== false)
          .map(profileRowToUser)
      );
    }
  }, []);

  // Hydrate: sesión de Supabase + miembros del taller desde `profiles` (una
  // sola vez). La sesión de Supabase es la fuente de verdad para `currentUser`
  // y `profiles` para `users`. Sin Supabase configurado NO se siembran
  // usuarios: solo se reporta el error de entorno.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!isSupabaseConfigured) {
          setLoadError(getSupabaseEnvError() ?? 'Supabase no está configurado.');
          return;
        }
        const profile = await supabaseRestoreSession();
        if (!cancelled && profile) {
          setCurrentUser(profileToUser(profile));
        }
        const { data: wid } = await supabase.rpc('current_workshop_id');
        if (!cancelled && typeof wid === 'string') {
          setWorkshopId(wid);
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('*')
            .eq('workshop_id', wid)
            .order('created_at', { ascending: true });
          if (!cancelled && !profilesError && profilesData) {
            setUsers(
              (profilesData as ProfileRow[])
                .filter((row) => row.is_active !== false)
                .map(profileRowToUser)
            );
          }
        }
      } catch (error) {
        console.error('Error loading TechRepair session:', error);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Listener global de sesión de Supabase. Captura el retorno de Google OAuth
  // (tokens en la URL), refrescos de token y cierres de sesión. Mantiene
  // `currentUser` y `users` sincronizados con la fuente de verdad (Supabase)
  // y permite que el guard del router navegue a la zona protegida sin recargar.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUser(profileToUser(toProfile(session.user)));
        // Mantener `users` al día con los miembros del taller.
        (async () => {
          try {
            const { data: wid } = await supabase.rpc('current_workshop_id');
            if (typeof wid === 'string') {
              setWorkshopId(wid);
              await refreshUsers(wid);
            }
          } catch {
            // Ignorar: el listener no debe romper por un refresh fallido.
          }
        })();
      } else {
        setCurrentUser(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [refreshUsers]);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const needle = email.trim().toLowerCase();
    // Supabase SIEMPRE: no hay pool local ni cuentas seed.
    const result = await supabaseSignInWithPassword(needle, password);
    if (result.ok) {
      const user = profileToUser(result.user);
      setCurrentUser(user);
      // Sincronizar los miembros del taller desde `profiles`.
      const { data: wid } = await supabase.rpc('current_workshop_id');
      if (typeof wid === 'string') {
        setWorkshopId(wid);
        await refreshUsers(wid);
      }
      return { ok: true, user };
    }
    return { ok: false, reason: result.reason };
  };

  /**
   * Google real: usa el id_token que google-auth.ts obtuvo del endpoint OAuth
   * y lo puentea a Supabase (`signInWithIdToken`), que crea o vincula la
   * sesión. Sin Supabase configurado no hay simulación local: devuelve null.
   */
  const signInWithGoogle = async (auth: GoogleAuthResult): Promise<User | null> => {
    const { idToken } = auth;
    try {
      const result = await supabaseSignInWithGoogleIdToken(idToken);
      if (result.ok) {
        const user = profileToUser(result.user);
        setCurrentUser(user);
        const { data: wid } = await supabase.rpc('current_workshop_id');
        if (typeof wid === 'string') {
          setWorkshopId(wid);
          await refreshUsers(wid);
        }
        return user;
      }
    } catch {
      // Sin fallback local: el error lo reporta el llamador (login.tsx).
    }
    return null;
  };

  const logout = async () => {
    if (isSupabaseConfigured) {
      await supabaseSignOut();
    }
    setCurrentUser(null);
  };

  const verifyLicense = (key: string): boolean => {
    const normalized = key.trim().toUpperCase();
    if (PRO_LICENSE_REGEX.test(normalized)) {
      setLicense((prev) => ({
        ...prev,
        isActive: true,
        licenseKey: normalized,
        plan: 'Mensual - Pro',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        daysRemaining: 30,
      }));
      return true;
    }
    return false;
  };

  const renewSubscription = () => {
    setLicense((prev) => ({
      ...prev,
      isActive: true,
      plan: 'Mensual - Pro',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      daysRemaining: 30,
    }));
  };

  /**
   * Creates a REAL technician account in Supabase (owner action). Rejects
   * duplicates by email and enforces the strict 5-technician limit per
   * workshop. Commission rate is a fraction (0.30 = 30%).
   *
   * La cuenta queda pendiente de verificación: el técnico recibe el correo de
   * confirmación de Supabase y puede restablecer su contraseña. El trigger
   * `handle_new_user` crea su fila en `profiles` (role='technician').
   */
  const createTechnician = async (
    name: string,
    email: string,
    commissionRate: number
  ): Promise<{
    ok: boolean;
    reason?: 'email' | 'limit' | 'unknown';
    message?: string;
  }> => {
    const normalizedEmail = email.trim().toLowerCase();
    const techCount = users.filter((u) => u.role === 'technician').length;
    if (techCount >= MAX_TECHNICIANS) {
      return { ok: false, reason: 'limit' };
    }
    // Resolver el taller actual (mismo patrón que repair/workshop contexts).
    let wid = workshopId;
    if (!wid) {
      const { data } = await supabase.rpc('current_workshop_id');
      if (typeof data === 'string') {
        wid = data;
        setWorkshopId(data);
      }
    }
    if (!wid) {
      return { ok: false, reason: 'unknown', message: 'No se pudo resolver el taller actual.' };
    }

    const safeRate = Number.isFinite(commissionRate)
      ? Math.min(1, Math.max(0, commissionRate))
      : 0;

    // Contraseña temporal: el técnico recibe el correo de confirmación de
    // Supabase y puede restablecerla desde ahí.
    const tempPassword = 'trm-' + Math.random().toString(36).slice(2, 10);
    const result = await supabaseSignUp(name, normalizedEmail, tempPassword, {
      full_name: name,
      role: 'technician',
      workshop_id: wid,
      commission_rate: safeRate,
    });
    if (!result.ok) {
      return {
        ok: false,
        reason: result.reason === 'email' ? 'email' : 'unknown',
        message: result.message,
      };
    }
    // Refrescar la lista de miembros (el trigger ya creó la fila en profiles).
    await refreshUsers(wid);
    return { ok: true };
  };

  /** Removes a technician account (soft delete). Never the current user. */
  const deleteTechnician = async (id: string): Promise<boolean> => {
    if (!users.some((u) => u.id === id && u.role === 'technician')) {
      return false;
    }
    if (currentUser?.id === id) {
      return false;
    }
    // Soft delete: cero pérdida de datos (is_active=false).
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('id', id);
    if (error) {
      console.error('Error deleting technician:', error);
      return false;
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
    return true;
  };

  /**
   * Registro de técnico invitado por enlace (deep link ?invite=...).
   * Crea la cuenta REAL con role='technician' y workshop_id del taller del
   * admin (el trigger `handle_new_user` resuelve el taller y crea el perfil).
   */
  const registerInvitedTechnician = async (
    name: string,
    email: string,
    password: string,
    workshopId: string,
    workshopName: string
  ): Promise<{ ok: boolean; pendingVerification?: boolean; message?: string }> => {
    const result = await supabaseSignUp(name, email, password, {
      role: 'technician',
      full_name: name,
      workshop_id: workshopId,
      workshop_name: workshopName,
    });
    if (!result.ok) {
      return { ok: false, message: result.message };
    }
    if (result.pendingVerification) {
      return { ok: true, pendingVerification: true };
    }
    return { ok: true };
  };

  /**
   * Owner sign-up. Crea el usuario real en Supabase y requiere confirmar el
   * correo con el enlace del email antes de poder iniciar sesión.
   */
  const registerOwner = async (
    name: string,
    email: string,
    password: string
  ): Promise<{
    user: User | null;
    reason?: 'email' | 'device';
    pendingVerification?: boolean;
  }> => {
    // Metadata explícita: el trigger `handle_new_user` usa role='admin'
    // para crear el perfil como dueño del taller. Nunca enviamos null/''.
    const result = await supabaseSignUp(name, email, password, {
      role: 'admin',
      full_name: name,
      workshop_name: name.trim() || 'Mi Taller',
    });
    if (!result.ok) {
      return {
        user: null,
        reason: result.reason === 'email' ? 'email' : 'device',
      };
    }
    if (result.pendingVerification) {
      return { user: null, pendingVerification: true };
    }
    if (result.user) {
      const user = profileToUser(result.user);
      setCurrentUser(user);
      return { user };
    }
    return { user: null };
  };

  /** Reenvía el correo de confirmación del registro. */
  const resendRegistration = async (email: string): Promise<boolean> => {
    if (!isSupabaseConfigured) return false;
    const resend = await supabaseResendRegistration(email);
    return resend.ok;
  };

  /**
   * Genera un enlace de invitación temporal (10 min) para que un técnico se
   * registre y quede automáticamente asociado al taller del admin. Solo el
   * dueño (admin) actual puede generar enlaces — el taller se identifica con
   * el nombre e ID del `currentUser` (el trigger `handle_new_user` resuelve
   * el taller real desde la fila en `profiles` del admin invitador).
   */
  const generateInviteLink = (): string | null => {
    if (!currentUser || currentUser.role !== 'admin') {
      return null;
    }
    // No generar enlaces si el taller ya alcanzó el límite de 5 técnicos.
    const techCount = users.filter((u) => u.role === 'technician').length;
    if (techCount >= MAX_TECHNICIANS) {
      return null;
    }
    const token = generateInviteToken(currentUser.id, currentUser.name);
    const url = buildInviteUrl(token);
    setInviteLink({
      token: token.token,
      workshopId: currentUser.id,
      workshopName: currentUser.name,
      url,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
    });
    return url;
  };

  /** Valida un token de invitación codificado y devuelve el workshopId si es válido. */
  const validateInviteLink = (encodedToken: string): InviteValidation => {
    const decoded = decodeInviteToken(encodedToken);
    if (!decoded) {
      return { valid: false, reason: 'invalid' };
    }
    return validateInviteToken(decoded);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: currentUser !== null,
        hydrated,
        users,
        license,
        inviteLink,
        loadError,
        login,
        signInWithGoogle,
        logout,
        registerOwner,
        resendRegistration,
        createTechnician,
        deleteTechnician,
        verifyLicense,
        renewSubscription,
        registerInvitedTechnician,
        generateInviteLink,
        validateInviteLink,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
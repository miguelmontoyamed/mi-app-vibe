import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Alert, Platform } from 'react-native';

import {
  supabaseResendRegistration,
  supabaseRestoreSession,
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
  getPendingInvite,
  clearPendingInvite,
  getPendingInviteToken,
  savePendingInviteToken,
  clearPendingInviteToken,
  type InviteToken,
  type InviteValidation,
} from '@/utils/auth-links';
import type { GoogleAuthResult } from '@/utils/google-auth';
import {
  getSupabaseEnvError,
  isSupabaseConfigured,
  resolveWorkshopId,
  supabase,
} from '@/lib/supabase';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'technician';
  commissionRate?: number;
  isActive?: boolean;
}

/** Resultado del login: usuario autenticado o motivo del rechazo. */
export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; reason: 'invalid' | 'unconfirmed' | 'unknown' };

export interface InviteLink {
  /** Token criptográfico. */
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

export interface ServerInvitation {
  id: string;
  workshop_id: string;
  invited_by: string;
  email: string | null;
  token: string;
  role: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expires_at: string;
  created_at: string;
  url: string;
}

export interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  /** True cuando Supabase terminó de restaurar la sesión y cargar los
   *  miembros del taller desde `profiles`. El router debe esperarlo antes
   *  de decidir entre login y la zona protegida. */
  hydrated: boolean;
  /** Miembros del taller: filas de `public.profiles` (role technician/admin). */
  users: User[];
  /** Taller actual resuelto desde la BD (Supabase workshops.id). */
  workshopId: string | null;
  inviteLink: InviteLink | null;
  /** Lista de invitaciones activas/pendientes del taller. */
  pendingInvitations: ServerInvitation[];
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
  /** Actualiza el % de comisión de un técnico (fracción, 0.30 = 30%). Solo el
   *  dueño. Devuelve false si no es admin o es el propio usuario. */
  updateTechnicianCommission: (id: string, commissionRate: number) => Promise<boolean>;
  /** Registra a un técnico invitado por enlace. Crea la cuenta REAL
   *  (role='technician' + workshop_id del taller del admin) y requiere
   *  confirmar el correo. */
  registerInvitedTechnician: (
    name: string,
    email: string,
    password: string,
    workshopId: string,
    workshopName: string,
    inviteToken?: string
  ) => Promise<{ ok: boolean; pendingVerification?: boolean; message?: string }>;
  /** Genera un enlace de invitación temporal para que un técnico se
   *  registre y quede automáticamente asociado al taller del admin. */
  generateInviteLink: (email?: string) => Promise<string | null>;
  /** Crea una invitación persistente segura con token en base de datos. */
  createTechnicianInvite: (
    email?: string,
    hours?: number
  ) => Promise<{ ok: boolean; url?: string; message?: string }>;
  /** Revoca una invitación activa. */
  revokeInvitation: (id: string) => Promise<boolean>;
  /** Refresca las invitaciones pendientes del taller. */
  fetchPendingInvitations: () => Promise<void>;
  /** Valida y consulta los detalles de una invitación mediante su token. */
  getInvitationDetails: (
    token: string
  ) => Promise<{
    ok: boolean;
    workshopName?: string;
    workshopId?: string;
    email?: string | null;
    expired?: boolean;
    message?: string;
  }>;
  /** Valida un token de invitación decodificado; devuelve el workshopId si es válido. */
  validateInviteLink: (encodedToken: string) => InviteValidation;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Límite estricto de técnicos por taller/entorno (requisito de licenciamiento). */
export const MAX_TECHNICIANS = 5;

/** Fila de `public.profiles` (PostgreSQL). No contiene email: vive en
 *  `auth.users` y no es consultable desde el cliente. */
interface ProfileRow {
  id: string;
  workshop_id: string;
  full_name: string | null;
  role: string;
  commission_rate: number | null;
  is_active: boolean | null;
  specialty?: string | null;
  joined_at?: string | null;
}

function profileRowToUser(row: ProfileRow): User {
  const role: 'admin' | 'technician' = row.role === 'admin' ? 'admin' : 'technician';
  return {
    id: row.id,
    name: row.full_name?.trim() || 'Técnico',
    email: '',
    role,
    commissionRate: typeof row.commission_rate === 'number' ? row.commission_rate : undefined,
    isActive: row.is_active ?? true,
  };
}

function profileToUser(p: SupabaseUserProfile, authoritativeRole?: 'admin' | 'technician'): User {
  const role: 'admin' | 'technician' =
    authoritativeRole ?? (p.role === 'admin' ? 'admin' : 'technician');
  return {
    id: p.id,
    name: p.name || 'Usuario',
    email: p.email,
    role,
    commissionRate: p.commission_rate,
    isActive: p.is_active ?? true,
  };
}

/**
 * Consulta el rol autoritativo directo de `public.profiles` para el usuario
 * actual (bypasseando el metadata de sesión desactualizado tras OAuth/RPC).
 */
async function fetchAuthoritativeRole(userId: string): Promise<'admin' | 'technician' | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  if (error || !data?.role) return null;
  return data.role === 'admin' ? 'admin' : 'technician';
}

/**
 * Reclama una invitación de taller pendiente (guardada en sessionStorage/localStorage)
 * si el usuario acaba de autenticarse (ej. tras redirección de Google OAuth o confirmación).
 */
async function checkAndClaimPendingInvite(): Promise<boolean> {
  // 1) Intentar con token seguro en string
  const tokenStr = getPendingInviteToken();
  if (tokenStr) {
    try {
      const { data, error } = await supabase.rpc('claim_technician_invitation', {
        p_token: tokenStr,
      });
      if (!error && (data as { ok?: boolean })?.ok) {
        clearPendingInviteToken();
        clearPendingInvite();
        return true;
      }
    } catch (err) {
      console.error('Error claiming technician invitation with token:', err);
    }
  }

  // 2) Fallback con token estructurado legacy
  const pending = getPendingInvite();
  if (pending?.token) {
    try {
      const { data, error } = await supabase.rpc('claim_technician_invitation', {
        p_token: pending.token,
      });
      if (!error && (data as { ok?: boolean })?.ok) {
        clearPendingInvite();
        return true;
      }
    } catch {
      // Fallback a claim_workshop_invitation si la función aún no estuviese migrada
      if (pending.workshopId) {
        try {
          const { data, error } = await supabase.rpc('claim_workshop_invitation', {
            p_workshop_id: pending.workshopId,
          });
          if (!error && (data as { ok?: boolean })?.ok) {
            clearPendingInvite();
            return true;
          }
        } catch {}
      }
    }
  }
  return false;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [inviteLink, setInviteLink] = useState<InviteLink | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<ServerInvitation[]>([]);

  const [hydrated, setHydrated] = useState(false);
  /** Error visible de hidratación (env faltante), o null. */
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Workshop id resuelto vía `resolveWorkshopId()` (ensure_workshop, SECURITY DEFINER). */
  const [workshopId, setWorkshopId] = useState<string | null>(null);

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
          .map((row) => {
            const user = profileRowToUser(row);
            // Blindaje de privacidad: si el usuario es técnico, no expone comisiones de colegas
            if (currentUser?.role === 'technician' && user.id !== currentUser.id) {
              user.commissionRate = undefined;
            }
            return user;
          })
      );
    }
  }, [currentUser?.role, currentUser?.id]);

  /** Consulta las invitaciones pendientes del taller (solo administradores). */
  const fetchPendingInvitations = useCallback(async (wid?: string) => {
    const targetWid = wid ?? workshopId;
    if (!targetWid || !isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from('workshop_invitations')
        .select('*')
        .eq('workshop_id', targetWid)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (!error && data) {
        setPendingInvitations(
          data.map((row: any) => ({
            id: row.id,
            workshop_id: row.workshop_id,
            invited_by: row.invited_by,
            email: row.email,
            token: row.token,
            role: row.role,
            status: row.status,
            expires_at: row.expires_at,
            created_at: row.created_at,
            url: buildInviteUrl(row.token),
          }))
        );
      }
    } catch {
      // Silenciosamente ignorar si la tabla aún no existe en el cliente
    }
  }, [workshopId]);

  // Hydrate: sesión de Supabase + miembros del taller desde `profiles`.
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
          await checkAndClaimPendingInvite();
          const role = await fetchAuthoritativeRole(profile.id);
          const usr = profileToUser(profile, role ?? undefined);
          setCurrentUser(usr);
        }
        const wid = await resolveWorkshopId();
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
          await fetchPendingInvitations(wid);
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
  }, [fetchPendingInvitations]);

  // Listener global de sesión de Supabase.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const profile = toProfile(session.user);
        (async () => {
          try {
            await checkAndClaimPendingInvite();
            const role = await fetchAuthoritativeRole(profile.id);
            setCurrentUser(profileToUser(profile, role ?? undefined));
            const wid = await resolveWorkshopId();
            if (typeof wid === 'string') {
              setWorkshopId(wid);
              await refreshUsers(wid);
              if (role === 'admin') {
                await fetchPendingInvitations(wid);
              }
            }
          } catch {
            // Ignorar
          }
        })();
      } else {
        setCurrentUser(null);
        setPendingInvitations([]);
      }
    });
    return () => subscription.unsubscribe();
  }, [refreshUsers, fetchPendingInvitations]);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const needle = email.trim().toLowerCase();
    const result = await supabaseSignInWithPassword(needle, password);
    if (result.ok) {
      await checkAndClaimPendingInvite();
      const role = await fetchAuthoritativeRole(result.user.id);
      const user = profileToUser(result.user, role ?? undefined);
      setCurrentUser(user);
      const wid = await resolveWorkshopId();
      if (typeof wid === 'string') {
        setWorkshopId(wid);
        await refreshUsers(wid);
        if (role === 'admin') {
          await fetchPendingInvitations(wid);
        }
      }
      return { ok: true, user };
    }
    return { ok: false, reason: result.reason };
  };

  const signInWithGoogle = async (auth: GoogleAuthResult): Promise<User | null> => {
    const { idToken } = auth;
    try {
      const result = await supabaseSignInWithGoogleIdToken(idToken);
      if (result.ok) {
        await checkAndClaimPendingInvite();
        const role = await fetchAuthoritativeRole(result.user.id);
        const user = profileToUser(result.user, role ?? undefined);
        setCurrentUser(user);
        const wid = await resolveWorkshopId();
        if (typeof wid === 'string') {
          setWorkshopId(wid);
          await refreshUsers(wid);
          if (role === 'admin') {
            await fetchPendingInvitations(wid);
          }
        }
        return user;
      }
    } catch {
      // Ignorar
    }
    return null;
  };

  const logout = async () => {
    if (isSupabaseConfigured) {
      await supabaseSignOut();
    }
    setCurrentUser(null);
    setPendingInvitations([]);
  };

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
    let wid = workshopId;
    if (!wid) {
      wid = await resolveWorkshopId();
      if (wid) setWorkshopId(wid);
    }
    if (!wid) {
      return { ok: false, reason: 'unknown', message: 'No se pudo resolver el taller actual.' };
    }

    const safeRate = Number.isFinite(commissionRate)
      ? Math.min(1, Math.max(0, commissionRate))
      : 0;

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
    await refreshUsers(wid);
    return { ok: true };
  };

  const deleteTechnician = async (id: string): Promise<boolean> => {
    if (!users.some((u) => u.id === id && u.role === 'technician')) {
      return false;
    }
    if (currentUser?.id === id) {
      return false;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Error soft-deleting technician:', error);
      return false;
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
    return true;
  };

  const updateTechnicianCommission = async (
    id: string,
    commissionRate: number
  ): Promise<boolean> => {
    if (currentUser?.role !== 'admin' || currentUser.id === id) {
      return false;
    }
    const safeRate = Math.min(1, Math.max(0, commissionRate));
    const { error } = await supabase
      .from('profiles')
      .update({ commission_rate: safeRate })
      .eq('id', id);

    if (error) {
      console.error('Error updating technician commission:', error);
      return false;
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, commissionRate: safeRate } : u))
    );
    return true;
  };

  /**
   * Registro de técnico invitado por enlace.
   */
  const registerInvitedTechnician = async (
    name: string,
    email: string,
    password: string,
    targetWorkshopId: string,
    targetWorkshopName: string,
    inviteToken?: string
  ): Promise<{ ok: boolean; pendingVerification?: boolean; message?: string }> => {
    if (inviteToken) {
      savePendingInviteToken(inviteToken);
    }
    const result = await supabaseSignUp(name, email, password, {
      role: 'technician',
      full_name: name,
      workshop_id: targetWorkshopId,
      workshop_name: targetWorkshopName,
    });
    if (!result.ok) {
      return { ok: false, message: result.message };
    }
    // Si la sesión quedó autenticada de inmediato, reclamamos el token directamente
    if (inviteToken) {
      try {
        await supabase.rpc('claim_technician_invitation', { p_token: inviteToken });
        clearPendingInviteToken();
      } catch {
        // Se reclamará en hidratación
      }
    }
    if (result.pendingVerification) {
      return { ok: true, pendingVerification: true };
    }
    return { ok: true };
  };

  const registerOwner = async (
    name: string,
    email: string,
    password: string
  ): Promise<{
    user: User | null;
    reason?: 'email' | 'device';
    pendingVerification?: boolean;
  }> => {
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

  const resendRegistration = async (email: string): Promise<boolean> => {
    if (!isSupabaseConfigured) return false;
    const resend = await supabaseResendRegistration(email);
    return resend.ok;
  };

  /**
   * Crea una invitación persistente segura en la base de datos.
   */
  const createTechnicianInvite = async (
    email?: string,
    hours: number = 24
  ): Promise<{ ok: boolean; url?: string; message?: string }> => {
    if (!currentUser || currentUser.role !== 'admin' || !workshopId) {
      return { ok: false, message: 'Solo el administrador del taller puede invitar técnicos.' };
    }
    const techCount = users.filter((u) => u.role === 'technician').length;
    if (techCount >= MAX_TECHNICIANS) {
      return { ok: false, message: `Límite alcanzado: el taller ya tiene el máximo de ${MAX_TECHNICIANS} técnicos.` };
    }

    try {
      const { data, error } = await supabase.rpc('create_technician_invitation', {
        p_email: email ? email.trim().toLowerCase() : null,
        p_hours: hours,
      });

      if (!error && data?.ok) {
        const url = buildInviteUrl(data.token);
        const linkObj: InviteLink = {
          token: data.token,
          workshopId: data.workshop_id,
          workshopName: currentUser.name,
          url,
          expiresAt: new Date(data.expires_at).getTime(),
          createdAt: Date.now(),
        };
        setInviteLink(linkObj);
        await fetchPendingInvitations();
        return { ok: true, url };
      }
      if (error) {
        console.warn('RPC create_technician_invitation falló, usando fallback local:', error);
      }
    } catch (err) {
      console.warn('Excepción en create_technician_invitation:', err);
    }

    // Fallback local compatible
    const localToken = generateInviteToken(workshopId, currentUser.name, email);
    const localUrl = buildInviteUrl(localToken);
    setInviteLink({
      token: localToken.token,
      workshopId,
      workshopName: currentUser.name,
      url: localUrl,
      expiresAt: localToken.expiresAt,
      createdAt: localToken.createdAt,
    });
    return { ok: true, url: localUrl };
  };

  /**
   * Genera enlace de invitación (wrapper para compatibilidad).
   */
  const generateInviteLink = async (email?: string): Promise<string | null> => {
    const res = await createTechnicianInvite(email);
    return res.ok ? res.url ?? null : null;
  };

  /**
   * Revoca una invitación activa en la base de datos.
   */
  const revokeInvitation = async (id: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('revoke_technician_invitation', {
        p_invitation_id: id,
      });
      if (!error && (data as { ok?: boolean })?.ok) {
        await fetchPendingInvitations();
        return true;
      }
    } catch (err) {
      console.error('Error revoking invitation:', err);
    }
    return false;
  };

  /**
   * Consulta detalles de una invitación (validez, taller, correo) con el servidor.
   */
  const getInvitationDetails = async (
    token: string
  ): Promise<{
    ok: boolean;
    workshopName?: string;
    workshopId?: string;
    email?: string | null;
    expired?: boolean;
    message?: string;
  }> => {
    if (!token) return { ok: false, message: 'Token requerido' };
    try {
      const { data, error } = await supabase.rpc('get_invitation_info', {
        p_token: token.trim(),
      });
      if (!error && data) {
        if (data.ok) {
          return {
            ok: true,
            workshopName: data.workshop_name,
            workshopId: data.workshop_id,
            email: data.email,
          };
        }
        return {
          ok: false,
          expired: data.reason === 'expired',
          message: data.message ?? 'Invitación no válida',
        };
      }
    } catch (err) {
      console.warn('RPC get_invitation_info no disponible, usando fallback local:', err);
    }

    // Fallback decodificación local
    const decoded = decodeInviteToken(token);
    if (decoded) {
      const val = validateInviteToken(decoded);
      if (val.valid) {
        return {
          ok: true,
          workshopName: val.workshopName,
          workshopId: val.workshopId,
          email: val.email,
        };
      }
      return {
        ok: false,
        expired: val.reason === 'expired',
        message: val.reason === 'expired' ? 'El enlace de invitación ha vencido' : 'Enlace inválido',
      };
    }

    return { ok: false, message: 'Enlace de invitación inválido o no reconocido' };
  };

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
        workshopId,
        inviteLink,
        pendingInvitations,
        loadError,
        login,
        signInWithGoogle,
        logout,
        registerOwner,
        resendRegistration,
        createTechnician,
        deleteTechnician,
        updateTechnicianCommission,
        registerInvitedTechnician,
        generateInviteLink,
        createTechnicianInvite,
        revokeInvitation,
        fetchPendingInvitations,
        getInvitationDetails,
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

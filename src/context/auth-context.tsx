import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

import type { GoogleAuthResult } from '@/lib/google-auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  supabaseRestoreSession,
  supabaseResendRegistration,
  supabaseSignInWithGoogleIdToken,
  supabaseSignInWithPassword,
  supabaseSignOut,
  supabaseSignUp,
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
  password: string;
  role: UserRole;
  email: string;
  /** Comisión del % del presupuesto (0.30 = 30%), solo para técnicos. */
  commissionRate?: number;
  deviceFingerprint?: string; // Simulate device block simulation
  isGoogle?: boolean; // Simulated Google account (no password needed)
  avatarUrl?: string; // Google profile picture
  googleId?: string; // Google subject id
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
  /** True cuando AsyncStorage terminó de hidratar usuarios/sesión y Supabase
   *  verificó si existe una sesión persistida. El router debe esperarlo antes
   *  de decidir entre login y la zona protegida. */
  hydrated: boolean;
  users: User[];
  license: LicenseInfo;
  inviteLink: InviteLink | null;
  blockedDevices: string[];
  switchUser: (userId: string) => void;
  /** Login real (Supabase) cuando está configurado; cae al pool demo local si
   *  no (p. ej. cuentas seed). Un correo sin verificar se bloquea con
   *  `reason: 'unconfirmed'` y NUNCA cae al pool local. */
  login: (email: string, password: string) => Promise<LoginResult>;
  /** Google: puentea el id_token a Supabase (crea/víncula la sesión). Sin
   *  Supabase configurado, simula el usuario Google localmente (demo). */
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
  /** Crea un técnico (Dueño). Devuelve { ok } o el motivo del rechazo. */
  createTechnician: (
    name: string,
    email: string,
    commissionRate: number
  ) => { ok: boolean; reason?: 'email' | 'limit' };
  /** Elimina un técnico. Devuelve false si no existe o es el usuario actual. */
  deleteTechnician: (id: string) => boolean;
  verifyLicense: (key: string) => boolean;
  renewSubscription: () => void;
  registerUser: (name: string, email: string, isOwner: boolean) => boolean;
  /** Genera un enlace de invitación temporal (10 min) para que un técnico se
   *  registre y quede automáticamente asociado al taller del admin. */
  generateInviteLink: () => string | null;
  /** Valida un token de invitación decodificado; devuelve el workshopId si es válido. */
  validateInviteLink: (encodedToken: string) => InviteValidation;
  simulateDeviceLock: (fingerprint: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USERS_STORAGE_KEY = 'techrepair.users.v1';
/** Persiste solo el id del usuario activo, para restaurar la sesión en reload/restart. */
const SESSION_STORAGE_KEY = 'techrepair.session.v1';

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

/** Pool local sin usuarios: la única forma de entrar es registrarse con Supabase. */
const SEED_USERS: User[] = [];

/** Convierte el perfil de Supabase en la forma local User de la app. */
function toLocalUser(profile: SupabaseUserProfile): User {
  return {
    id: profile.id,
    name: profile.name.trim() || profile.email.split('@')[0],
    password: '', // Supabase guarda el hash; la app no lo necesita.
    role: 'admin', // El dueño del taller crea técnicos desde el panel (demo).
    email: profile.email,
    isGoogle: profile.isGoogle,
    avatarUrl: profile.avatarUrl,
    googleId: profile.googleId,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>(SEED_USERS);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [blockedDevices, setBlockedDevices] = useState<string[]>(['DEV-FNG-HW-BAD6']); // Simulated blocklist
  const [inviteLink, setInviteLink] = useState<InviteLink | null>(null);

  // Default Licencia Inicial (90 días de evaluación). Para probar UI se puede
  // bajar a 9 días para disparar el contador.
  const [license, setLicense] = useState<LicenseInfo>(DEFAULT_LICENSE);

  const [hydrated, setHydrated] = useState(false);

  // Hydrate: pool local + sesión persistida de Supabase (una sola vez). La
  // sesión de Supabase es la fuente de verdad para `currentUser`.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let parsed: unknown = null;
        const [raw, profile] = await Promise.all([
          AsyncStorage.getItem(USERS_STORAGE_KEY).catch(() => null),
          supabaseRestoreSession(),
        ]);
        if (raw && !cancelled) {
          parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setUsers(parsed);
          }
        }
        // Al registrar un usuario real la sesión de Supabase se crea al
        // confirmar el correo; al recargar se restaura desde ahí.
        if (!cancelled && profile) {
          setCurrentUser(toLocalUser(profile));
        } else if (!cancelled && !profile) {
          // Session local demo (no hay Supabase configurado o sin sesión).
          const sessionRaw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
          if (sessionRaw) {
            try {
              const session = JSON.parse(sessionRaw) as { userId?: string } | null;
              const pool: User[] = Array.isArray(parsed) ? parsed : SEED_USERS;
              const resume = pool.find((u) => u.id === session?.userId);
              if (resume) {
                setCurrentUser(resume);
              }
            } catch (error) {
              console.error('Error restoring TechRepair session:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error loading TechRepair users:', error);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist the active session (user id only) so a web reload / app restart
  // keeps the user signed in. Source of truth for the user remains the users key.
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (currentUser) {
        AsyncStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({ userId: currentUser.id })
        ).catch((error) => console.error('Error saving TechRepair session:', error));
      } else {
        AsyncStorage.removeItem(SESSION_STORAGE_KEY).catch((error) =>
          console.error('Error clearing TechRepair session:', error)
        );
      }
    } catch (error) {
      console.error('Error saving TechRepair session:', error);
    }
  }, [currentUser, hydrated]);

  // Persist users after hydration so we never overwrite stored data with seeds.
  useEffect(() => {
    if (!hydrated) return;
    try {
      AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users)).catch(
        (error) => console.error('Error saving TechRepair users:', error)
      );
    } catch (error) {
      console.error('Error saving TechRepair users:', error);
    }
  }, [users, hydrated]);

  const switchUser = (userId: string) => {
    const found = users.find((u) => u.id === userId);
    if (found) {
      setCurrentUser(found);
    }
  };

  /** Resuelve un correo contra el pool demo local. */
  const localLogin = (email: string, password: string): User | null => {
    const needle = email.trim().toLowerCase();
    const found =
      users.find((u) => u.email.toLowerCase() === needle) ?? null;

    if (!found) {
      return null;
    }
    if (!found.isGoogle && found.password !== password) {
      return null;
    }
    return found;
  };

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const needle = email.trim().toLowerCase();
    // Reales con Supabase (requiere verificación previa del correo). Un correo
    // sin confirmar se bloquea aquí y NUNCA cae al pool local (demo).
    if (isSupabaseConfigured && needle.includes('@')) {
      const result = await supabaseSignInWithPassword(needle, password);
      if (result.ok) {
        const user = toLocalUser(result.user);
        setCurrentUser(user);
        return { ok: true, user };
      }
      if (result.reason === 'unconfirmed') {
        return { ok: false, reason: 'unconfirmed' };
      }
      // Si las credenciales no existen en Supabase (p. demo seeds) se cae al
      // pool local para no romper la experiencia demo.
    }
    const local = localLogin(needle, password);
    if (local) {
      setCurrentUser(local);
      return { ok: true, user: local };
    }
    return { ok: false, reason: 'invalid' };
  };

  /**
   * Google real: usa el id_token que google-auth.ts obtuvo del endpoint OAuth
   * y lo puentea a Supabase (`signInWithIdToken`), que crea o vincula la
   * sesión. Sin Supabase configurado, cae a la simulación local (demo).
   */
  const signInWithGoogle = async (auth: GoogleAuthResult): Promise<User | null> => {
    const { profile, idToken } = auth;
    if (isSupabaseConfigured) {
      try {
        const result = await supabaseSignInWithGoogleIdToken(idToken);
        if (result.ok) {
          const user = toLocalUser(result.user);
          setCurrentUser(user);
          return user;
        }
      } catch {
        // Fallback a local si el puente falla (red, token expirado, etc.)
      }
    }

    // === Simulación local (demo sin backend que vincular) ===
    const email = profile.email.trim().toLowerCase();
    if (!email) {
      return null;
    }
    let existing =
      users.find((u) => u.isGoogle && u.googleId === profile.googleId) ??
      users.find((u) => u.isGoogle && u.email.toLowerCase() === email) ??
      null;

    if (!existing) {
      const newGoogle: User = {
        id: 'g-' + Date.now().toString(),
        name: profile.name.trim() || email.split('@')[0].replace(/[._-]+/g, ' '),
        password: '',
        role: 'admin',
        email,
        isGoogle: true,
        avatarUrl: profile.picture,
        googleId: profile.googleId,
      };
      setUsers((prev) => [...prev, newGoogle]);
      existing = newGoogle;
    } else if (profile.picture && !existing.avatarUrl) {
      const enriched = { ...existing, avatarUrl: profile.picture };
      setUsers((prev) => prev.map((u) => (u.id === existing?.id ? enriched : u)));
      existing = enriched;
    }
    setCurrentUser(existing);
    return existing;
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
   * Creates a technician account (owner action). Rejects duplicates by email
   * and enforces the strict 5-technician limit per workshop.
   * Commission rate is a fraction (0.30 = 30%).
   */
  const createTechnician = (
    name: string,
    email: string,
    commissionRate: number
  ): { ok: boolean; reason?: 'email' | 'limit' } => {
    const normalizedEmail = email.trim().toLowerCase();
    const techCount = users.filter((u) => u.role === 'technician').length;
    if (techCount >= MAX_TECHNICIANS) {
      return { ok: false, reason: 'limit' };
    }
    const emailTaken = users.some(
      (u) => !u.isGoogle && u.email.toLowerCase() === normalizedEmail
    );
    if (emailTaken) {
      return { ok: false, reason: 'email' };
    }

    const safeRate = Number.isFinite(commissionRate)
      ? Math.min(1, Math.max(0, commissionRate))
      : 0;

    const newUser: User = {
      id: Date.now().toString(),
      name: name.trim(),
      email: normalizedEmail,
      password: 'tec-' + Math.random().toString(36).slice(2, 8),
      role: 'technician',
      commissionRate: safeRate,
      deviceFingerprint: 'DEV-FNG-HW-' + Math.floor(Math.random() * 9000 + 1000),
    };

    setUsers((prev) => [...prev, newUser]);
    return { ok: true };
  };

  /** Removes a technician account. Never the currently signed-in user. */
  const deleteTechnician = (id: string): boolean => {
    if (!users.some((u) => u.id === id && u.role === 'technician')) {
      return false;
    }
    if (currentUser?.id === id) {
      return false;
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
    return true;
  };

  const registerUser = (name: string, email: string, isOwner: boolean): boolean => {
    // Límite estricto de 5 técnicos por taller (no aplica al dueño/admin).
    if (!isOwner) {
      const techCount = users.filter((u) => u.role === 'technician').length;
      if (techCount >= MAX_TECHNICIANS) {
        return false; // Límite de técnicos alcanzado
      }
    }

    // Simulated Anti-Abuse device check (e.g. processor / footprint match)
    const simulatedFingerprint = 'DEV-FNG-HW-' + Math.floor(Math.random() * 9000 + 1000);

    // Check if this simulated hardware signature is in the blocklist
    if (blockedDevices.includes(simulatedFingerprint)) {
      return false; // Hardware blocked due to multiple account registrations
    }

    const newUser: User = {
      id: Date.now().toString(),
      name,
      email,
      password: 'demo123',
      role: isOwner ? 'admin' : 'technician',
      deviceFingerprint: simulatedFingerprint,
    };

    setUsers((prev) => [...prev, newUser]);
    setCurrentUser(newUser);

    if (isOwner) {
      // Set fresh 90-day initial license
      setLicense({
        isActive: true,
        licenseKey: 'EVAL-90DAYS-ACTIVE',
        plan: 'Licencia Inicial',
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        daysRemaining: 90,
      });
    }

    return true;
  };

  /**
   * Owner sign-up. Con Supabase: crea el usuario real y requiere confirmar el
   * correo con el enlace del email antes de poder iniciar sesión. Sin
   * Supabase, simula la cuenta localmente (demo).
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
    if (isSupabaseConfigured) {
      const result = await supabaseSignUp(name, email, password);
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
        const user = toLocalUser(result.user);
        setCurrentUser(user);
        return { user };
      }
      return { user: null };
    }

    // ── Simulación local (demo, sin backend) ──
    const simFingerprint = 'DEV-FNG-HW-' + Math.floor(Math.random() * 9000 + 1000);
    if (blockedDevices.includes(simFingerprint)) {
      return { user: null, reason: 'device' };
    }
    const emailTaken = users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase() && !u.isGoogle);
    if (emailTaken) {
      return { user: null, reason: 'email' };
    }

    const newUser: User = {
      id: Date.now().toString(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: 'admin',
      deviceFingerprint: simFingerprint,
    };

    setUsers((prev) => [...prev, newUser]);
    setCurrentUser(newUser);
    // Fresh 90-day initial license for the new workshop owner
    setLicense({
      isActive: true,
      licenseKey: 'EVAL-90DAYS-ACTIVE',
      plan: 'Licencia Inicial',
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      daysRemaining: 90,
    });

    return { user: newUser };
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
   * el nombre e ID del `currentUser`.
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

  const simulateDeviceLock = (fingerprint: string) => {
    if (!blockedDevices.includes(fingerprint)) {
      setBlockedDevices((prev) => [...prev, fingerprint]);
    }
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
        blockedDevices,
        switchUser,
        login,
        signInWithGoogle,
        logout,
        registerOwner,
        resendRegistration,
        createTechnician,
        deleteTechnician,
        verifyLicense,
        renewSubscription,
        registerUser,
        generateInviteLink,
        validateInviteLink,
        simulateDeviceLock,
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
import * as Crypto from 'expo-crypto';
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
  supabaseVerifyRegistration,
} from '@/lib/supabase-auth';
import type { SupabaseUserProfile } from '@/lib/supabase-auth';

export type UserRole = 'admin' | 'technician';

export interface User {
  id: string;
  name: string;
  password: string;
  role: UserRole;
  email: string;
  phone?: string;
  /** Comisión del % del presupuesto (0.30 = 30%), solo para técnicos. */
  commissionRate?: number;
  deviceFingerprint?: string; // Simulate device block simulation
  isGoogle?: boolean; // Simulated Google account (no password needed)
  avatarUrl?: string; // Google profile picture
  googleId?: string; // Google subject id
}

export interface LicenseInfo {
  isActive: boolean;
  licenseKey: string;
  plan: 'Prueba - 3 Meses' | 'Mensual - Pro' | 'Anual';
  expiresAt: string;
  daysRemaining: number;
}

export interface InviteLink {
  token: string;
  expiresAt: number; // timestamp
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
   *  no (p. ej. cuentas seed) o cuando el identificador es un teléfono. */
  login: (identifier: string, password: string) => Promise<User | null>;
  /** Google: puentea el id_token a Supabase (crea/víncula la sesión). Sin
   *  Supabase configurado, simula el usuario Google localmente (demo). */
  signInWithGoogle: (auth: GoogleAuthResult) => Promise<User | null>;
  logout: () => Promise<void>;
  registerOwner: (
    name: string,
    email: string,
    password: string,
    phone: string
  ) => Promise<{
    user: User | null;
    reason?: 'email' | 'phone' | 'device';
    /** True cuando hay que validar el correo con el código OTP (6 dígitos). */
    pendingVerification?: boolean;
  }>;
  /** Valida el código OTP del correo y abre la sesión real. */
  verifyRegistration: (email: string, code: string) => Promise<boolean>;
  /** Reenvía el código OTP del registro al correo. */
  resendRegistration: (email: string) => Promise<boolean>;
  /** Crea un técnico (Dueño). Devuelve { ok } o el motivo del rechazo. */
  createTechnician: (
    name: string,
    email: string,
    phone: string,
    commissionRate: number
  ) => { ok: boolean; reason?: 'email' | 'phone' };
  /** Elimina un técnico. Devuelve false si no existe o es el usuario actual. */
  deleteTechnician: (id: string) => boolean;
  verifyLicense: (key: string) => boolean;
  renewSubscription: () => void;
  registerUser: (name: string, email: string, phone: string, isOwner: boolean) => boolean;
  generateInviteLink: () => string;
  simulateDeviceLock: (fingerprint: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USERS_STORAGE_KEY = 'techrepair.users.v1';
/** Persiste solo el id del usuario activo, para restaurar la sesión en reload/restart. */
const SESSION_STORAGE_KEY = 'techrepair.session.v1';

const TRIAL_DURATION_DAYS = 90;
const TRIAL_EXPIRES_AT = new Date(Date.now() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000)
  .toISOString()
  .split('T')[0];

// Computed at module scope (not during render) to satisfy React purity rules.
const DEFAULT_LICENSE: LicenseInfo = {
  isActive: true,
  licenseKey: 'TRIAL-90DAYS-ACTIVE',
  plan: 'Prueba - 3 Meses',
  expiresAt: TRIAL_EXPIRES_AT,
  daysRemaining: TRIAL_DURATION_DAYS,
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
    phone: profile.phone,
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

  // Default Trial is 3 Months (90 days). For UI testing we can set it to 9 days to trigger the countdown.
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
        // verificar el OTP; al recargar se restaura desde ahí.
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

  /** Resuelve un identificador contra el pool demo local (correo/teléfono). */
  const localLogin = (identifier: string, password: string): User | null => {
    const needle = identifier.trim().toLowerCase();
    const found =
      users.find(
        (u) => u.email.toLowerCase() === needle || (u.phone ?? '').replace(/\s/g, '').toLowerCase() === needle.replace(/\s/g, '')
      ) ?? null;

    if (!found) {
      return null;
    }
    if (!found.isGoogle && found.password !== password) {
      return null;
    }
    return found;
  };

  const login = async (identifier: string, password: string): Promise<User | null> => {
    const needle = identifier.trim().toLowerCase();
    // Reales con Supabase (requiere verificación previa del correo). Si el
    // identificador es un teléfono no hay login con contraseña en Supabase
    // aún (requiere Twilio) -> demo local.
    if (isSupabaseConfigured && needle.includes('@')) {
      const result = await supabaseSignInWithPassword(needle, password);
      if (result.ok) {
        const user = toLocalUser(result.user);
        setCurrentUser(user);
        return user;
      }
      // Si las credenciales no existen en Supabase (p. demo seeds) se cae al
      // pool local para no romper la experiencia demo.
    }
    const local = localLogin(needle, password);
    if (local) {
      setCurrentUser(local);
      return local;
    }
    return null;
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
   * or phone. Commission rate is a fraction (0.30 = 30%).
   */
  const createTechnician = (
    name: string,
    email: string,
    phone: string,
    commissionRate: number
  ): { ok: boolean; reason?: 'email' | 'phone' } => {
    const normalizedEmail = email.trim().toLowerCase();
    const emailTaken = users.some(
      (u) => !u.isGoogle && u.email.toLowerCase() === normalizedEmail
    );
    if (emailTaken) {
      return { ok: false, reason: 'email' };
    }
    const phoneNormalized = phone.replace(/\s/g, '');
    const phoneTaken = users.some(
      (u) => (u.phone ?? '').replace(/\s/g, '') === phoneNormalized
    );
    if (phoneTaken) {
      return { ok: false, reason: 'phone' };
    }

    const safeRate = Number.isFinite(commissionRate)
      ? Math.min(1, Math.max(0, commissionRate))
      : 0;

    const newUser: User = {
      id: Date.now().toString(),
      name: name.trim(),
      email: normalizedEmail,
      phone: phoneNormalized,
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

  const registerUser = (name: string, email: string, phone: string, isOwner: boolean): boolean => {
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
      phone,
      password: 'demo123',
      role: isOwner ? 'admin' : 'technician',
      deviceFingerprint: simulatedFingerprint,
    };

    setUsers((prev) => [...prev, newUser]);
    setCurrentUser(newUser);

    if (isOwner) {
      // Set fresh 3-Month Trial
      setLicense({
        isActive: true,
        licenseKey: 'TRIAL-90DAYS-ACTIVE',
        plan: 'Prueba - 3 Meses',
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        daysRemaining: 90,
      });
    }

    return true;
  };

  /**
   * Owner sign-up. Con Supabase: crea el usuario real y requiere verificar el
   * correo con el código OTP (6 dígitos) antes de abrir la sesión. Sin
   * Supabase, simula la cuenta localmente (demo).
   */
  const registerOwner = async (
    name: string,
    email: string,
    password: string,
    phone: string
  ): Promise<{
    user: User | null;
    reason?: 'email' | 'phone' | 'device';
    pendingVerification?: boolean;
  }> => {
    if (isSupabaseConfigured) {
      const result = await supabaseSignUp(name, email, password, phone);
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
    const phoneNormalized = phone.replace(/\s/g, '');
    const phoneTaken = users.some((u) => (u.phone ?? '').replace(/\s/g, '') === phoneNormalized);
    if (phoneTaken) {
      return { user: null, reason: 'phone' };
    }

    const newUser: User = {
      id: Date.now().toString(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: 'admin',
      phone: phone.replace(/\s/g, ''),
      deviceFingerprint: simFingerprint,
    };

    setUsers((prev) => [...prev, newUser]);
    setCurrentUser(newUser);
    // Fresh 3-Month Trial for the new workshop owner
    setLicense({
      isActive: true,
      licenseKey: 'TRIAL-90DAYS-ACTIVE',
      plan: 'Prueba - 3 Meses',
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      daysRemaining: 90,
    });

    return { user: newUser };
  };

  /** Valida el código OTP (6 dígitos) enviado al correo y abre la sesión. */
  const verifyRegistration = async (email: string, code: string): Promise<boolean> => {
    if (!isSupabaseConfigured) return false;
    const verification = await supabaseVerifyRegistration(email, code);
    if (!verification.ok) return false;
    // La verificación creó la sesión: recarga el perfil real.
    const profile = await supabaseRestoreSession();
    if (!profile) {
      return false;
    }
    const user = toLocalUser(profile);
    setCurrentUser(user);
    setLicense({
      ...DEFAULT_LICENSE,
      expiresAt: new Date(Date.now() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      daysRemaining: TRIAL_DURATION_DAYS,
    });
    return true;
  };

  const resendRegistration = async (email: string): Promise<boolean> => {
    if (!isSupabaseConfigured) return false;
    const resend = await supabaseResendRegistration(email);
    return resend.ok;
  };

  const generateInviteLink = (): string => {
    // Cryptographically random token (not Math.random, which is predictable).
    const token = Crypto.randomUUID().toUpperCase();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes from now
    setInviteLink({ token, expiresAt });
    return `https://techrepair.saas/join?token=${token}&exp=${expiresAt}`;
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
        verifyRegistration,
        resendRegistration,
        createTechnician,
        deleteTechnician,
        verifyLicense,
        renewSubscription,
        registerUser,
        generateInviteLink,
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
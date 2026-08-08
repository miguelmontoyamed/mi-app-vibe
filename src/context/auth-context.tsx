import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

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
  /** True cuando AsyncStorage terminó de hidratar usuarios/sesión. El router
   *  debe esperarlo antes de decidir entre login y la zona protegida. */
  hydrated: boolean;
  users: User[];
  license: LicenseInfo;
  inviteLink: InviteLink | null;
  blockedDevices: string[];
  switchUser: (userId: string) => void;
  login: (identifier: string, password: string) => User | null;
  signInWithGoogle: (email: string) => User | null;
  logout: () => void;
  registerOwner: (
    name: string,
    email: string,
    password: string,
    phone: string
  ) => { user: User | null; reason?: 'email' | 'phone' | 'device' };
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

/** Usuarios seed usados hasta que exista un respaldo guardado en AsyncStorage. */
const SEED_USERS: User[] = [
  {
    id: '1',
    name: 'Carlos (Administrador Principal)',
    role: 'admin',
    password: 'admin123',
    email: 'carlos@techrepair.com',
    phone: '+573001112222',
    deviceFingerprint: 'DEV-FNG-HW-889X',
  },
  {
    id: '2',
    name: 'Luis Técnico (Hardware)',
    role: 'technician',
    password: 'tecnico123',
    email: 'luis@techrepair.com',
    phone: '+573001112223',
    commissionRate: 0.15,
    deviceFingerprint: 'DEV-FNG-HW-112Y',
  },
  {
    id: '3',
    name: 'Sofia Técnica (Software)',
    role: 'technician',
    password: 'tecnico123',
    email: 'sofia@techrepair.com',
    phone: '+573001112224',
    commissionRate: 0.2,
    deviceFingerprint: 'DEV-FNG-HW-334Z',
  },
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>(SEED_USERS);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [blockedDevices, setBlockedDevices] = useState<string[]>(['DEV-FNG-HW-BAD6']); // Simulated blocklist
  const [inviteLink, setInviteLink] = useState<InviteLink | null>(null);

  // Default Trial is 3 Months (90 days). For UI testing we can set it to 9 days to trigger the countdown.
  const [license, setLicense] = useState<LicenseInfo>(DEFAULT_LICENSE);

  const [hydrated, setHydrated] = useState(false);

  // Hydrate users from AsyncStorage (once) so technicians created by the owner
  // survive reloads. Mirrors the repair-context hydration pattern.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(USERS_STORAGE_KEY);
        let parsed: unknown = null;
        if (raw && !cancelled) {
          parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setUsers(parsed);
          }
        }
        // Restore the active session (user id) once the users pool is known.
        const sessionRaw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
        if (!cancelled && sessionRaw) {
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

  /** Signs in with email OR phone + password. Returns the user or null. */
  const login = (identifier: string, password: string): User | null => {
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
    setCurrentUser(found);
    return found;
  };

  /** Simulated Google account: finds an existing Google user or creates one. */
  const signInWithGoogle = (email: string): User | null => {
    const normalized = email.trim().toLowerCase();
    let existing =
      users.find((u) => u.isGoogle && u.email.toLowerCase() === normalized) ?? null;

    if (!existing) {
      const newGoogle: User = {
        id: 'g-' + Date.now().toString(),
        name: normalized.split('@')[0].replace(/[._-]+/g, ' '),
        password: '',
        role: 'admin',
        email: normalized,
        isGoogle: true,
      };
      setUsers((prev) => [...prev, newGoogle]);
      existing = newGoogle;
    }
    setCurrentUser(existing);
    return existing;
  };

  const logout = () => {
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
   * Owner sign-up (creates a workshop account). Rejects if the email OR phone
   * is already registered. Returns { success } shape for the UI.
   */
  const registerOwner = (
    name: string,
    email: string,
    password: string,
    phone: string
  ): { user: User | null; reason?: 'email' | 'phone' | 'device' } => {
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

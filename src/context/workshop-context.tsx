import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * Perfil del taller (membrete) que se imprime en los recibos de reparación.
 * Sigue el mismo patrón de persistencia que `repair-context.tsx`:
 * AsyncStorage local (clave `techrepair.*.v1`), con hidratación al montar y
 * guardado tras la hidratación para no pisar datos previos con los seeds.
 */
export interface WorkshopProfile {
  /** Nombre del taller (nombre del taller). */
  name: string;
  /** NIT colombiano: 9 dígitos + dígito de verificación (validado en el form). */
  nit: string;
  /** Dirección del taller. */
  address: string;
  /** Teléfono del taller. */
  phone: string;
}

interface WorkshopContextType {
  /** Perfil guardado, o null si el taller aún no lo ha configurado. */
  profile: WorkshopProfile | null;
  /** False hasta que AsyncStorage terminó de leer el perfil guardado. */
  hydrated: boolean;
  /** Persiste el perfil del taller (fuente única para el membrete del recibo). */
  saveProfile: (profile: WorkshopProfile) => void;
}

const WorkshopContext = createContext<WorkshopContextType | undefined>(undefined);

const STORAGE_KEY = 'techrepair.workshop.v1';

/** Guard estructural: solo acepta un objeto con los campos del perfil. */
function isWorkshopProfile(value: unknown): value is WorkshopProfile {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.nit === 'string' &&
    typeof candidate.address === 'string' &&
    typeof candidate.phone === 'string'
  );
}

export function WorkshopProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<WorkshopProfile | null>(null);
  /** False until stored data (if any) has been read, so we don't overwrite it. */
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from AsyncStorage (once). Guard keeps typing safe before/after.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && !cancelled) {
          const parsed: unknown = JSON.parse(raw);
          if (isWorkshopProfile(parsed)) {
            setProfile(parsed);
          }
        }
      } catch (error) {
        console.error('Error loading workshop profile:', error);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist after hydration so seeds never overwrite a stored profile.
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (profile) {
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile)).catch((error) =>
          console.error('Error saving workshop profile:', error)
        );
      } else {
        AsyncStorage.removeItem(STORAGE_KEY).catch((error) =>
          console.error('Error clearing workshop profile:', error)
        );
      }
    } catch (error) {
      console.error('Error saving workshop profile:', error);
    }
  }, [profile, hydrated]);

  const saveProfile = (next: WorkshopProfile) => {
    setProfile(next);
  };

  return (
    <WorkshopContext.Provider value={{ profile, hydrated, saveProfile }}>
      {children}
    </WorkshopContext.Provider>
  );
}

export function useWorkshop() {
  const context = useContext(WorkshopContext);
  if (!context) {
    throw new Error('useWorkshop must be used within a WorkshopProvider');
  }
  return context;
}
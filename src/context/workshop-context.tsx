import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import {
  assertSupabaseConfigured,
  getSupabaseEnvError,
  isSupabaseConfigured,
  resolveWorkshopId,
  supabase,
} from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';

/**
 * Perfil del taller (membrete) que se imprime en los recibos de reparación.
 * Persistencia en Supabase: una fila por taller en `public.workshop_profiles`
 * (columna `workshop_id` UNIQUE), con hidratación al montar una vez que el
 * usuario autenticado es conocido. Los usuarios demo locales (sin sesión
 * Supabase) mantienen el perfil solo en memoria.
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
  /** False hasta que Supabase terminó de leer el perfil guardado. */
  hydrated: boolean;
  /** Error visible de hidratación (env faltante o lectura fallida), o null. */
  loadError: string | null;
  /** Persiste el perfil del taller (fuente única para el membrete del recibo). */
  saveProfile: (profile: WorkshopProfile) => Promise<void>;
}

/** Fila de `public.workshop_profiles` (snake_case; address/phone nullable en la DB). */
interface WorkshopProfileRow {
  workshop_id: string;
  name: string;
  nit: string;
  address: string | null;
  phone: string | null;
}

const WorkshopContext = createContext<WorkshopContextType | undefined>(undefined);

export function WorkshopProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const userId = currentUser?.id ?? null;

  const [profile, setProfile] = useState<WorkshopProfile | null>(null);
  /** False until stored data (if any) has been read, so we don't overwrite it. */
  const [hydrated, setHydrated] = useState(false);
  /** Error visible de hidratación (env faltante o lectura fallida), o null. */
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Workshop id resuelto vía `resolveWorkshopId()` (ensure_workshop, SECURITY DEFINER). */
  const [workshopId, setWorkshopId] = useState<string | null>(null);

  /** Muestra un error visible en web (window.alert) o nativo (Alert.alert). */
  const notifyError = (message: string) => {
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert('Error', message);
    }
  };

  // Hydrate from Supabase once the authenticated user is known.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Cada hidratación arranca limpia para no heredar el perfil de otro
      // usuario (logout / switch de cuenta).
      setHydrated(false);
      setWorkshopId(null);
      setProfile(null);
      setLoadError(null);
      try {
        if (isSupabaseConfigured && userId) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const wid = await resolveWorkshopId();
            if (wid) {
              setWorkshopId(wid);
              const { data, error } = await supabase
                .from('workshop_profiles')
                .select('*')
                .eq('workshop_id', wid)
                .maybeSingle();
              if (!error && data) {
                if (cancelled) return;
                const row = data as WorkshopProfileRow;
                // Coerción obligatoria: la DB tiene address/phone nullable pero
                // la interfaz TS exige string (receipt/[id].tsx accede directo).
                setProfile({
                  name: row.name ?? '',
                  nit: row.nit ?? '',
                  address: row.address ?? '',
                  phone: row.phone ?? '',
                });
              }
            }
            // Si no hay fila (wid null o sin perfil guardado) el perfil queda null.
          }
        } else {
          if (!isSupabaseConfigured) setLoadError(getSupabaseEnvError());
        }
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Error al cargar el perfil del taller desde la nube.'
        );
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const saveProfile = async (next: WorkshopProfile): Promise<void> => {
    // 1. Validar que Supabase está configurado y que hay taller resuelto.
    let blockReason: string | null = null;
    try {
      assertSupabaseConfigured();
    } catch (e) {
      blockReason = e instanceof Error ? e.message : 'Supabase no está configurado.';
    }
    if (!blockReason && !workshopId) {
      blockReason = 'No se pudo resolver el taller. Inicia sesión de nuevo.';
    }
    if (blockReason) {
      notifyError(blockReason);
      return;
    }

    // 2. Persistir en Supabase y esperar la confirmación.
    const { error } = await supabase
      .from('workshop_profiles')
      .upsert(
        {
          workshop_id: workshopId as string,
          name: next.name,
          nit: next.nit,
          address: next.address || null,
          phone: next.phone || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workshop_id' }
      );

    if (error) {
      notifyError(`No se pudo guardar el perfil del taller: ${error.message}`);
      return;
    }

    // 3. Solo tras confirmación exitosa se actualiza el estado en pantalla.
    setProfile(next);
  };

  return (
    <WorkshopContext.Provider value={{ profile, hydrated, loadError, saveProfile }}>
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
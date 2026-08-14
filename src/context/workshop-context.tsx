import React, { createContext, useContext, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
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
  /** Persiste el perfil del taller (fuente única para el membrete del recibo). */
  saveProfile: (profile: WorkshopProfile) => void;
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
  /** Workshop id resuelto vía `current_workshop_id()` (SECURITY DEFINER). */
  const [workshopId, setWorkshopId] = useState<string | null>(null);

  // Hydrate from Supabase once the authenticated user is known.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Cada hidratación arranca limpia para no heredar el perfil de otro
      // usuario (logout / switch de cuenta).
      setHydrated(false);
      setWorkshopId(null);
      setProfile(null);
      try {
        if (isSupabaseConfigured && userId) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const { data: wid } = await supabase.rpc('current_workshop_id');
            if (typeof wid === 'string') {
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
  }, [userId]);

  const saveProfile = (next: WorkshopProfile) => {
    // Optimista: actualiza el estado local de inmediato.
    setProfile(next);
    // Sin Supabase configurado o sin taller resuelto: queda solo en memoria
    // (usuarios demo locales).
    if (!isSupabaseConfigured || !workshopId) return;
    supabase
      .from('workshop_profiles')
      .upsert(
        {
          workshop_id: workshopId,
          name: next.name,
          nit: next.nit,
          address: next.address || null,
          phone: next.phone || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workshop_id' }
      )
      .then(({ error }) => {
        if (error) console.error('Error saving workshop profile:', error);
      });
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
import { supabase } from '@/lib/supabase';

/**
 * Super Admin — acceso exclusivo del dueño de la plataforma.
 *
 * La RLS de `workshops` solo permite a cada taller leer/actualizar su propia
 * fila. Para que el dueño pueda listar TODOS los talleres y añadir 30 días
 * acumulables a cualquiera, se crearon dos RPC `SECURITY DEFINER`
 * (supabase/super-admin-rpcs.sql) que validan `auth.uid()` contra este uid y
 * ejecutan como el owner de la BD.
 */

/** UID del dueño de la plataforma (miguelmontoyamed@gmail.com). */
export const SUPER_ADMIN_USER_ID = 'ecb17edb-bf94-4b03-a798-28ef60b99720';

/** Fila de `public.workshops` devuelta por `list_all_workshops()`. */
export interface SuperAdminWorkshop {
  id: string;
  name: string;
  status: string | null;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  created_at: string | null;
}

/** Lista todos los talleres (solo para el uid del dueño; si no, RPC falla). */
export async function listAllWorkshops(): Promise<{
  data: SuperAdminWorkshop[] | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('list_all_workshops');
  return {
    data: (data as SuperAdminWorkshop[] | null) ?? null,
    error: error?.message ?? null,
  };
}

/**
 * Añade 30 días a un taller con acumulación inteligente: si el taller ya tiene
 * una fecha de expiración futura (subscription_ends_at o trial_ends_at), se
 * suman 30 días EXACTOS a esa fecha; si ya expiró, se suman 30 días desde
 * now(). Así N pagos seguidos = N*30 días acumulados. Solo el uid del dueño
 * puede ejecutarla (la RPC lo valida server-side).
 */
export async function activateWorkshop(
  workshopId: string
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.rpc('activate_workshop', {
    p_workshop_id: workshopId,
  });
  return { ok: !error, error: error?.message ?? null };
}
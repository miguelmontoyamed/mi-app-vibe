import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { useAuth } from '@/context/auth-context';
import {
  getSupabaseEnvError,
  isSupabaseConfigured,
  supabase,
} from '@/lib/supabase';
import type { BillingPeriod, TechnicianMonthlyPerformance } from '@/types/billing';

/**
 * Snapshot de un mes cerrado en `public.monthly_closures`.
 * Se conserva de forma permanente para verificación futura (totales del mes al
 * momento del cierre). La facturación arranca de inmediato en el mes nuevo: el
 * periodo abierto es el mes calendario actual, sin fila en `monthly_closures`.
 */
export interface MonthlyClosure {
  id: string;
  workshopId: string;
  /** Periodo cerrado en formato 'YYYY-MM' (mes de la columna `date`). */
  period: string;
  /** Suma de presupuestos de órdenes ENTREGADAS del mes (ingreso realizado). */
  revenue: number;
  /** Suma de costos de repuestos de órdenes entregadas del mes. */
  partsCost: number;
  /** Cantidad de órdenes entregadas en el mes. */
  deliveredCount: number;
  /** Cantidad de órdenes canceladas en el mes. */
  cancelledCount: number;
  /** Total de órdenes creadas en el mes (todos los estados). */
  totalCount: number;
  /** Cuándo se cerró el mes (ISO). */
  closedAt: string;
}

interface BillingContextType {
  /** Mes abierto actual ('YYYY-MM'); null sin sesión o taller. */
  currentPeriod: string | null;
  /** Cierres de meses anteriores, del más reciente al más antiguo. */
  closures: MonthlyClosure[];
  /** False hasta que se intentó el cierre/hidratación inicial. */
  hydrated: boolean;
  /** Error visible de carga desde la nube (null cuando todo salió bien). */
  loadError: string | null;
  /**
   * Ejecuta `ensure_month_closure()` (cierra meses vencidos pendientes y
   * devuelve el periodo abierto) y recarga la lista de cierres. Devuelve
   * { ok, error } con el motivo técnico exacto.
   */
  refresh: () => Promise<{ ok: boolean; error?: string }>;
  /**
   * Desglose mensual por técnico para un periodo ('YYYY-MM') vía la RPC
   * `get_technician_monthly_performance` (aislada por taller en la BD).
   * Devuelve { ok, data, error }: sin técnicos el array llega vacío.
   */
  fetchMonthlyPerformance: (
    period: BillingPeriod
  ) => Promise<{
    ok: boolean;
    data: TechnicianMonthlyPerformance[];
    error?: string;
  }>;
}

const BillingContext = createContext<BillingContextType | undefined>(undefined);

// ────────────────────────────────────────────────────────────────────────────
// Mapeo de filas Supabase (snake_case) ↔ estado local (camelCase)
// ────────────────────────────────────────────────────────────────────────────

/** Fila de `public.monthly_closures` tal como la devuelve Supabase. */
interface MonthlyClosureRow {
  id: string;
  workshop_id: string;
  period: string;
  revenue: number | null;
  parts_cost: number | null;
  delivered_count: number | null;
  cancelled_count: number | null;
  total_count: number | null;
  closed_at: string;
}

/** Fila que devuelve la RPC `get_technician_monthly_performance` (snake_case). */
interface TechnicianPerformanceRow {
  technician_id: string | null;
  technician_name: string | null;
  commission_rate: number | string | null;
  delivered_count: number | null;
  total_revenue: number | string | null;
  total_parts_cost: number | string | null;
  net_production: number | string | null;
  commission_total: number | string | null;
  workshop_net_profit: number | string | null;
}

/**
 * Mapea una fila de la RPC al contrato camelCase estricto de
 * `TechnicianMonthlyPerformance`. Los numeric de Postgres pueden llegar como
 * string según el driver: se normalizan SIEMPRE con Number().
 */
function rowToPerformance(row: TechnicianPerformanceRow): TechnicianMonthlyPerformance {
  const netProduction = Number(row.net_production ?? 0);
  const commissionTotal = Number(row.commission_total ?? 0);
  return {
    technicianId: row.technician_id,
    technicianName: row.technician_name ?? 'Sin asignar',
    commissionRate: Number(row.commission_rate ?? 0),
    deliveredCount: Number(row.delivered_count ?? 0),
    totalRevenue: Number(row.total_revenue ?? 0),
    totalPartsCost: Number(row.total_parts_cost ?? 0),
    netProduction,
    commissionTotal,
    workshopNetProfit: Number(row.workshop_net_profit ?? netProduction - commissionTotal),
  };
}

function rowToClosure(row: MonthlyClosureRow): MonthlyClosure {
  return {
    id: row.id,
    workshopId: row.workshop_id,
    period: row.period,
    revenue: Number(row.revenue ?? 0),
    partsCost: Number(row.parts_cost ?? 0),
    deliveredCount: Number(row.delivered_count ?? 0),
    cancelledCount: Number(row.cancelled_count ?? 0),
    totalCount: Number(row.total_count ?? 0),
    closedAt: row.closed_at,
  };
}

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const userId = currentUser?.id ?? null;

  const [currentPeriod, setCurrentPeriod] = useState<string | null>(null);
  const [closures, setClosures] = useState<MonthlyClosure[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  /**
   * Cierre de mes + carga de cierres históricos. El RPC es SECURITY DEFINER y
   * resuelve el taller desde la sesión (auth.uid() → profiles.workshop_id), por
   * lo que no hace falta pasar workshop_id: idempotente, cierra los meses
   * vencidos sin cierre y devuelve el periodo abierto ('YYYY-MM').
   */
  const refresh = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      const msg = getSupabaseEnvError() ?? 'Supabase no está configurado.';
      console.error('[billing-context] refresh bloqueado: ' + msg);
      return { ok: false, error: msg };
    }
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.user) {
      const msg = sessionError
        ? `Error de sesión: ${sessionError.message}`
        : 'Sin sesión activa de Supabase.';
      console.error('[billing-context] refresh bloqueado: ' + msg);
      return { ok: false, error: msg };
    }

    const { data: period, error: rpcError } = await supabase.rpc('ensure_month_closure');
    if (rpcError) {
      console.error(
        '[billing-context] ensure_month_closure falló: ' +
          JSON.stringify({ code: rpcError.code, message: rpcError.message, hint: rpcError.hint })
      );
      return { ok: false, error: `Error al cerrar el mes: ${rpcError.message}` };
    }
    if (typeof period === 'string' && period) {
      setCurrentPeriod(period);
    }

    const { data, error } = await supabase
      .from('monthly_closures')
      .select('*')
      .order('period', { ascending: false });
    if (error) {
      console.error(
        '[billing-context] select monthly_closures falló: ' +
          JSON.stringify({ code: error.code, message: error.message })
      );
      return { ok: false, error: `Error al cargar cierres de mes: ${error.message}` };
    }
    setClosures(((data ?? []) as MonthlyClosureRow[]).map(rowToClosure));
    return { ok: true };
  }, []);

  /**
   * Desglose mensual por técnico para un periodo ('YYYY-MM'). La RPC es
   * SECURITY DEFINER y resuelve el taller desde la sesión, así que el filtro
   * por workshop_id ocurre en la base de datos (nunca cross-taller).
   */
  const fetchMonthlyPerformance = useCallback(
    async (
      period: BillingPeriod
    ): Promise<{ ok: boolean; data: TechnicianMonthlyPerformance[]; error?: string }> => {
      if (!isSupabaseConfigured) {
        const msg = getSupabaseEnvError() ?? 'Supabase no está configurado.';
        console.error('[billing-context] fetchMonthlyPerformance bloqueado: ' + msg);
        return { ok: false, data: [], error: msg };
      }
      if (!/^\d{4}-\d{2}$/.test(period)) {
        const msg = `Periodo inválido: '${period}' (se espera YYYY-MM).`;
        console.error('[billing-context] ' + msg);
        return { ok: false, data: [], error: msg };
      }
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.user) {
        const msg = sessionError
          ? `Error de sesión: ${sessionError.message}`
          : 'Sin sesión activa de Supabase.';
        console.error('[billing-context] fetchMonthlyPerformance bloqueado: ' + msg);
        return { ok: false, data: [], error: msg };
      }
      const { data, error } = await supabase.rpc(
        'get_technician_monthly_performance',
        { p_period: period }
      );
      if (error) {
        console.error(
          '[billing-context] get_technician_monthly_performance falló: ' +
            JSON.stringify({ code: error.code, message: error.message, hint: error.hint })
        );
        return {
          ok: false,
          data: [],
          error: `Error al cargar el rendimiento mensual: ${error.message}`,
        };
      }
      return {
        ok: true,
        data: ((data ?? []) as TechnicianPerformanceRow[]).map(rowToPerformance),
      };
    },
    []
  );

  // Hidratación una vez por usuario: auto-cierra el mes vencido (si aplica) y
  // carga los cierres históricos. Sin Supabase o sin sesión: estado vacío.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setHydrated(false);
      setCurrentPeriod(null);
      setClosures([]);
      setLoadError(null);
      try {
        if (!isSupabaseConfigured) {
          if (!cancelled) {
            setLoadError(getSupabaseEnvError() ?? 'Supabase no está configurado.');
          }
          return;
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          return;
        }
        const result = await refresh();
        if (!cancelled && !result.ok) {
          setLoadError(result.error ?? 'Error al cargar cierres de mes.');
          setClosures([]);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[billing-context] hidratación falló:', error);
          setLoadError(error instanceof Error ? error.message : 'Error al cargar cierres de mes.');
          setClosures([]);
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, refresh]);

  return (
    <BillingContext.Provider
      value={{
        currentPeriod,
        closures,
        hydrated,
        loadError,
        refresh,
        fetchMonthlyPerformance,
      }}>
      {children}
    </BillingContext.Provider>
  );
}

export function useBilling() {
  const context = useContext(BillingContext);
  if (!context) {
    throw new Error('useBilling must be used within a BillingProvider');
  }
  return context;
}
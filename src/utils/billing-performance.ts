/**
 * Lógica pura del panel de Liquidación y Rendimiento Mensual por Técnico.
 *
 * Sin imports de React/React Native: testeable con `node --test`
 * (igual que `repair-logic.ts`). La fuente de verdad de los montos es la RPC
 * `get_technician_monthly_performance` en Supabase; aquí viven SOLO los
 * helpers de presentación (lista de periodos, resumen, etiquetas).
 */

import type {
  MonthlyBreakdownSummary,
  PeriodOption,
  TechnicianMonthlyPerformance,
} from '../types/billing';

/** Meses en español (es-CO) indexados por `Number(period.slice(5, 7)) - 1`. */
const MONTHS_ES: readonly string[] = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/** Forma estructural mínima de una orden para derivar periodos de entrega. */
export interface PerformanceRepairLike {
  status: string;
  budget: number;
  partsCost?: number;
  technicianId?: string;
  technicianName?: string;
  /** Fecha de entrega real (ISO) que estampa el trigger `trg_repairs_delivered_at`. */
  deliveredAt?: string;
  /** Fecha de la orden ('YYYY-MM-DD'). */
  date: string;
}

/** Regex del formato de periodo 'YYYY-MM' (misma validación de la BD). */
const PERIOD_REGEX = /^\d{4}-\d{2}$/;

/**
 * Mes calendario ('YYYY-MM') en el que se ENTREGÓ/cobró una orden.
 * Usa `deliveredAt` (fecha real de entrega) y, como fallback para datos
 * legacy sin la columna, la fecha de la orden cuando ya está entregada.
 * Devuelve null si la orden no está entregada o no se puede derivar mes.
 */
export function deliveryMonthOf(repair: PerformanceRepairLike): string | null {
  if (repair.status !== 'Entregado') {
    return null;
  }
  const source = repair.deliveredAt ?? repair.date;
  const month = typeof source === 'string' ? source.slice(0, 7) : '';
  return PERIOD_REGEX.test(month) ? month : null;
}

/**
 * Periodos disponibles para el selector: el mes en curso (facturación abierta)
 * más todos los meses con cierre archivado u órdenes entregadas. Ordenados
 * del más reciente al más antiguo, sin duplicados.
 */
export function buildAvailablePeriods(
  currentPeriod: string | null,
  closurePeriods: readonly string[],
  repairs: readonly PerformanceRepairLike[]
): string[] {
  const periods = new Set<string>();
  if (currentPeriod && PERIOD_REGEX.test(currentPeriod)) {
    periods.add(currentPeriod);
  }
  for (const p of closurePeriods) {
    if (PERIOD_REGEX.test(p)) {
      periods.add(p);
    }
  }
  for (const r of repairs) {
    const month = deliveryMonthOf(r);
    if (month) {
      periods.add(month);
    }
  }
  // 'YYYY-MM' ordena lexicográficamente igual que cronológicamente.
  return [...periods].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}

/**
 * Opciones del selector de periodo: etiqueta legible + bandera de archivo.
 * El primer periodo (más reciente) se muestra como "Mes Actual" cuando
 * coincide con `currentPeriod`.
 */
export function buildPeriodOptions(
  currentPeriod: string | null,
  closurePeriods: readonly string[],
  repairs: readonly PerformanceRepairLike[]
): PeriodOption[] {
  return buildAvailablePeriods(currentPeriod, closurePeriods, repairs).map(
    (period) => ({
      period,
      label: formatPeriodLabel(period),
      isCurrent: period === currentPeriod,
    })
  );
}

/** '2026-08' → 'Agosto 2026'. Devuelve el periodo crudo si el formato es inválido. */
export function formatPeriodLabel(period: string): string {
  if (!PERIOD_REGEX.test(period)) {
    return period;
  }
  const monthIndex = Number(period.slice(5, 7)) - 1;
  const month = MONTHS_ES[monthIndex];
  if (!month) {
    return period;
  }
  return `${month} ${period.slice(0, 4)}`;
}

/**
 * Resume el desglose por técnico en el estado que consume la UI:
 * totales globales del mes + técnicos ordenados por producción neta.
 * Los montos llegan YA calculados por la RPC; aquí solo se agregan.
 */
export function summarizePerformances(
  period: string,
  isArchived: boolean,
  performances: readonly TechnicianMonthlyPerformance[]
): MonthlyBreakdownSummary {
  let totalRevenue = 0;
  let totalPartsCost = 0;
  let totalCommissions = 0;
  for (const t of performances) {
    totalRevenue += t.totalRevenue;
    totalPartsCost += t.totalPartsCost;
    totalCommissions += t.commissionTotal;
  }
  return {
    period,
    isArchived,
    totalRevenue,
    totalPartsCost,
    totalCommissions,
    workshopNetProfit: totalRevenue - totalPartsCost - totalCommissions,
    technicians: [...performances].sort((a, b) =>
      a.netProduction === b.netProduction
        ? a.technicianName.localeCompare(b.technicianName)
        : b.netProduction - a.netProduction
    ),
  };
}

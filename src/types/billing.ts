/**
 * Tipos estrictos del módulo de Liquidación y Rendimiento Mensual por Técnico.
 *
 * Fuente de verdad en la nube: RPC `get_technician_monthly_performance(period)`
 * (SECURITY DEFINER, aislada por `workshop_id` vía RLS). Estos tipos describen
 * el contrato camelCase que consume la UI (`src/app/(tabs)/admin.tsx`).
 *
 * Convención de comisión: `commission_rate` es una FRACCIÓN (0.30 = 30%),
 * igual que `profiles.commission_rate` en la base de datos. La UI la muestra
 * multiplicada por 100.
 *
 * Regla $0 USD: tipos estructurales sin dependencias externas.
 */

/** Periodo de facturación en formato 'YYYY-MM' (mes calendario). */
export type BillingPeriod = string;

/**
 * Desglose mensual de UN técnico para un periodo ('YYYY-MM').
 * Espeja exactamente las columnas que devuelve la RPC
 * `get_technician_monthly_performance` (mapeadas a camelCase).
 */
export interface TechnicianMonthlyPerformance {
  /**
   * Id del técnico (`profiles.id`/auth.users.id como texto). Puede ser null
   * en órdenes legacy sin `technician_id` (se agrupan por nombre histórico).
   */
  technicianId: string | null;
  /** Nombre visible: perfil actual del taller o el nombre histórico de la orden. */
  technicianName: string;
  /** Comisión vigente del técnico (fracción 0–1; 0.30 = 30%). */
  commissionRate: number;
  /** Cantidad de órdenes ENTREGADAS cuyo mes de entrega coincide con el periodo. */
  deliveredCount: number;
  /** Total recaudado: suma de `budget` de esas órdenes (COP). */
  totalRevenue: number;
  /** Total invertido en repuestos: suma de `parts_cost` de esas órdenes (COP). */
  totalPartsCost: number;
  /** Producción neta del técnico: Σ max(budget − parts_cost, 0) (COP). */
  netProduction: number;
  /** Comisión a liquidar al técnico: Σ round(max(budget − parts_cost, 0) × rate) (COP). */
  commissionTotal: number;
  /** Ganancia neta del taller sobre este técnico: netProduction − commissionTotal (COP). */
  workshopNetProfit: number;
}

/**
 * Resumen global del mes + desglose por técnico. Alimenta la tarjeta de
 * resumen y las tarjetas individuales del panel de liquidación.
 */
export interface MonthlyBreakdownSummary {
  /** Periodo consultado ('YYYY-MM'). */
  period: string;
  /** true si el periodo ya está archivado en `monthly_closures` (solo lectura). */
  isArchived: boolean;
  /** Total facturado por el taller en el mes (suma de presupuestos entregados). */
  totalRevenue: number;
  /** Total invertido en repuestos del mes. */
  totalPartsCost: number;
  /** Total de comisiones por pagar a técnicos en el mes. */
  totalCommissions: number;
  /** Utilidad neta del taller: totalRevenue − totalPartsCost − totalCommissions. */
  workshopNetProfit: number;
  /** Desglose por técnico (ordenado por producción neta descendente). */
  technicians: TechnicianMonthlyPerformance[];
}

/** Opción del selector de periodo del panel de administración. */
export interface PeriodOption {
  /** Periodo en formato 'YYYY-MM'. */
  period: BillingPeriod;
  /** Etiqueta legible en es-CO (ej. "Agosto 2026"). */
  label: string;
  /** true si es el mes en curso (facturación abierta); false si está archivado. */
  isCurrent: boolean;
}

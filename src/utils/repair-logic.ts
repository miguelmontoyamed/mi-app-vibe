/**
 * Pure business logic for TechRepair Master.
 *
 * This module is intentionally free of React / React Native imports so it can
 * be unit-tested directly with `node --test` (Node's built-in type stripping).
 * Types are structural (no enums/namespaces) for the same reason.
 */

/**
 * Payment methods allowed by the workshop. All cobros — the advance at
 * reception and every payment registered in a job — MUST use one of these.
 */
export type PaymentMethod = 'Efectivo' | 'Transferencia' | 'Tarjeta';

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'Efectivo',
  'Transferencia',
  'Tarjeta',
];

/**
 * Motivos de cancelación sugeridos (legacy). Desde la v2 la cancelación
 * acepta TEXTO LIBRE obligatorio (`motivo_cancelacion`); esta lista se
 * conserva como atajo/quick-pick y para compatibilidad con datos previos.
 */
export type CancellationReason =
  | 'Fuera de presupuesto'
  | 'Sin reparación'
  | 'Repuesto no disponible'
  | 'Cliente retiró';

export const CANCELLATION_REASONS: readonly CancellationReason[] = [
  'Fuera de presupuesto',
  'Sin reparación',
  'Repuesto no disponible',
  'Cliente retiró',
];

export type RepairStatus =
  | 'Pendiente'
  | 'En Proceso'
  | 'Listo'
  | 'Entregado'
  | 'Cancelado / No Reparado';

/** Statuses that still represent open work (used for delete/bloqueos). */
export const ACTIVE_STATUSES: readonly RepairStatus[] = [
  'Pendiente',
  'En Proceso',
  'Listo',
];

/** Minimal structural shape of a repair, enough for the pure logic below. */
export interface RepairLike {
  id: string;
  status: RepairStatus;
  budget: number;
  advancePayment?: number;
  technicianId?: string;
  technicianName?: string;
}

/** Minimal structural shape of a user for the visibility rules. */
export interface ViewUser {
  id: string;
  name: string;
  role: 'admin' | 'technician';
}

/**
 * True when the repair belongs to the given technician. New data carries an
 * explicit technicianId; legacy records (AsyncStorage v1) have no id, so we
 * fall back to the pre-existing first-name matching used by the dashboard.
 */
export function isAssignedToTechnician(
  repair: RepairLike,
  technicianId: string,
  technicianName: string
): boolean {
  if (repair.technicianId) {
    return repair.technicianId === technicianId;
  }
  if (!repair.technicianName) {
    return false;
  }
  const firstName = technicianName.trim().split(' ')[0].toLowerCase();
  if (!firstName) {
    return false;
  }
  return repair.technicianName.toLowerCase().includes(firstName);
}

/**
 * Strict-privacy visibility rule:
 * - admin/owner sees every repair;
 * - a technician sees ONLY the repairs assigned to them.
 */
export function visibleRepairs<T extends RepairLike>(
  repairs: readonly T[],
  user: ViewUser
): T[] {
  if (user.role === 'admin') {
    return [...repairs];
  }
  return repairs.filter((r) =>
    isAssignedToTechnician(r, user.id, user.name)
  );
}

/**
 * Commission for a single repair: percentage of the budget, accrued only when
 * the job is delivered ('Entregado'). Rounded to whole COP.
 */
export function commissionForRepair(
  repair: RepairLike,
  rate: number
): number {
  if (repair.status !== 'Entregado') {
    return 0;
  }
  const safeRate = Number.isFinite(rate) ? rate : 0;
  return Math.round(repair.budget * safeRate);
}

/** Sum of commissions across repairs delivered to a technician. */
export function accumulatedCommission(
  repairs: readonly RepairLike[],
  technicianId: string,
  technicianName: string,
  rate: number
): number {
  return repairs
    .filter((r) => isAssignedToTechnician(r, technicianId, technicianName))
    .reduce((sum, r) => sum + commissionForRepair(r, rate), 0);
}

/**
 * Payment application rules. Returns how much was applied (never above the
 * remaining balance) plus the new advance and the new balance.
 */
export function applyPayment(
  advance: number,
  budget: number,
  amount: number
): { applied: number; newAdvance: number; remaining: number } {
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      applied: 0,
      newAdvance: advance,
      remaining: Math.max(0, budget - advance),
    };
  }
  const remaining = Math.max(0, budget - advance);
  const applied = Math.min(amount, remaining);
  const newAdvance = advance + applied;
  return {
    applied,
    newAdvance,
    remaining: Math.max(0, budget - newAdvance),
  };
}

/** A job can only be cancelled from an open (non-delivered) status. */
export function canCancel(status: RepairStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/**
 * A cancellation is valid when the job is in an open status AND the motivo
 * is a non-empty free-text string. The reason is REQUIRED (strict privacy of
 * the cancellation contract); the specific text is up to the user.
 */
export function isValidCancellation(
  status: RepairStatus,
  motivo: string | undefined | null | ''
): boolean {
  if (!canCancel(status)) {
    return false;
  }
  return typeof motivo === 'string' && motivo.trim().length > 0;
}

/** True when a technician still has open work (blocks account deletion). */
export function hasActiveRepairs(
  repairs: readonly RepairLike[],
  technicianId: string,
  technicianName: string
): boolean {
  return repairs.some(
    (r) =>
      isAssignedToTechnician(r, technicianId, technicianName) &&
      ACTIVE_STATUSES.includes(r.status)
  );
}
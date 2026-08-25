/**
 * monetization-trial.ts — Lógica pura de cálculo de periodo de prueba y expiración.
 */

export interface WorkshopSubscriptionRow {
  status: 'trial' | 'active' | 'expired' | null;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
}

/**
 * Calcula los días restantes del periodo de prueba.
 * Devuelve null si no está en estado 'trial' o no tiene fecha fin de prueba.
 */
export function calculateTrialDaysLeft(
  status: 'trial' | 'active' | 'expired' | null,
  trialEndsAt: string | null,
  currentTimestamp: number = Date.now()
): number | null {
  if (status !== 'trial' || !trialEndsAt) {
    return null;
  }
  const trialEndMs = new Date(trialEndsAt).getTime();
  if (!Number.isFinite(trialEndMs)) {
    return null;
  }
  const diffMs = trialEndMs - currentTimestamp;
  return Math.max(0, Math.ceil(diffMs / 86_400_000));
}

/**
 * Determina si debe mostrarse la alerta/banner de advertencia de los 10 días restantes.
 */
export function shouldShowTrialWarning(
  status: 'trial' | 'active' | 'expired' | null,
  trialEndsAt: string | null,
  currentTimestamp: number = Date.now(),
  warningThresholdDays: number = 10
): boolean {
  const daysLeft = calculateTrialDaysLeft(status, trialEndsAt, currentTimestamp);
  if (daysLeft === null) return false;
  return daysLeft <= warningThresholdDays;
}

/**
 * Determina si el taller está bloqueado por expiración.
 */
export function isWorkshopExpired(
  row: WorkshopSubscriptionRow | null,
  currentTimestamp: number = Date.now()
): boolean {
  if (!row) return false;
  if (row.status === 'expired') return true;

  if (row.subscription_ends_at) {
    const subEnd = new Date(row.subscription_ends_at).getTime();
    if (Number.isFinite(subEnd)) return currentTimestamp > subEnd;
  }

  if (row.trial_ends_at) {
    const trialEnd = new Date(row.trial_ends_at).getTime();
    if (Number.isFinite(trialEnd)) return currentTimestamp > trialEnd;
  }

  return false;
}

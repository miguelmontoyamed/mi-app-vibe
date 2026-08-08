/**
 * Currency helpers — the app works in Colombian Pesos (COP).
 * COP amounts are stored as plain numbers; this module formats them for display.
 */

const COP_FORMATTER = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Format a number as Colombian Pesos, e.g. 50000 -> "$ 50.000". */
export function formatCOP(value: number): string {
  return COP_FORMATTER.format(value);
}

/** Parse user input like "50.000" or "50000" back into a plain number. */
export function parseCOPInput(value: string): number | null {
  const cleaned = value.replace(/\s/g, '').replace(/\./g, '');
  if (!/^\d+$/.test(cleaned)) {
    return null;
  }
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

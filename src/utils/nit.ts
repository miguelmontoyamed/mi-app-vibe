/**
 * Validación del NIT colombiano (DIAN, módulo 11).
 *
 * Un NIT válido tiene 9 dígitos base + 1 dígito de verificación (DV). El DV
 * se calcula multiplicando cada dígito base por los pesos [3, 7, 13, 17, 19,
 * 23, 29, 37, 41, ...] empezando por la derecha (unidades con peso 3),
 * sumando los productos y aplicando módulo 11:
 *
 *   residuo = suma % 11
 *   DV = 11 - residuo   (si DV === 11 → 0; si DV === 10 → 1)
 *
 * Este módulo es puro (sin React / React Native) para poder testearse con
 * `node --test`, igual que `src/utils/repair-logic.ts`.
 */

/** Pesos DIAN para el NIT, aplicados de derecha a izquierda. */
const NIT_WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71] as const;

/** Longitud del NIT sin el dígito de verificación. */
const NIT_BASE_LENGTH = 9;

/** Longitud total: 9 dígitos base + 1 dígito de verificación. */
const NIT_TOTAL_LENGTH = 10;

/** Quita separadores comunes (puntos, espacios, guiones) de un NIT. */
export function normalizeNit(value: string): string {
  return value.replace(/[.\s-]/g, '');
}

/**
 * Dígito de verificación (DV) para los dígitos base de un NIT, según el
 * algoritmo módulo 11 de la DIAN. Espera una cadena de dígitos; si contiene
 * caracteres no numéricos devuelve NaN (y `isValidNit` lo rechaza).
 */
export function nitCheckDigit(baseDigits: string): number {
  let sum = 0;
  for (let i = baseDigits.length - 1, w = 0; i >= 0; i -= 1, w += 1) {
    sum += Number(baseDigits[i]) * NIT_WEIGHTS[w];
  }
  const dv = 11 - (sum % 11);
  if (dv === 11) return 0;
  if (dv === 10) return 1;
  return dv;
}

/**
 * True cuando el NIT tiene exactamente 9 dígitos base + un dígito de
 * verificación que coincide con el cálculo módulo 11 de la DIAN.
 */
export function isValidNit(value: string): boolean {
  const cleaned = normalizeNit(value);
  if (!/^\d{10}$/.test(cleaned)) {
    return false;
  }
  const base = cleaned.slice(0, NIT_BASE_LENGTH);
  const dv = Number(cleaned[NIT_BASE_LENGTH]);
  return nitCheckDigit(base) === dv;
}

/** Formatea un NIT como 999.999.999-9 (puntos + guion antes del DV). */
export function formatNit(value: string): string {
  const cleaned = normalizeNit(value);
  if (!/^\d{10}$/.test(cleaned)) {
    return value;
  }
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned[NIT_BASE_LENGTH]}`;
}

/** Longitud total exportada para los `maxLength` de los inputs del formulario. */
export const NIT_MAX_LENGTH = NIT_TOTAL_LENGTH;
/**
 * Validación del NIT colombiano (DIAN, módulo 11) — LONGITUD VARIABLE.
 *
 * El NIT NO siempre tiene 9 dígitos base: personas naturales usan su cédula
 * como base (puede tener menos de 9) y personas jurídicas suelen tener 9 o
 * más. El algoritmo módulo 11 de la DIAN funciona con cualquier longitud:
 *
 *   - Cada dígito base (de derecha a izquierda) se multiplica por los pesos
 *     [3, 7, 13, 17, 19, 23, 29, 37, 41, ...] (unidades con peso 3).
 *   - residuo = suma % 11
 *   - DV = 11 - residuo   (si DV === 11 → 0; si DV === 10 → 1)
 *
 * Aquí se aceptan de 1 a 15 dígitos base + 1 dígito de verificación, y el
 * formateo agrupa de a 3 desde la derecha (79.403.529-6, 800.197.268-4,
 * 1.234.567.890.123-8, ...).
 *
 * Este módulo es puro (sin React / React Native) para poder testearse con
 * `node --test`, igual que `src/utils/repair-logic.ts`.
 */

/** Pesos DIAN para el NIT, aplicados de derecha a izquierda. */
const NIT_WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71] as const;

/** Mínimo de dígitos base admitidos (sin el DV). */
export const NIT_MIN_BASE_LENGTH = 1;

/** Máximo de dígitos base admitidos (cubre los pesos DIAN declarados). */
export const NIT_MAX_BASE_LENGTH = 15;

/** Quita separadores comunes (puntos, espacios, guiones) de un NIT. */
export function normalizeNit(value: string): string {
  return value.replace(/[.\s-]/g, '');
}

/**
 * Dígito de verificación (DV) para los dígitos base de un NIT, según el
 * algoritmo módulo 11 de la DIAN. Espera una cadena de dígitos; si contiene
 * caracteres no numéricos devuelve NaN (y `isValidNit` lo rechaza). Los pesos
 * se reciclan si la base superara la tabla declarada (defensivo).
 */
export function nitCheckDigit(baseDigits: string): number {
  let sum = 0;
  for (let i = baseDigits.length - 1, w = 0; i >= 0; i -= 1, w += 1) {
    sum += Number(baseDigits[i]) * NIT_WEIGHTS[w % NIT_WEIGHTS.length];
  }
  const dv = 11 - (sum % 11);
  if (dv === 11) return 0;
  if (dv === 10) return 1;
  return dv;
}

/** Estructura válida: entre 1 y 15 dígitos base + 1 dígito de verificación. */
const NIT_SHAPE = new RegExp(`^\\d{${NIT_MIN_BASE_LENGTH + 1},${NIT_MAX_BASE_LENGTH + 1}}$`);

/**
 * True cuando el NIT tiene entre 1 y 15 dígitos base + un dígito de
 * verificación que coincide con el cálculo módulo 11 de la DIAN.
 */
export function isValidNit(value: string): boolean {
  const cleaned = normalizeNit(value);
  if (!NIT_SHAPE.test(cleaned)) {
    return false;
  }
  const base = cleaned.slice(0, -1);
  const dv = Number(cleaned[cleaned.length - 1]);
  return nitCheckDigit(base) === dv;
}

/** Formatea agrupando de a 3 desde la derecha: 79.403.529-6, 800.197.268-4… */
export function formatNit(value: string): string {
  const cleaned = normalizeNit(value);
  if (!NIT_SHAPE.test(cleaned)) {
    return value;
  }
  const base = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  const groups: string[] = [];
  for (let end = base.length; end > 0; end -= 3) {
    groups.unshift(base.slice(Math.max(0, end - 3), end));
  }
  return `${groups.join('.')}-${dv}`;
}

/**
 * Lógica pura del selector de seguridad del dispositivo (Patrón 3x3 / PIN).
 *
 * Formato de almacenamiento en `repairs.unlock_code` (columna existente, sin
 * migración): prefijos compatibles con los seeds históricos —
 *   - 'Patrón: 1-2-5-8-9'   (secuencia de nodos del patrón 3x3)
 *   - 'PIN: 1234'           (solo dígitos)
 *   - 'Contraseña: miPass1' (mezcla con letras)
 *   - 'No especificado' / '' → sin clave
 *
 * Módulo puro (sin React) para testearse con `node --test`.
 */

export type DeviceSecurityKind = 'none' | 'pin' | 'password' | 'pattern';

/** Cantidad de nodos de la cuadrícula 3x3 (numerados 1..9). */
export const PATTERN_NODE_COUNT = 9;

const PATTERN_PREFIX = 'Patrón:';
const PIN_PREFIX = 'PIN:';
const PASSWORD_PREFIX = 'Contraseña:';

/** Prefijos legacy que también significan contraseña ('Pass: mac2026'). */
const LEGACY_PASSWORD_PREFIXES = ['Pass:', 'Password:'] as const;

/** Valor para "sin clave" tal como lo guarda el formulario histórico. */
export const NO_SECURITY_VALUE = 'No especificado';

/**
 * Construye el valor almacenable para una secuencia de patrón.
 * Secuencia vacía → '' (sin clave). Nodos fuera de 1..9 se descartan.
 * Ej: [1,2,5,8,9] → 'Patrón: 1-2-5-8-9'
 */
export function buildPatternValue(sequence: readonly number[]): string {
  const clean = sequence.filter(
    (n) => Number.isInteger(n) && n >= 1 && n <= PATTERN_NODE_COUNT
  );
  if (clean.length === 0) {
    return '';
  }
  return `${PATTERN_PREFIX} ${clean.join('-')}`;
}

/**
 * Construye el valor almacenable para texto de PIN/contraseña.
 * Solo dígitos → 'PIN: <texto>'; con letras/símbolos → 'Contraseña: <texto>'.
 * Texto vacío → '' (sin clave).
 */
export function buildPinValue(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }
  if (/^\d+$/.test(trimmed)) {
    return `${PIN_PREFIX} ${trimmed}`;
  }
  return `${PASSWORD_PREFIX} ${trimmed}`;
}

/** Convierte el payload de un patrón ('1-2-5-8-9') a la lista de nodos. */
export function parsePatternSequence(payload: string): number[] {
  return payload
    .split('-')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= PATTERN_NODE_COUNT);
}

// ────────────────────────────────────────────────────────────────────────────
// Geometría de la cuadrícula 3x3 (compartida por el editor y la vista previa)
// ────────────────────────────────────────────────────────────────────────────

/** Punto en coordenadas relativas al contenedor cuadrado del patrón. */
export interface PatternPoint {
  x: number;
  y: number;
}

/**
 * Centros de los 9 nodos para un contenedor de lado `size`.
 * Nodo 1 arriba-izquierda, nodo 9 abajo-derecha (lectura natural).
 */
export function patternNodeCenters(size: number): PatternPoint[] {
  const cell = size / 3;
  return Array.from({ length: PATTERN_NODE_COUNT }, (_, i) => ({
    x: ((i % 3) + 0.5) * cell,
    y: (Math.floor(i / 3) + 0.5) * cell,
  }));
}

export interface PatternSegment {
  from: PatternPoint;
  to: PatternPoint;
}

/** Segmentos que conectan los nodos consecutivos de la secuencia. */
export function patternSegments(sequence: readonly number[], size: number): PatternSegment[] {
  const centers = patternNodeCenters(size);
  const segments: PatternSegment[] = [];
  for (let i = 1; i < sequence.length; i += 1) {
    const from = centers[sequence[i - 1] - 1];
    const to = centers[sequence[i] - 1];
    if (from && to) {
      segments.push({ from, to });
    }
  }
  return segments;
}

/**
 * Interpreta el valor guardado en `unlock_code`.
 * Devuelve kind + payload sin prefijo. Texto libre legacy se trata como
 * contraseña (así el técnico sigue viéndolo como clave legible).
 */
export function parseDeviceSecurity(value: string | null | undefined): {
  kind: DeviceSecurityKind;
  payload: string;
} {
  const raw = (value ?? '').trim();
  if (!raw || raw === NO_SECURITY_VALUE) {
    return { kind: 'none', payload: '' };
  }

  if (raw.startsWith(PATTERN_PREFIX)) {
    return { kind: 'pattern', payload: raw.slice(PATTERN_PREFIX.length).trim() };
  }
  if (raw.startsWith(PIN_PREFIX)) {
    return { kind: 'pin', payload: raw.slice(PIN_PREFIX.length).trim() };
  }
  for (const prefix of LEGACY_PASSWORD_PREFIXES) {
    if (raw.startsWith(prefix)) {
      return { kind: 'password', payload: raw.slice(prefix.length).trim() };
    }
  }
  if (raw.startsWith(PASSWORD_PREFIX)) {
    return { kind: 'password', payload: raw.slice(PASSWORD_PREFIX.length).trim() };
  }

  // Legacy de texto libre (ej: 'clave abc') → clave legible.
  return { kind: 'password', payload: raw };
}

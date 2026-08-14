/**
 * Generador de números de orden únicos, cortos y alfanuméricos para talleres.
 *
 * Formato: TRM-XXXX donde XXXX son 4 caracteres del charset reducido
 * (sin caracteres ambiguos: 0/O/I/L/1). Cada nuevo ID se genera con
 * `expo-crypto` para resistencia a colisiones criptográficas.
 *
 * El caller (repair-context) es responsable de verificar unicidad contra
 * los IDs existentes y reintentar si hay colisión.
 */

import * as Crypto from 'expo-crypto';

/** Caracteres sin ambigüedad visual: excluye 0, O, I, L, 1. */
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CHARSET_LENGTH = CHARSET.length;
const ID_LENGTH = 4;

/** Prefijo fijo del taller en todos los IDs de orden. */
export const ORDER_PREFIX = 'TRM';

/**
 * Genera un ID de orden alfanumérico corto (ej. TRM-K7XQ).
 *
 * Usa `Crypto.getRandomBytes` para una distribución uniforme sin sesgo
 * (evita `Math.random()`, predecible). El caller debe reintentar si el ID
 * ya existe en el conjunto activo de reparaciones.
 */
export function generateOrderId(): string {
  const bytes = Crypto.getRandomBytes(ID_LENGTH);
  let suffix = '';
  for (let i = 0; i < ID_LENGTH; i++) {
    // Cada byte se mapea uniformemente al charset reducido.
    suffix += CHARSET[bytes[i] % CHARSET_LENGTH];
  }
  return `${ORDER_PREFIX}-${suffix}`;
}
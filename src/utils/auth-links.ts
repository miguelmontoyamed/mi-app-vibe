/**
 * Utilidades de tokens de invitación seguros para asociar técnicos a talleres.
 *
 * Flujo:
 *   1. El admin (dueño) genera un InviteToken con su workshopId.
 *   2. El token se codifica (encodeURIComponent + JSON) y se incrusta en un
 *      enlace tipo deep link: `https://techrepair.saas/join?invite=...`
 *   3. El técnico abre el enlace; el signup detecta el parámetro `invite`,
 *      lo decodifica y valida que no haya expirado, y asocia automáticamente
 *      al técnico con el taller del admin.
 *
 * Mock de validación: sin Supabase configurado, la validación se hace contra
 * el estado local en AuthContext. La estructura está lista para migrar a
 * validación server-side (Supabase Edge Functions / RLS).
 */

/** 10 minutos en milisegundos. El token vence rápido para minimizar exposición. */
export const INVITE_EXPIRY_MS = 10 * 60 * 1000;

export interface InviteToken {
  /** UUID truncado a 16 caracteres (sin guiones, uppercase). */
  token: string;
  /** ID del usuario admin (dueño del taller) que generó la invitación. */
  workshopId: string;
  /** Nombre del taller para mostrar en el banner de invitación (UX amigable). */
  workshopName: string;
  /** Timestamp de expiración (epoch millis). */
  expiresAt: number;
  /** Timestamp de creación (epoch millis), para auditoría. */
  createdAt: number;
}

/**
 * Resultado de la validación de un token de invitación.
 * `valid: true` incluye el workshopId para asociar al nuevo técnico.
 */
export type InviteValidation =
  | { valid: true; workshopId: string; workshopName: string }
  | { valid: false; reason: 'expired' | 'malformed' | 'invalid' };

/**
 * Genera un token de invitación criptográficamente aleatorio.
 *
 * @param workshopId  ID del usuario admin (dueño del taller).
 * @param workshopName Nombre del taller (para UX en el banner de invitación).
 */
export function generateInviteToken(
  workshopId: string,
  workshopName: string
): InviteToken {
  const uuid =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const raw = uuid.replace(/-/g, '').slice(0, 16).toUpperCase();
  const now = Date.now();
  return {
    token: raw,
    workshopId,
    workshopName,
    expiresAt: now + INVITE_EXPIRY_MS,
    createdAt: now,
  };
}

/**
 * Codifica un `InviteToken` para incrustarlo en una URL.
 * Usa `encodeURIComponent(JSON.stringify(...))` → compatible con React Native
 * y web sin depender de `btoa` (que no existe en RN).
 */
export function encodeInviteToken(token: InviteToken): string {
  return encodeURIComponent(JSON.stringify(token));
}

/**
 * Decodifica un token desde el raw recibido por URL.
 * Devuelve `null` si el string no es un JSON válido de `InviteToken`.
 */
export function decodeInviteToken(encoded: string): InviteToken | null {
  try {
    // En web, `useLocalSearchParams` entrega el valor ya decodificado por
    // URLSearchParams; en nativo, expo-linking también lo decodifica. En ese
    // caso `decodeURIComponent` es un no-op y solo lanza si el valor crudo
    // contiene '%' (p. ej. un taller llamado "Taller 100% Mejor") → usamos el
    // valor crudo. Así soportamos tanto codificación simple como doble.
    let raw: string;
    try {
      raw = decodeURIComponent(encoded);
    } catch {
      raw = encoded;
    }
    const parsed: unknown = JSON.parse(raw);
    const t = parsed as Partial<InviteToken>;
    if (
      typeof t.token === 'string' &&
      typeof t.workshopId === 'string' &&
      typeof t.workshopName === 'string' &&
      typeof t.expiresAt === 'number' &&
      typeof t.createdAt === 'number'
    ) {
      return t as InviteToken;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Valida un `InviteToken`: comprueba que no haya expirado y que los campos
 * obligatorios existan.  Si expiró, devuelve `reason: 'expired'`.
 */
export function validateInviteToken(token: InviteToken): InviteValidation {
  if (Date.now() > token.expiresAt) {
    return { valid: false, reason: 'expired' };
  }
  return {
    valid: true,
    workshopId: token.workshopId,
    workshopName: token.workshopName,
  };
}

/**
 * Convierte un `InviteToken` en la URL completa que se le entrega al técnico.
 * - Web: `window.location.origin` + ruta `/signup` (localhost en dev, dominio
 *   desplegado en producción). El rewrite de vercel.json sirve el SPA.
 * - Nativo: deep link del scheme de la app (`miappvibe://signup?invite=...`).
 */
export function buildInviteUrl(token: InviteToken): string {
  const encoded = encodeInviteToken(token);
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/signup?invite=${encoded}`;
  }
  return `miappvibe://signup?invite=${encoded}`;
}

const PENDING_INVITE_STORAGE_KEY = 'trm_pending_invite_token';

/**
 * Guarda temporalmente el token de invitación en el almacenamiento del cliente
 * (sessionStorage / localStorage en web) para sobrevivir a redirecciones de OAuth
 * o confirmaciones de correo.
 */
export function savePendingInvite(token: InviteToken): void {
  try {
    const serialized = JSON.stringify(token);
    if (typeof window !== 'undefined') {
      window.sessionStorage?.setItem(PENDING_INVITE_STORAGE_KEY, serialized);
      window.localStorage?.setItem(PENDING_INVITE_STORAGE_KEY, serialized);
    }
  } catch {
    // Silenciosamente ignorar fallos de storage
  }
}

/**
 * Recupera y valida el token de invitación pendiente guardado en el cliente.
 * Si el token es inválido o expiró, lo descarta y retorna null.
 */
export function getPendingInvite(): InviteToken | null {
  try {
    if (typeof window !== 'undefined') {
      const raw =
        window.sessionStorage?.getItem(PENDING_INVITE_STORAGE_KEY) ??
        window.localStorage?.getItem(PENDING_INVITE_STORAGE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      const t = parsed as Partial<InviteToken>;
      if (
        typeof t.token === 'string' &&
        typeof t.workshopId === 'string' &&
        typeof t.workshopName === 'string' &&
        typeof t.expiresAt === 'number' &&
        typeof t.createdAt === 'number'
      ) {
        const validation = validateInviteToken(t as InviteToken);
        if (validation.valid) {
          return t as InviteToken;
        }
        // Expirado o inválido: limpiar
        clearPendingInvite();
      }
    }
  } catch {
    clearPendingInvite();
  }
  return null;
}

/**
 * Limpia el token de invitación pendiente del almacenamiento del cliente.
 */
export function clearPendingInvite(): void {
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage?.removeItem(PENDING_INVITE_STORAGE_KEY);
      window.localStorage?.removeItem(PENDING_INVITE_STORAGE_KEY);
    }
  } catch {
    // Silenciosamente ignorar fallos de storage
  }
}
/**
 * Utilidades de tokens de invitación seguros para asociar técnicos a talleres.
 *
 * Flujo blindado:
 *   1. El admin (dueño) genera una invitación en base de datos (`workshop_invitations`)
 *      con token criptográfico único (64 hex) y expiración de 24 horas.
 *   2. El enlace contiene el token seguro: `/signup?invite=<hex-token>`.
 *   3. Al abrir el enlace, el signup consulta la validez del token en el servidor
 *      (`get_invitation_info`) mostrando el taller y validando expiración/revocación.
 *   4. Al registrarse o entrar con Google, la cuenta se vincula mediante
 *      `claim_technician_invitation(token)`, marcando la invitación como usada (un solo uso).
 */

/** 24 horas en milisegundos. */
export const INVITE_EXPIRY_MS = 24 * 60 * 60 * 1000;

export interface InviteToken {
  /** Token criptográfico (hex o alfanumérico). */
  token: string;
  /** ID del usuario admin o taller que generó la invitación. */
  workshopId: string;
  /** Nombre del taller para mostrar en el banner de invitación. */
  workshopName: string;
  /** Timestamp de expiración (epoch millis). */
  expiresAt: number;
  /** Timestamp de creación (epoch millis). */
  createdAt: number;
  /** Correo específico al que se restringió la invitación (opcional). */
  email?: string | null;
}

/**
 * Resultado de la validación de un token de invitación.
 */
export type InviteValidation =
  | { valid: true; workshopId: string; workshopName: string; email?: string | null }
  | { valid: false; reason: 'expired' | 'malformed' | 'invalid' | 'revoked' | 'already_used' };

/**
 * Genera un token de invitación aleatorio (útil para fallback y tests locales).
 */
export function generateInviteToken(
  workshopId: string,
  workshopName: string,
  email?: string | null
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
    email: email ?? null,
    expiresAt: now + INVITE_EXPIRY_MS,
    createdAt: now,
  };
}

/**
 * Codifica un `InviteToken` para incrustarlo en una URL (compatibilidad legacy).
 */
export function encodeInviteToken(token: InviteToken): string {
  return encodeURIComponent(JSON.stringify(token));
}

/**
 * Decodifica un token desde el parámetro recibido por URL.
 * Soporta tanto objetos JSON codificados (legacy) como tokens directos.
 */
export function decodeInviteToken(encoded: string): InviteToken | null {
  if (!encoded || typeof encoded !== 'string') return null;
  try {
    let raw: string;
    try {
      raw = decodeURIComponent(encoded);
    } catch {
      raw = encoded;
    }

    // Si es un JSON serializado
    if (raw.trim().startsWith('{')) {
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
    }

    // Si es un token hexadecimal directo o alfanumérico limpio
    if (/^[A-Za-z0-9_-]{16,64}$/.test(raw.trim())) {
      return {
        token: raw.trim(),
        workshopId: '',
        workshopName: '',
        expiresAt: Date.now() + INVITE_EXPIRY_MS,
        createdAt: Date.now(),
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Valida un `InviteToken` localmente.
 */
export function validateInviteToken(token: InviteToken): InviteValidation {
  if (Date.now() > token.expiresAt) {
    return { valid: false, reason: 'expired' };
  }
  return {
    valid: true,
    workshopId: token.workshopId,
    workshopName: token.workshopName,
    email: token.email,
  };
}

/**
 * Convierte un `InviteToken` o string de token en la URL completa que se le entrega al técnico.
 */
export function buildInviteUrl(tokenOrObj: InviteToken | string): string {
  const tokenParam =
    typeof tokenOrObj === 'string'
      ? tokenOrObj
      : tokenOrObj.token.length >= 32
      ? tokenOrObj.token
      : encodeInviteToken(tokenOrObj);

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/signup?invite=${tokenParam}`;
  }
  return `miappvibe://signup?invite=${tokenParam}`;
}

const PENDING_INVITE_TOKEN_KEY = 'trm_pending_invite_token_str';
const PENDING_INVITE_STORAGE_KEY = 'trm_pending_invite_token';

/**
 * Guarda el token de invitación seguro en el almacenamiento del cliente.
 */
export function savePendingInviteToken(token: string): void {
  try {
    if (typeof window !== 'undefined' && token) {
      window.sessionStorage?.setItem(PENDING_INVITE_TOKEN_KEY, token);
      window.localStorage?.setItem(PENDING_INVITE_TOKEN_KEY, token);
    }
  } catch {
    // Ignorar fallos de storage
  }
}

/**
 * Obtiene el token de invitación pendiente.
 */
export function getPendingInviteToken(): string | null {
  try {
    if (typeof window !== 'undefined') {
      const token =
        window.sessionStorage?.getItem(PENDING_INVITE_TOKEN_KEY) ??
        window.localStorage?.getItem(PENDING_INVITE_TOKEN_KEY);
      if (token && typeof token === 'string') {
        return token.trim();
      }
    }
  } catch {
    // Ignorar
  }
  return null;
}

/**
 * Limpia el token de invitación pendiente del cliente.
 */
export function clearPendingInviteToken(): void {
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage?.removeItem(PENDING_INVITE_TOKEN_KEY);
      window.localStorage?.removeItem(PENDING_INVITE_TOKEN_KEY);
    }
  } catch {
    // Ignorar
  }
}

/**
 * Compatibilidad con guardado de objeto InviteToken.
 */
export function savePendingInvite(token: InviteToken): void {
  try {
    if (token.token) {
      savePendingInviteToken(token.token);
    }
    const serialized = JSON.stringify(token);
    if (typeof window !== 'undefined') {
      window.sessionStorage?.setItem(PENDING_INVITE_STORAGE_KEY, serialized);
      window.localStorage?.setItem(PENDING_INVITE_STORAGE_KEY, serialized);
    }
  } catch {
    // Silenciosamente ignorar fallos de storage
  }
}

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
        clearPendingInvite();
      }
    }
  } catch {
    clearPendingInvite();
  }
  return null;
}

export function clearPendingInvite(): void {
  clearPendingInviteToken();
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage?.removeItem(PENDING_INVITE_STORAGE_KEY);
      window.localStorage?.removeItem(PENDING_INVITE_STORAGE_KEY);
    }
  } catch {
    // Ignorar
  }
}

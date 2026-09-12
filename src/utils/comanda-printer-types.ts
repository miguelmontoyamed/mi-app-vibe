/**
 * Datos estructurados de la comanda, compartidos entre la implementación
 * nativa (expo-print) y la web (window.print).
 *
 * Separados en su propio módulo (sin dependencias de plataforma) para que
 * `comanda-printer.ts` (nativo) y `comanda-printer.web.ts` (web) puedan
 * importar los mismos tipos sin arrastrar librerías de la otra plataforma.
 */

/** Ancho del papel térmico / etiqueta. */
export type ComandaWidth = '58mm' | '80mm';

/** Todo lo que necesita la etiqueta: membrete + orden + cliente + equipo. */
export interface ComandaData {
  /** Nombre del taller (encabezado). */
  brand: string;
  /** Folio de la orden (p. ej. TRM-0001). */
  orderId: string;
  /** Fecha de ingreso (YYYY-MM-DD). */
  date: string;
  /** Fecha/hora de reimpresión (solo al reimprimir; ausente en la original). */
  reprintedAt?: string;
  /** Nombre del cliente. */
  clientName: string;
  /** Teléfono del cliente. */
  clientPhone: string;
  /** Dispositivo / equipo (marca, modelo y color en texto libre). */
  device: string;
  /** IMEI o serial (texto; se acepta número de lectoras de códigos). */
  imei?: string | number;
  /** PIN / contraseña o indicación del patrón (texto o PIN numérico). */
  unlockCode?: string | number;
  /** Falla reportada / observaciones de ingreso. */
  issue: string;
  /** Técnico asignado. */
  technicianName: string;
  /** Quien recibió el equipo. */
  receivedBy: string;
}

/**
 * Resultado de `printComanda` para que la pantalla dé feedback:
 * - 'printed'     → diálogo de impresión abierto (el usuario elige impresora).
 * - 'blocked'     → web: el navegador bloqueó la ventana emergente.
 * - 'unavailable' → impresión no disponible en este entorno.
 * - 'error'       → fallo generando o abriendo la impresión.
 */
export type ComandaPrintResult = 'printed' | 'blocked' | 'unavailable' | 'error';

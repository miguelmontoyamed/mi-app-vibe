/**
 * Datos estructurados del recibo, compartidos entre la implementación nativa
 * (expo-print + expo-sharing) y la web (jspdf + Web Share API).
 *
 * Separados en su propio módulo (sin dependencias de plataforma) para que
 * `receipt-pdf.ts` (nativo) y `receipt-pdf.web.ts` (web) puedan importar los
 * mismos tipos sin arrastrar librerías de la otra plataforma.
 */

/** Todo lo que necesita un recibo PDF: membrete + orden + cliente + equipo + valores. */
export interface ReceiptPdfData {
  /** Nombre del taller (membrete). */
  brand: string;
  /** NIT colombiano de longitud libre (1–15 base + DV), formateado con formatNit. */
  nit?: string;
  /** Dirección del taller. */
  address?: string;
  /** Teléfono del taller. */
  phone?: string;
  /** Folio de la orden (p. ej. TRM-0001). */
  orderId: string;
  /** Fecha de la orden (YYYY-MM-DD). */
  date: string;
  /** Estado actual de la reparación. */
  status: string;
  /** Nombre del cliente. */
  clientName: string;
  /** Teléfono del cliente. */
  clientPhone: string;
  /** Dispositivo / equipo reparado. */
  device: string;
  /** IMEI o serial (opcional). */
  imei?: string;
  /** Falla reportada. */
  issue: string;
  /** Nombre del técnico asignado. */
  technicianName: string;
  /** Total de la reparación en COP. */
  budget: number;
  /** Costo de repuestos en COP (0 = sin repuestos). */
  partsCost: number;
  /** Abono / pagos parciales ya cobrados en COP (0 = sin abono). */
  paid: number;
  /** Quién atendió (currentUser?.name ?? technicianName). */
  attendedBy: string;
  /** Número de WhatsApp del equipo comercial para el banner del recibo. */
  whatsappContact?: string;
}

/**
 * Resultado de `shareReceiptPdf` para que la pantalla pueda dar feedback:
 * - 'shared'      → el PDF se compartió (share sheet nativo o Web Share API).
 * - 'downloaded'  → web sin Web Share con archivos: el PDF se descargó.
 * - 'cancelled'   → el usuario canceló el share sheet (no es error).
 * - 'unavailable' → el dispositivo no tiene apps de compartir.
 * - 'error'       → fallo generando o compartiendo el PDF.
 */
export type ReceiptShareResult =
  | 'shared'
  | 'downloaded'
  | 'cancelled'
  | 'unavailable'
  | 'error';
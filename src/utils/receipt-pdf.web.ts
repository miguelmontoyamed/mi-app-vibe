/**
 * Generación y compartición del PDF del recibo en WEB.
 *
 * `expo-print` en web solo llama a `window.print()` y NO produce un archivo,
 * así que aquí se genera el PDF con `jspdf` (A4, misma maquetación que el
 * recibo HTML) y se comparte con la Web Share API (`navigator.share` con
 * archivos, que en móvil abre la hoja nativa con WhatsApp incluido), con
 * fallback a descarga directa del archivo en escritorio.
 *
 * El módulo NO importa `theme.ts` (arrastraría `global.css` + react-native y
 * rompería el test en Node), por eso los colores se declaran localmente.
 */

import { jsPDF } from 'jspdf';

import { formatCOP } from './format.ts';
import { formatNit } from './nit.ts';
import type { ReceiptPdfData, ReceiptShareResult } from './receipt-pdf-types.ts';

// tokens.colors.primary.default (#2563eb) + neutros del recibo HTML.
const BRAND_COLOR: [number, number, number] = [37, 99, 235];
const TEXT_DARK: [number, number, number] = [17, 24, 39];
const TEXT_MUTED: [number, number, number] = [55, 65, 81];
const BORDER: [number, number, number] = [209, 213, 219];
const BANNER_BG: [number, number, number] = [240, 247, 252];

const PAGE_W = 210; // A4 ancho en mm
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM_LIMIT = 270;
const LINE_H = 5.4;

/** Colores de estado en modo claro (misma semántica que StatusColors). */
const STATUS_COLOR: Record<string, [number, number, number]> = {
  Pendiente: [146, 64, 14],
  'En Proceso': [30, 64, 175],
  Listo: [6, 95, 70],
  Entregado: [55, 65, 81],
  'Cancelado / No Reparado': [153, 27, 27],
};

/**
 * Recorta caracteres fuera de WinAnsi (las fuentes estándar de jspdf solo
 * soportan ese repertorio; emojis o puntuación exótica saldrían corruptos).
 * Conserva acentos latinos (á é í ó ú ñ ¿ ¡) y guiones tipográficos.
 */
function winAnsi(value: string): string {
  return value.replace(/[^\x20-\x7E\u00A0-\u00FF\u2010-\u2015\u2018-\u201D]/g, '');
}

/**
 * Construye el PDF A4 del recibo desde datos estructurados (jspdf).
 * Maquetación espejo del recibo HTML: membrete centrado, secciones con
 * divisor, filas etiqueta/valor y banner comercial al final.
 */
export function buildReceiptPdf(data: ReceiptPdfData): Uint8Array<ArrayBuffer> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setProperties({ title: `Recibo ${data.orderId}` });

  let y = 26;

  /** Nueva página si el cursor se acerca al borde inferior. */
  const ensure = (needed: number) => {
    if (y + needed > BOTTOM_LIMIT) {
      doc.addPage();
      y = 26;
    }
  };

  const divider = () => {
    ensure(10);
    y += 3;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 5;
  };

  const section = (title: string) => {
    ensure(10);
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...BRAND_COLOR);
    doc.text(title.toUpperCase(), MARGIN, y);
    y += 5.5;
  };

  /** Fila etiqueta a la izquierda, valor (multilínea) alineado a la derecha. */
  const row = (
    label: string,
    value: string,
    opts?: { bold?: boolean; color?: [number, number, number] },
  ) => {
    const lines = doc.splitTextToSize(winAnsi(value), CONTENT_W * 0.55);
    const height = Math.max(1, lines.length) * LINE_H;
    ensure(height + 2);
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...(opts?.color ?? TEXT_DARK));
    doc.text(winAnsi(label), MARGIN, y);
    doc.text(lines, PAGE_W - MARGIN, y, { align: 'right' });
    y += height + 1.5;
  };

  // ── Membrete ─────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...BRAND_COLOR);
  doc.text(winAnsi(data.brand), PAGE_W / 2, y, { align: 'center' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_MUTED);
  if (data.nit) {
    doc.text(`NIT: ${winAnsi(formatNit(data.nit))}`, PAGE_W / 2, y, { align: 'center' });
    y += 4.5;
  }
  if (data.address) {
    const addrLines = doc.splitTextToSize(winAnsi(data.address), CONTENT_W);
    doc.text(addrLines, PAGE_W / 2, y, { align: 'center' });
    y += addrLines.length * 4.5;
  }
  if (data.phone) {
    doc.text(`Tel: ${winAnsi(data.phone)}`, PAGE_W / 2, y, { align: 'center' });
    y += 4.5;
  }

  divider();

  // ── Orden de trabajo ─────────────────────────────────────────────────────
  section('Orden de trabajo');
  row('# Orden:', data.orderId);
  row('Fecha:', data.date);
  row('Estado:', data.status, { bold: true, color: STATUS_COLOR[data.status] ?? TEXT_DARK });

  divider();

  // ── Cliente ──────────────────────────────────────────────────────────────
  section('Cliente');
  row('Nombre:', data.clientName);
  row('Teléfono:', data.clientPhone);

  divider();

  // ── Equipo / Servicio ────────────────────────────────────────────────────
  section('Equipo / Servicio');
  row('Dispositivo:', data.device);
  if (data.imei) {
    row('IMEI / Serial:', data.imei);
  }
  row('Falla reportada:', data.issue);
  row('Técnico:', data.technicianName || 'General');

  divider();

  // ── Valor a pagar ────────────────────────────────────────────────────────
  section('Valor a pagar');
  row('Total reparación:', formatCOP(data.budget), { bold: true });
  if (data.partsCost > 0) {
    row('Repuesto:', `- ${formatCOP(data.partsCost)}`);
  }
  if (data.paid > 0) {
    row('Abonado:', `- ${formatCOP(data.paid)}`);
  }

  divider();

  row('Atendido por:', data.attendedBy);

  // ── Banner comercial ─────────────────────────────────────────────────────
  if (data.whatsappContact) {
    ensure(26);
    y += 4;
    doc.setFillColor(...BANNER_BG);
    doc.setDrawColor(...BRAND_COLOR);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, y, CONTENT_W, 20, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...BRAND_COLOR);
    doc.text('Adquiere la Licencia de Facturación', MARGIN + 6, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_MUTED);
    const bannerLines = doc.splitTextToSize(
      `Contacta a nuestro equipo comercial: WhatsApp ${data.whatsappContact}`,
      CONTENT_W - 12,
    );
    doc.text(bannerLines, MARGIN + 6, y + 12);
  }

  return new Uint8Array(doc.output('arraybuffer'));
}

/**
 * Comparte el PDF del recibo en web:
 * 1. Web Share API con archivos (móvil: hoja nativa con WhatsApp incluido).
 * 2. Fallback en escritorio: descarga directa del PDF (el usuario lo adjunta
 *    en WhatsApp Web o correo).
 */
export async function shareReceiptPdf(
  data: ReceiptPdfData,
  _html?: string,
): Promise<ReceiptShareResult> {
  try {
    const bytes = buildReceiptPdf(data);
    const fileName = `recibo-${data.orderId.replace(/[^A-Za-z0-9_-]/g, '')}.pdf`;
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const file = new File([blob], fileName, { type: 'application/pdf' });

    const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
    if (nav.canShare && nav.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `Recibo ${data.orderId}` });
        return 'shared';
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return 'cancelled';
        }
        // Otro error de share → intenta la descarga directa.
      }
    }

    // Fallback: descargar el PDF.
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return 'downloaded';
  } catch (error) {
    console.error('Error generando el PDF del recibo (web):', error);
    return 'error';
  }
}
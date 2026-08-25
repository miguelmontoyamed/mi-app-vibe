/**
 * TechRepair Master — Generación de Factura / Comprobante de Venta de Equipos (Web jsPDF)
 */

import { jsPDF } from 'jspdf';

import type { DeviceReceiptPdfData, DeviceReceiptShareResult } from './device-receipt-types.ts';
import { formatCOP } from './format.ts';
import { formatNit } from './nit.ts';

const BRAND_COLOR: [number, number, number] = [37, 99, 235];
const TEXT_DARK: [number, number, number] = [17, 24, 39];
const TEXT_MUTED: [number, number, number] = [55, 65, 81];
const BORDER: [number, number, number] = [209, 213, 219];
const SUCCESS_COLOR: [number, number, number] = [6, 95, 70];
const BANNER_BG: [number, number, number] = [240, 247, 252];

const PAGE_W = 210;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM_LIMIT = 270;
const LINE_H = 5.4;

function winAnsi(value: string): string {
  return value.replace(/[^\x20-\x7E\u00A0-\u00FF\u2010-\u2015\u2018-\u201D]/g, '');
}

export function buildDeviceReceiptPdf(data: DeviceReceiptPdfData): Uint8Array<ArrayBuffer> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setProperties({ title: `Factura Venta ${data.invoiceFolio}` });

  let y = 26;

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

  const row = (
    label: string,
    value: string,
    opts?: { bold?: boolean; color?: [number, number, number] }
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

  // ── Factura de Venta ─────────────────────────────────────────────────────
  section('Factura de Venta de Equipo');
  row('# Factura / Folio:', data.invoiceFolio, { bold: true });
  row('Fecha de Venta:', data.saleDate);
  row('Método de Pago:', data.paymentMethod);

  divider();

  // ── Comprador ────────────────────────────────────────────────────────────
  section('Datos del Comprador');
  row('Cliente:', data.clientName);
  if (data.clientDocument) {
    row('Cédula / Documento:', data.clientDocument);
  }
  if (data.clientPhone) {
    row('Teléfono:', data.clientPhone);
  }

  divider();

  // ── Dispositivo Adquirido ────────────────────────────────────────────────
  section('Detalles del Dispositivo');
  row('Equipo:', `${data.brandDevice} ${data.model}`);
  if (data.storageCapacity || data.color) {
    const spec = [data.storageCapacity, data.color].filter(Boolean).join(' - ');
    row('Especificaciones:', spec);
  }
  row('IMEI / Serial:', data.imei, { bold: true });
  row('Condición del Equipo:', data.condition);

  divider();

  // ── Garantía y Condiciones ───────────────────────────────────────────────
  section('Garantía y Liquidación');
  row('Garantía Otorgada:', `${data.warrantyMonths} ${data.warrantyMonths === 1 ? 'mes' : 'meses'}`, {
    bold: true,
    color: SUCCESS_COLOR,
  });
  row('Vence el:', data.warrantyExpiry, { bold: true });
  row('Total Pagado:', formatCOP(data.salePrice), { bold: true });

  if (data.saleNotes) {
    divider();
    section('Observaciones');
    const notesLines = doc.splitTextToSize(winAnsi(data.saleNotes), CONTENT_W);
    ensure(notesLines.length * LINE_H + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(notesLines, MARGIN, y);
    y += notesLines.length * LINE_H + 2;
  }

  divider();

  row('Atendido por:', data.attendedBy);

  // ── Banner comercial y cláusula ──────────────────────────────────────────
  ensure(32);
  y += 4;
  doc.setFillColor(...BANNER_BG);
  doc.setDrawColor(...BRAND_COLOR);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, CONTENT_W, 24, 2, 2, 'FD');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND_COLOR);
  doc.text('POLÍTICA DE GARANTÍA DE EQUIPOS', PAGE_W / 2, y + 5.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_MUTED);
  const terms = 'La garantía cubre fallas técnicas de fábrica o funcionamiento del software. No cubre daños por humedad, golpes, sobrevoltaje ni manipulación de sellos de seguridad.';
  const termsLines = doc.splitTextToSize(terms, CONTENT_W - 8);
  doc.text(termsLines, PAGE_W / 2, y + 10.5, { align: 'center' });

  return new Uint8Array(doc.output('arraybuffer'));
}

export async function shareDeviceReceiptPdf(
  data: DeviceReceiptPdfData
): Promise<DeviceReceiptShareResult> {
  if (typeof window === 'undefined') return 'unavailable';

  try {
    const bytes = buildDeviceReceiptPdf(data);
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
    const filename = `Factura_${data.invoiceFolio}_${data.imei.slice(-6)}.pdf`;
    const file = new File([blob], filename, { type: 'application/pdf' });

    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          title: `Factura ${data.invoiceFolio} - ${data.brandDevice} ${data.model}`,
          text: `Hola ${data.clientName}, adjuntamos tu factura y garantía para tu equipo ${data.brandDevice} ${data.model} (IMEI: ${data.imei}).`,
          files: [file],
        });
        return 'shared';
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return 'cancelled';
        }
      }
    }

    // Fallback: descarga directa
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return 'downloaded';
  } catch (err) {
    console.error('Error generando o compartiendo PDF:', err);
    return 'error';
  }
}

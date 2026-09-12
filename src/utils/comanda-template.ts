/**
 * Plantilla HTML pura de la comanda de taller (etiqueta de identificación del
 * dispositivo). Sin dependencias de plataforma ni de tema: no importa
 * `theme.ts` para no arrastrar `global.css` + react-native y romper el test
 * en Node. Paleta monocromática de alto contraste para térmica y etiquetas.
 */

import type { ComandaData, ComandaWidth } from './comanda-printer-types.ts';

/** Escapa texto para incrustarlo seguro en el HTML. Tolera nulos,
 *  indefinidos y números (lectoras de códigos, payloads legacy). */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Construye el HTML autocontenido de la comanda (58mm u 80mm).
 * Escala 1:1 exacta: `@page` sin márgenes del driver y cuerpo limitado al
 * área imprimible real del rollo (54mm en 58mm, 76mm en 80mm). Todo en negro
 * puro sobre blanco (cero grises) para cabezal térmico.
 */
export function buildComandaHtml(data: ComandaData, width: ComandaWidth = '80mm'): string {
  const printable = width === '58mm' ? 54 : 76;
  const imeiStr = data.imei != null ? String(data.imei).trim() : '';
  const securityStr = data.unlockCode != null ? String(data.unlockCode).trim() : '';
  const imeiRow = imeiStr
    ? `<div class="row"><strong>IMEI / Serial:</strong><span>${escapeHtml(imeiStr)}</span></div>`
    : '';
  const securityRow = securityStr
    ? `<div class="row"><strong>Seguridad:</strong><span class="pin">${escapeHtml(securityStr)}</span></div>`
    : '';
  const reprintRow = data.reprintedAt?.trim()
    ? `<div class="row"><strong>Reimpreso:</strong><span>${escapeHtml(data.reprintedAt)}</span></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Comanda ${escapeHtml(data.orderId)}</title>
<style>
  @page { size: auto; margin: 0mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; padding: 2mm 3mm; width: 100%; max-width: ${printable}mm; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace, sans-serif; color: #000000; background: #ffffff; font-size: 12px; line-height: 1.25; }
  h1 { font-size: 12px; text-align: center; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 2mm; }
  .title { text-align: center; font-size: 11px; font-weight: 700; margin-bottom: 2mm; }
  .folio { text-align: center; font-size: 17px; font-weight: 900; border-top: 1px dashed #000000; border-bottom: 1px dashed #000000; padding: 2mm 1mm; margin: 2mm 0; letter-spacing: 0.02em; }
  .divider { border-bottom: 1px dashed #000000; margin: 2.5mm 0; }
  .row { display: flex; justify-content: space-between; gap: 3mm; font-size: 12px; line-height: 1.25; }
  .row strong { flex-shrink: 0; }
  .row span { text-align: right; overflow-wrap: anywhere; }
  .pin { font-size: 13px; font-weight: 900; letter-spacing: 1px; }
  .footer { text-align: center; font-size: 10px; margin-top: 2.5mm; border-top: 1px solid #000000; padding-top: 2mm; }
</style>
</head>
<body>
  <h1>${escapeHtml(data.brand)}</h1>
  <div class="title">--- COMANDA DE SERVICIO ---</div>
  <div class="folio">${escapeHtml(data.orderId)}</div>
  <div class="row"><strong>Ingreso:</strong><span>${escapeHtml(data.date)}</span></div>
  ${reprintRow}
  <div class="divider"></div>
  <div class="row"><strong>Cliente:</strong><span>${escapeHtml(data.clientName)}</span></div>
  <div class="row"><strong>Teléfono:</strong><span>${escapeHtml(data.clientPhone)}</span></div>
  <div class="divider"></div>
  <div class="row"><strong>Dispositivo:</strong><span>${escapeHtml(data.device)}</span></div>
  ${imeiRow}
  ${securityRow}
  <div class="row"><strong>Falla:</strong><span>${escapeHtml(data.issue)}</span></div>
  <div class="divider"></div>
  <div class="row"><strong>Técnico:</strong><span>${escapeHtml(data.technicianName)}</span></div>
  <div class="row"><strong>Recibido por:</strong><span>${escapeHtml(data.receivedBy)}</span></div>
  <div class="footer">Pegar en el dispositivo hasta su entrega</div>
</body>
</html>`;
}

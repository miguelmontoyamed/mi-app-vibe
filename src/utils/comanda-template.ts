/**
 * Plantilla HTML pura de la comanda de taller (etiqueta de identificación del
 * dispositivo). Sin dependencias de plataforma ni de tema: no importa
 * `theme.ts` para no arrastrar `global.css` + react-native y romper el test
 * en Node. Paleta monocromática de alto contraste para térmica y etiquetas.
 */

import type { ComandaData, ComandaWidth } from './comanda-printer-types.ts';

/** Escapa texto para incrustarlo seguro en el HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Construye el HTML autocontenido de la comanda (58mm u 80mm).
 * Incluye `@page` para que el diálogo de impresión use el ancho correcto.
 */
export function buildComandaHtml(data: ComandaData, width: ComandaWidth = '80mm'): string {
  const w = width === '58mm' ? 58 : 80;
  const imeiRow = data.imei?.trim()
    ? `<div class="row"><strong>IMEI / Serial:</strong><span>${escapeHtml(data.imei)}</span></div>`
    : '';
  const securityRow = data.unlockCode?.trim()
    ? `<div class="row"><strong>Seguridad:</strong><span>${escapeHtml(data.unlockCode)}</span></div>`
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
  @page { size: ${w}mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, monospace; color: #000; background: #fff; width: ${w}mm; padding: 3mm; }
  h1 { font-size: 11px; text-align: center; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 2mm; }
  .title { text-align: center; font-size: 10px; font-weight: 700; margin-bottom: 2mm; }
  .folio { text-align: center; font-size: 28px; font-weight: 900; border: 2px solid #000; border-radius: 2mm; padding: 2mm 1mm; margin: 2mm 0; letter-spacing: 0.02em; }
  .divider { border-top: 1px dashed #000; margin: 2.5mm 0; }
  .row { display: flex; justify-content: space-between; gap: 3mm; font-size: 9.5px; line-height: 1.6; }
  .row strong { flex-shrink: 0; }
  .row span { text-align: right; overflow-wrap: anywhere; }
  .footer { text-align: center; font-size: 8.5px; margin-top: 2.5mm; border-top: 1px solid #000; padding-top: 2mm; }
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

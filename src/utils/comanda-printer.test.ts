import { describe, it } from 'node:test';
import assert from 'node:assert';

import { buildComandaHtml, escapeHtml } from './comanda-template.ts';
import type { ComandaData } from './comanda-printer-types.ts';

const baseData: ComandaData = {
  brand: 'Taller Central',
  orderId: 'TRM-0042',
  date: '2026-09-10',
  clientName: 'Juan Pérez',
  clientPhone: '3001234567',
  device: 'Samsung Galaxy A54 Azul',
  imei: '350000000000001',
  unlockCode: 'PIN: 1234',
  issue: 'No enciende',
  technicianName: 'Pedro Técnico',
  receivedBy: 'Ana Admin',
};

describe('comanda-template', () => {
  it('incluye encabezado, título de comanda y folio gigante', () => {
    const html = buildComandaHtml(baseData);
    assert.ok(html.includes('Taller Central'));
    assert.ok(html.includes('--- COMANDA DE SERVICIO ---'));
    assert.ok(html.includes('TRM-0042'));
    assert.ok(html.includes('class="folio"'));
  });

  it('incluye cliente, dispositivo, seguridad, falla, técnico y quien recibió', () => {
    const html = buildComandaHtml(baseData);
    assert.ok(html.includes('Juan Pérez'));
    assert.ok(html.includes('3001234567'));
    assert.ok(html.includes('Samsung Galaxy A54 Azul'));
    assert.ok(html.includes('350000000000001'));
    assert.ok(html.includes('PIN: 1234'));
    assert.ok(html.includes('No enciende'));
    assert.ok(html.includes('Pedro Técnico'));
    assert.ok(html.includes('Ana Admin'));
    assert.ok(html.includes('Pegar en el dispositivo hasta su entrega'));
  });

  it('escapa HTML en los campos para no romper la etiqueta', () => {
    assert.strictEqual(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
    const html = buildComandaHtml({ ...baseData, clientName: '<b>Ana</b>', issue: 'Pantalla & táctil' });
    assert.ok(!html.includes('<b>Ana</b>'));
    assert.ok(html.includes('&lt;b&gt;Ana&lt;/b&gt;'));
    assert.ok(html.includes('Pantalla &amp; táctil'));
  });

  it('usa @page sin márgenes y área imprimible 1:1 por ancho', () => {
    const html80 = buildComandaHtml(baseData);
    assert.ok(html80.includes('size: auto'));
    assert.ok(html80.includes('margin: 0mm'));
    assert.ok(html80.includes('max-width: 76mm'));
    const html58 = buildComandaHtml(baseData, '58mm');
    assert.ok(html58.includes('max-width: 54mm'));
    assert.ok(!html58.includes('max-width: 76mm'));
    assert.ok(html80.includes('print-color-adjust: exact'));
  });

  it('destaca el folio con borde punteado y la seguridad en alto contraste', () => {
    const html = buildComandaHtml(baseData);
    assert.ok(html.includes('class="folio"'));
    assert.ok(html.includes('font-size: 17px'));
    assert.ok(html.includes('border-top: 1px dashed #000000'));
    assert.ok(html.includes('class="pin"'));
  });

  it('muestra Reimpreso solo cuando viene reprintedAt', () => {
    assert.ok(!buildComandaHtml(baseData).includes('Reimpreso:'));
    const html = buildComandaHtml({ ...baseData, reprintedAt: '2026-09-11 10:30' });
    assert.ok(html.includes('Reimpreso:'));
    assert.ok(html.includes('2026-09-11 10:30'));
  });

  it('omite IMEI y seguridad cuando vienen vacíos', () => {
    const html = buildComandaHtml({ ...baseData, imei: '', unlockCode: '  ' });
    assert.ok(!html.includes('IMEI / Serial:'));
    assert.ok(!html.includes('Seguridad:'));
  });
});

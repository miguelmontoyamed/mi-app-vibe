import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildReceiptPdf } from './receipt-pdf.web.ts';
import type { ReceiptPdfData } from './receipt-pdf-types.ts';

const SAMPLE: ReceiptPdfData = {
  brand: 'Taller Prueba',
  nit: '8001972684',
  address: 'Calle 1 # 2-3',
  phone: '+57 300 123 4567',
  orderId: 'TRM-0001',
  date: '2026-08-20',
  status: 'Entregado',
  clientName: 'Cliente Demo',
  clientPhone: '+57 311 000 0000',
  device: 'iPhone 13',
  imei: '123456789012345',
  issue: 'Pantalla rota',
  technicianName: 'Luis',
  budget: 200000,
  partsCost: 50000,
  paid: 100000,
  attendedBy: 'Admin',
  whatsappContact: '301 234 5678',
};

describe('buildReceiptPdf (web, jspdf)', () => {
  it('genera un PDF válido (magia %PDF)', () => {
    const bytes = buildReceiptPdf(SAMPLE);
    assert.ok(bytes.length > 500, `PDF debería tener contenido, tiene ${bytes.length} bytes`);
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    assert.equal(header, '%PDF-');
  });

  it('incluye el folio de la orden en los metadatos del documento', () => {
    const bytes = buildReceiptPdf(SAMPLE);
    const text = new TextDecoder().decode(bytes);
    assert.ok(text.includes('TRM-0001'), 'el folio debe aparecer en el PDF');
  });

  it('soporta caracteres especiales del español (ñ, acentos)', () => {
    const data: ReceiptPdfData = {
      ...SAMPLE,
      brand: 'Taller Añoñe',
      clientName: 'María José',
      issue: 'Pérdida de señal — no enciende',
    };
    const bytes = buildReceiptPdf(data);
    assert.ok(bytes.length > 500);
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    assert.equal(header, '%PDF-');
  });

  it('no revienta sin NIT, IMEI, repuestos ni abonos', () => {
    const data: ReceiptPdfData = {
      ...SAMPLE,
      nit: undefined,
      imei: undefined,
      partsCost: 0,
      paid: 0,
      whatsappContact: undefined,
    };
    const bytes = buildReceiptPdf(data);
    assert.ok(bytes.length > 500);
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    assert.equal(header, '%PDF-');
  });
});
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildDeviceReceiptPdf } from './device-receipt-pdf.web.ts';
import type { DeviceReceiptPdfData } from './device-receipt-types.ts';

const SAMPLE_DEVICE_RECEIPT: DeviceReceiptPdfData = {
  brand: 'TechRepair Master',
  nit: '8001972684',
  address: 'Carrera 43 # 70-120',
  phone: '+57 300 201 1801',
  invoiceFolio: 'VNT-5821',
  saleDate: '2026-08-25',
  paymentMethod: 'Transferencia',
  clientName: 'Alejandro Morales',
  clientDocument: '1048291039',
  clientPhone: '3009876543',
  brandDevice: 'Apple',
  model: 'iPhone 13 Pro',
  color: 'Azul Sierra',
  storageCapacity: '128GB',
  imei: '354892019283741',
  condition: 'Usado - Excelente',
  salePrice: 2450000,
  warrantyMonths: 3,
  warrantyExpiry: '2026-11-25',
  saleNotes: 'Se entrega con cargador original y estuche',
  attendedBy: 'Miguel Montoya',
  whatsappContact: '3002011801',
};

describe('buildDeviceReceiptPdf (web, jspdf)', () => {
  it('genera un PDF válido para venta de equipo (magia %PDF)', () => {
    const bytes = buildDeviceReceiptPdf(SAMPLE_DEVICE_RECEIPT);
    assert.ok(bytes.length > 500, `PDF debería tener contenido, tiene ${bytes.length} bytes`);
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    assert.equal(header, '%PDF-');
  });

  it('incluye el folio de la venta en los metadatos del documento', () => {
    const bytes = buildDeviceReceiptPdf(SAMPLE_DEVICE_RECEIPT);
    const text = new TextDecoder().decode(bytes);
    assert.ok(text.includes('VNT-5821'), 'el folio de venta debe aparecer en el PDF');
  });

  it('soporta caracteres especiales en español', () => {
    const data: DeviceReceiptPdfData = {
      ...SAMPLE_DEVICE_RECEIPT,
      brand: 'Taller San José & Compañía',
      clientName: 'Ñeque Gómez',
      saleNotes: 'Garantía válida según términos.',
    };
    const bytes = buildDeviceReceiptPdf(data);
    assert.ok(bytes.length > 500);
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    assert.equal(header, '%PDF-');
  });

  it('genera factura correctamente con campos opcionales omitidos', () => {
    const data: DeviceReceiptPdfData = {
      ...SAMPLE_DEVICE_RECEIPT,
      nit: undefined,
      address: undefined,
      phone: undefined,
      clientDocument: undefined,
      clientPhone: undefined,
      color: undefined,
      storageCapacity: undefined,
      saleNotes: undefined,
      whatsappContact: undefined,
    };
    const bytes = buildDeviceReceiptPdf(data);
    assert.ok(bytes.length > 500);
  });
});

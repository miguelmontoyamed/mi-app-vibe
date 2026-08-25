import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { Device } from '../types/device.ts';
import {
  calculateDeviceProfit,
  calculateWarrantyExpiry,
  isDeviceWarrantyActive,
  formatDeviceName,
  generateDeviceInvoiceFolio,
  filterDevices,
  calculateDeviceMetrics,
} from './device-logic.ts';

describe('device-logic utils', () => {
  describe('calculateDeviceProfit', () => {
    it('calcula la utilidad positiva correctamente', () => {
      assert.equal(calculateDeviceProfit(2500000, 1800000), 700000);
    });

    it('devuelve 0 si el precio de venta es menor al de compra', () => {
      assert.equal(calculateDeviceProfit(1500000, 1800000), 0);
    });

    it('devuelve 0 si el precio de venta es undefined o NaN', () => {
      assert.equal(calculateDeviceProfit(undefined, 1800000), 0);
      assert.equal(calculateDeviceProfit(NaN, 1800000), 0);
    });
  });

  describe('calculateWarrantyExpiry', () => {
    it('calcula la fecha de vencimiento sumando meses', () => {
      assert.equal(calculateWarrantyExpiry('2026-08-25', 3), '2026-11-25');
      assert.equal(calculateWarrantyExpiry('2026-11-15', 2), '2027-01-15');
      assert.equal(calculateWarrantyExpiry('2026-01-10', 12), '2027-01-10');
    });

    it('devuelve la fecha original si meses es 0 o negativo', () => {
      assert.equal(calculateWarrantyExpiry('2026-08-25', 0), '2026-08-25');
      assert.equal(calculateWarrantyExpiry('2026-08-25', -1), '2026-08-25');
    });
  });

  describe('isDeviceWarrantyActive', () => {
    it('detecta si una garantía está vigente o expirada', () => {
      assert.equal(isDeviceWarrantyActive('2026-12-31', '2026-08-25'), true);
      assert.equal(isDeviceWarrantyActive('2026-08-25', '2026-08-25'), true);
      assert.equal(isDeviceWarrantyActive('2026-08-20', '2026-08-25'), false);
      assert.equal(isDeviceWarrantyActive(undefined, '2026-08-25'), false);
    });
  });

  describe('formatDeviceName', () => {
    it('formatea nombre completo con capacidad y color', () => {
      assert.equal(
        formatDeviceName('Apple', 'iPhone 13 Pro', '128GB', 'Azul Sierra'),
        'Apple iPhone 13 Pro 128GB (Azul Sierra)'
      );
      assert.equal(
        formatDeviceName('Samsung', 'S22 Ultra', '256GB'),
        'Samsung S22 Ultra 256GB'
      );
      assert.equal(
        formatDeviceName('Xiaomi', 'Redmi Note 11'),
        'Xiaomi Redmi Note 11'
      );
    });
  });

  describe('generateDeviceInvoiceFolio', () => {
    it('genera un folio con prefijo VNT por defecto', () => {
      const folio = generateDeviceInvoiceFolio();
      assert.match(folio, /^VNT-\d{4}$/);
    });
  });

  describe('filterDevices & calculateDeviceMetrics', () => {
    const mockDevices: Device[] = [
      {
        id: '1',
        workshopId: 'w1',
        brand: 'Apple',
        model: 'iPhone 12',
        color: 'Negro',
        storageCapacity: '64GB',
        imei: '354892019283741',
        condition: 'Usado - Excelente',
        distributor: 'Celulares Medellín',
        purchasePrice: 1200000,
        supplierWarrantyMonths: 1,
        purchaseDate: '2026-08-10',
        status: 'En Stock',
        createdAt: '2026-08-10T10:00:00Z',
        updatedAt: '2026-08-10T10:00:00Z',
      },
      {
        id: '2',
        workshopId: 'w1',
        brand: 'Samsung',
        model: 'Galaxy A54',
        color: 'Verde',
        storageCapacity: '128GB',
        imei: '869402847192847',
        condition: 'Nuevo',
        distributor: 'DistriTech',
        purchasePrice: 900000,
        supplierWarrantyMonths: 6,
        purchaseDate: '2026-08-15',
        status: 'Vendido',
        salePrice: 1300000,
        saleDate: '2026-08-20',
        clientName: 'Carlos Mendoza',
        clientPhone: '3001234567',
        clientDocument: '1048291029',
        clientWarrantyMonths: 3,
        clientWarrantyExpiry: '2026-11-20',
        paymentMethod: 'Transferencia',
        invoiceFolio: 'VNT-1002',
        createdAt: '2026-08-15T10:00:00Z',
        updatedAt: '2026-08-20T10:00:00Z',
      },
    ];

    it('filtra por IMEI exacto o parcial', () => {
      const result = filterDevices(mockDevices, '354892', 'Todos');
      assert.equal(result.length, 1);
      assert.equal(result[0].brand, 'Apple');
    });

    it('filtra por cliente o folio de venta', () => {
      const byClient = filterDevices(mockDevices, 'Mendoza', 'Todos');
      assert.equal(byClient.length, 1);
      assert.equal(byClient[0].id, '2');

      const byFolio = filterDevices(mockDevices, 'VNT-1002', 'Todos');
      assert.equal(byFolio.length, 1);
    });

    it('filtra por estado', () => {
      const inStock = filterDevices(mockDevices, '', 'En Stock');
      assert.equal(inStock.length, 1);
      assert.equal(inStock[0].status, 'En Stock');

      const sold = filterDevices(mockDevices, '', 'Vendido');
      assert.equal(sold.length, 1);
      assert.equal(sold[0].status, 'Vendido');
    });

    it('calcula métricas de compra y venta correctamente e independientemente', () => {
      const metrics = calculateDeviceMetrics(mockDevices);
      assert.equal(metrics.totalInStock, 1);
      assert.equal(metrics.totalInvestedStock, 1200000);
      assert.equal(metrics.totalSold, 1);
      assert.equal(metrics.totalRevenueSold, 1300000);
      assert.equal(metrics.totalProfit, 400000); // 1.300.000 - 900.000
    });
  });
});

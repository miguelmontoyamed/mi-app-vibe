/**
 * TechRepair Master — Lógica Pura para Compra y Venta de Equipos
 * Funciones puras, matemáticas exactas en COP, sin efectos secundarios.
 */

import type { Device, DeviceMetrics, DeviceStatus } from '../types/device.ts';

/** Calcula la utilidad neta generada por una venta de equipo. */
export function calculateDeviceProfit(salePrice: number | undefined, purchasePrice: number): number {
  if (!salePrice || isNaN(salePrice) || isNaN(purchasePrice)) return 0;
  return Math.max(0, Math.round(salePrice - purchasePrice));
}

/** Calcula la fecha de expiración sumando meses a una fecha base (YYYY-MM-DD). */
export function calculateWarrantyExpiry(baseDate: string, months: number): string {
  if (!months || months <= 0) return baseDate;
  
  const [yearStr, monthStr, dayStr] = baseDate.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return baseDate;
  }

  // Objeto fecha en UTC para evitar desfases de zona horaria
  const date = new Date(Date.UTC(year, month - 1 + months, day));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');

  return `${y}-${m}-${d}`;
}

/** Comprueba si una garantía sigue vigente a la fecha actual. */
export function isDeviceWarrantyActive(expiryDate: string | undefined, today = new Date().toISOString().split('T')[0]): boolean {
  if (!expiryDate) return false;
  return expiryDate >= today;
}

/** Normaliza la descripción completa del dispositivo para UI y recibos. */
export function formatDeviceName(brand: string, model: string, storage?: string, color?: string): string {
  const parts = [brand.trim(), model.trim()];
  if (storage && storage.trim()) parts.push(storage.trim());
  if (color && color.trim()) parts.push(`(${color.trim()})`);
  return parts.filter(Boolean).join(' ');
}

/** Genera un folio único y limpio para la factura de venta (ej: VNT-7492). */
export function generateDeviceInvoiceFolio(prefix = 'VNT'): string {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${random}`;
}

/** Normaliza texto eliminando acentos y espacios para búsqueda fluida. */
export function normalizeDeviceSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Filtra la lista de equipos por consulta y por estado. */
export function filterDevices(devices: Device[], searchQuery: string, statusFilter: DeviceStatus | 'Todos'): Device[] {
  const normalizedQuery = normalizeDeviceSearch(searchQuery);

  return devices.filter((device) => {
    if (statusFilter !== 'Todos' && device.status !== statusFilter) {
      return false;
    }

    if (!normalizedQuery) return true;

    const brand = normalizeDeviceSearch(device.brand);
    const model = normalizeDeviceSearch(device.model);
    const imei = normalizeDeviceSearch(device.imei);
    const distributor = normalizeDeviceSearch(device.distributor);
    const clientName = device.clientName ? normalizeDeviceSearch(device.clientName) : '';
    const invoiceFolio = device.invoiceFolio ? normalizeDeviceSearch(device.invoiceFolio) : '';

    return (
      brand.includes(normalizedQuery) ||
      model.includes(normalizedQuery) ||
      imei.includes(normalizedQuery) ||
      distributor.includes(normalizedQuery) ||
      clientName.includes(normalizedQuery) ||
      invoiceFolio.includes(normalizedQuery)
    );
  });
}

/** Calcula el resumen de métricas comerciales de equipos (aislado de servicio técnico). */
export function calculateDeviceMetrics(devices: Device[]): DeviceMetrics {
  let totalInStock = 0;
  let totalInvestedStock = 0;
  let totalSold = 0;
  let totalRevenueSold = 0;
  let totalProfit = 0;

  for (const device of devices) {
    if (device.status === 'En Stock') {
      totalInStock += 1;
      totalInvestedStock += device.purchasePrice || 0;
    } else if (device.status === 'Vendido') {
      totalSold += 1;
      const salePrice = device.salePrice || 0;
      totalRevenueSold += salePrice;
      totalProfit += calculateDeviceProfit(salePrice, device.purchasePrice || 0);
    }
  }

  return {
    totalInStock,
    totalInvestedStock,
    totalSold,
    totalRevenueSold,
    totalProfit,
  };
}

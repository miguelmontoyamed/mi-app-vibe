/**
 * TechRepair Master — Tipos para la Factura y Comprobante de Venta de Equipos (PDF & Web)
 */

export interface DeviceReceiptPdfData {
  // Membrete del taller
  brand: string;
  nit?: string;
  address?: string;
  phone?: string;
  
  // Datos de la factura
  invoiceFolio: string; // ej: VNT-1002
  saleDate: string; // YYYY-MM-DD
  paymentMethod: string;
  
  // Datos del comprador
  clientName: string;
  clientDocument?: string;
  clientPhone?: string;
  
  // Datos del equipo
  brandDevice: string;
  model: string;
  color?: string;
  storageCapacity?: string;
  imei: string;
  condition: string;
  
  // Garantía y valores
  salePrice: number;
  warrantyMonths: number;
  warrantyExpiry: string;
  saleNotes?: string;
  
  // Vendedor / Atendido por
  attendedBy: string;
  whatsappContact?: string;
}

export type DeviceReceiptShareResult =
  | 'shared'
  | 'downloaded'
  | 'cancelled'
  | 'unavailable'
  | 'error';

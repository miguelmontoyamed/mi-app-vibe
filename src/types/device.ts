/**
-- TechRepair Master — Tipado estricto para Compra y Venta de Equipos
-- Cero 'any'. Tipos inmutables y seguros.
-*/

export type DeviceCondition = 'Nuevo' | 'Usado - Excelente' | 'Usado - Bueno' | 'Para Repuestos';

export type DeviceStatus = 'En Stock' | 'Vendido';

export type DevicePaymentMethod = 'Efectivo' | 'Transferencia' | 'Tarjeta';

export interface Device {
  id: string;
  workshopId: string;
  
  // Datos de compra / stock
  brand: string;
  model: string;
  color?: string;
  storageCapacity?: string;
  imei: string;
  condition: DeviceCondition;
  distributor: string;
  purchasePrice: number;
  supplierWarrantyMonths: number;
  supplierWarrantyNotes?: string;
  purchaseDate: string; // 'YYYY-MM-DD'
  purchaseNotes?: string;
  
  // Datos de venta
  status: DeviceStatus;
  salePrice?: number;
  saleDate?: string; // 'YYYY-MM-DD'
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  clientDocument?: string;
  clientWarrantyMonths?: number;
  clientWarrantyExpiry?: string; // 'YYYY-MM-DD'
  paymentMethod?: DevicePaymentMethod;
  invoiceFolio?: string;
  saleNotes?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface DeviceInput {
  brand: string;
  model: string;
  color?: string;
  storageCapacity?: string;
  imei: string;
  condition: DeviceCondition;
  distributor: string;
  purchasePrice: number;
  supplierWarrantyMonths: number;
  supplierWarrantyNotes?: string;
  purchaseDate?: string;
  purchaseNotes?: string;
}

export interface DeviceSaleInput {
  salePrice: number;
  saleDate?: string;
  clientId?: string;
  clientName: string;
  clientPhone?: string;
  clientDocument?: string;
  clientWarrantyMonths: number;
  paymentMethod: DevicePaymentMethod;
  saleNotes?: string;
}

export interface DeviceMetrics {
  totalInStock: number;
  totalInvestedStock: number;
  totalSold: number;
  totalRevenueSold: number;
  totalProfit: number;
}

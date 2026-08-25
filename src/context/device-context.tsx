/**
 * TechRepair Master — Contexto de Gestión de Dispositivos (Compra & Venta)
 * Totalmente aislado del flujo contable de servicio técnico (repairs).
 * Supabase DB + RLS + Tipado estricto (0 'any').
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { useAuth } from '@/context/auth-context';
import { resolveWorkshopId, supabase } from '@/lib/supabase';
import type {
  Device,
  DeviceCondition,
  DeviceInput,
  DeviceMetrics,
  DevicePaymentMethod,
  DeviceSaleInput,
  DeviceStatus,
} from '@/types/device';
import {
  calculateDeviceMetrics,
  calculateWarrantyExpiry,
  generateDeviceInvoiceFolio,
} from '@/utils/device-logic';

interface DeviceRow {
  id: string;
  workshop_id: string;
  brand: string;
  model: string;
  color: string | null;
  storage_capacity: string | null;
  imei: string;
  condition: string;
  distributor: string;
  purchase_price: number | string;
  supplier_warranty_months: number;
  supplier_warranty_notes: string | null;
  purchase_date: string;
  purchase_notes: string | null;
  status: string;
  sale_price: number | string | null;
  sale_date: string | null;
  client_id: string | null;
  client_name: string | null;
  client_phone: string | null;
  client_document: string | null;
  client_warranty_months: number | null;
  client_warranty_expiry: string | null;
  payment_method: string | null;
  invoice_folio: string | null;
  sale_notes: string | null;
  created_at: string;
  updated_at: string;
}

function rowToDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    workshopId: row.workshop_id,
    brand: row.brand,
    model: row.model,
    color: row.color || undefined,
    storageCapacity: row.storage_capacity || undefined,
    imei: row.imei,
    condition: (row.condition as DeviceCondition) || 'Usado - Excelente',
    distributor: row.distributor,
    purchasePrice: typeof row.purchase_price === 'string' ? parseFloat(row.purchase_price) || 0 : row.purchase_price || 0,
    supplierWarrantyMonths: row.supplier_warranty_months || 0,
    supplierWarrantyNotes: row.supplier_warranty_notes || undefined,
    purchaseDate: row.purchase_date,
    purchaseNotes: row.purchase_notes || undefined,
    status: (row.status as DeviceStatus) || 'En Stock',
    salePrice: row.sale_price !== null && row.sale_price !== undefined ? (typeof row.sale_price === 'string' ? parseFloat(row.sale_price) || 0 : row.sale_price) : undefined,
    saleDate: row.sale_date || undefined,
    clientId: row.client_id || undefined,
    clientName: row.client_name || undefined,
    clientPhone: row.client_phone || undefined,
    clientDocument: row.client_document || undefined,
    clientWarrantyMonths: row.client_warranty_months !== null && row.client_warranty_months !== undefined ? row.client_warranty_months : undefined,
    clientWarrantyExpiry: row.client_warranty_expiry || undefined,
    paymentMethod: (row.payment_method as DevicePaymentMethod) || undefined,
    invoiceFolio: row.invoice_folio || undefined,
    saleNotes: row.sale_notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function notify(message: string, isError = false) {
  if (Platform.OS === 'web') {
    if (isError) {
      console.error(message);
    }
    window.alert(message);
  } else {
    Alert.alert(isError ? 'Error' : 'Aviso', message);
  }
}

interface DeviceContextType {
  devices: Device[];
  loading: boolean;
  metrics: DeviceMetrics;
  fetchDevices: () => Promise<void>;
  addDevice: (input: DeviceInput) => Promise<Device | null>;
  sellDevice: (deviceId: string, saleInput: DeviceSaleInput) => Promise<boolean>;
  deleteDevice: (deviceId: string) => Promise<boolean>;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { currentUser } = useAuth();

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const wid = await resolveWorkshopId();
      if (!wid) {
        setDevices([]);
        return;
      }

      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('workshop_id', wid)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching devices:', error.message);
        return;
      }

      if (data) {
        setDevices((data as unknown as DeviceRow[]).map(rowToDevice));
      }
    } catch (err) {
      console.error('Error in fetchDevices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      void fetchDevices();
    } else {
      setDevices([]);
      setLoading(false);
    }
  }, [currentUser]);

  const addDevice = async (input: DeviceInput): Promise<Device | null> => {
    const wid = await resolveWorkshopId();
    if (!wid) {
      notify('No se pudo identificar el taller.', true);
      return null;
    }

    const purchaseDate = input.purchaseDate || new Date().toISOString().split('T')[0];

    const rowPayload = {
      workshop_id: wid,
      brand: input.brand.trim(),
      model: input.model.trim(),
      color: input.color?.trim() || null,
      storage_capacity: input.storageCapacity?.trim() || null,
      imei: input.imei.trim(),
      condition: input.condition,
      distributor: input.distributor.trim(),
      purchase_price: input.purchasePrice,
      supplier_warranty_months: input.supplierWarrantyMonths,
      supplier_warranty_notes: input.supplierWarrantyNotes?.trim() || null,
      purchase_date: purchaseDate,
      purchase_notes: input.purchaseNotes?.trim() || null,
      status: 'En Stock',
    };

    const { data, error } = await supabase
      .from('devices')
      .insert(rowPayload)
      .select('*')
      .single();

    if (error || !data) {
      console.error('Error adding device:', error?.message);
      notify(`Error al registrar el equipo: ${error?.message || 'Error desconocido'}`, true);
      return null;
    }

    const newDevice = rowToDevice(data as unknown as DeviceRow);
    setDevices((prev) => [newDevice, ...prev]);
    notify('¡Equipo registrado exitosamente en Stock!');
    return newDevice;
  };

  const sellDevice = async (deviceId: string, saleInput: DeviceSaleInput): Promise<boolean> => {
    const wid = await resolveWorkshopId();
    if (!wid) {
      notify('No se pudo identificar el taller.', true);
      return false;
    }

    const target = devices.find((d) => d.id === deviceId);
    if (!target) {
      notify('Equipo no encontrado.', true);
      return false;
    }

    if (target.status === 'Vendido') {
      notify('Este equipo ya figura como vendido.', true);
      return false;
    }

    const saleDate = saleInput.saleDate || new Date().toISOString().split('T')[0];
    const clientWarrantyExpiry = calculateWarrantyExpiry(saleDate, saleInput.clientWarrantyMonths);
    const invoiceFolio = generateDeviceInvoiceFolio();

    const updatePayload = {
      status: 'Vendido',
      sale_price: saleInput.salePrice,
      sale_date: saleDate,
      client_id: saleInput.clientId || null,
      client_name: saleInput.clientName.trim(),
      client_phone: saleInput.clientPhone?.trim() || null,
      client_document: saleInput.clientDocument?.trim() || null,
      client_warranty_months: saleInput.clientWarrantyMonths,
      client_warranty_expiry: clientWarrantyExpiry,
      payment_method: saleInput.paymentMethod,
      invoice_folio: invoiceFolio,
      sale_notes: saleInput.saleNotes?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('devices')
      .update(updatePayload)
      .eq('id', deviceId)
      .select('*')
      .single();

    if (error || !data) {
      console.error('Error selling device:', error?.message);
      notify(`Error al registrar la venta: ${error?.message || 'Error desconocido'}`, true);
      return false;
    }

    const updated = rowToDevice(data as unknown as DeviceRow);
    setDevices((prev) => prev.map((d) => (d.id === deviceId ? updated : d)));
    notify(`¡Venta registrada exitosamente! Folio: ${invoiceFolio}`);
    return true;
  };

  const deleteDevice = async (deviceId: string): Promise<boolean> => {
    if (currentUser?.role !== 'admin') {
      notify('Solo el administrador del taller puede eliminar registros de equipos.', true);
      return false;
    }

    const { error } = await supabase.from('devices').delete().eq('id', deviceId);

    if (error) {
      console.error('Error deleting device:', error.message);
      notify(`No se pudo eliminar el equipo: ${error.message}`, true);
      return false;
    }

    setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    notify('Registro de equipo eliminado.');
    return true;
  };

  const metrics = useMemo(() => calculateDeviceMetrics(devices), [devices]);

  const value = useMemo(
    () => ({
      devices,
      loading,
      metrics,
      fetchDevices,
      addDevice,
      sellDevice,
      deleteDevice,
    }),
    [devices, loading, metrics]
  );

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}

export function useDevices() {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevices debe usarse dentro de un DeviceProvider');
  }
  return context;
}

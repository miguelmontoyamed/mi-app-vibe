import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

import {
  applyPayment,
  isValidCancellation,
  type CancellationReason,
  type PaymentMethod,
  type RepairStatus,
} from '@/utils/repair-logic';

// Re-exported so existing consumers can keep importing from repair-context.
export type { CancellationReason, PaymentMethod, RepairStatus };

export interface RepairItem {
  id: string;
  clientName: string;
  phone: string;
  device: string;
  issue: string;
  budget: number;
  unlockCode?: string;
  imei?: string;
  /** Importe ya cobrado al cliente (anticipo + pagos parciales). */
  advancePayment?: number;
  /** Método del último cobro registrado. */
  paymentMethod?: PaymentMethod;
  /** Id del técnico asignado (ausente en datos actuales de AsyncStorage v1). */
  technicianId?: string;
  technicianName?: string;
  /** Motivo obligatorio cuando el estado es 'Cancelado / No Reparado'. */
  cancellationReason?: CancellationReason;
  status: RepairStatus;
  date: string;
}

export interface InventoryPart {
  id: string;
  name: string;
  category: string;
  stock: number;
  price: number;
}

interface RepairContextType {
  repairs: RepairItem[];
  inventory: InventoryPart[];
  hydrated: boolean;
  addRepair: (repair: Omit<RepairItem, 'id' | 'status' | 'date'>) => void;
  updateRepairStatus: (id: string, status: RepairStatus) => void;
  /** Edita campos de una reparación (no el estado ni el motivo de cancelación). */
  updateRepair: (
    id: string,
    patch: Partial<Omit<RepairItem, 'id' | 'date' | 'status' | 'cancellationReason'>>
  ) => void;
  /** Cancela la reparación exigiendo un motivo; devuelve true si se aplicó. */
  cancelRepair: (id: string, reason: CancellationReason) => boolean;
  recordRepairPayment: (id: string, amount: number, method: PaymentMethod) => void;
  addInventoryPart: (part: Omit<InventoryPart, 'id'>) => void;
  updateInventoryStock: (id: string, delta: number) => void;
}

const RepairContext = createContext<RepairContextType | undefined>(undefined);

const STORAGE_KEY = 'techrepair.data.v1';

/** Fallback seed data used only until (or when there is no) stored backup. */
const SEED_REPAIRS: RepairItem[] = [
  {
    id: '1',
    clientName: 'Carlos Mendoza',
    phone: '+57 300 123 4567',
    device: 'iPhone 13',
    issue: 'Cambio de pantalla',
    budget: 480000,
    unlockCode: 'PIN: 1234',
    imei: '353311008766521',
    advancePayment: 160000,
    paymentMethod: 'Efectivo',
    technicianId: '2',
    technicianName: 'Luis Técnico',
    status: 'Pendiente',
    date: '2026-06-05',
  },
  {
    id: '2',
    clientName: 'María Pérez',
    phone: '+57 310 987 6543',
    device: 'Samsung Galaxy S23',
    issue: 'Pin de carga',
    budget: 180000,
    unlockCode: 'Patrón: L',
    imei: '358690091234567',
    advancePayment: 80000,
    paymentMethod: 'Tarjeta',
    technicianId: '3',
    technicianName: 'Sofia Técnica',
    status: 'En Proceso',
    date: '2026-06-04',
  },
  {
    id: '3',
    clientName: 'Juan Gómez',
    phone: '+57 320 456 7890',
    device: 'Xiaomi Redmi Note 11',
    issue: 'Cambio de batería',
    budget: 140000,
    unlockCode: 'Sin bloqueo',
    imei: '351620558877123',
    advancePayment: 140000,
    paymentMethod: 'Transferencia',
    technicianId: '2',
    technicianName: 'Luis Técnico',
    status: 'Listo',
    date: '2026-06-03',
  },
  {
    id: '4',
    clientName: 'Ana Torres',
    phone: '+57 315 654 3210',
    device: 'MacBook Air M1',
    issue: 'Mantenimiento software',
    budget: 600000,
    unlockCode: 'Pass: mac2026',
    imei: 'SN-C02ZN1Y7Q6LH',
    advancePayment: 200000,
    paymentMethod: 'Efectivo',
    technicianId: '1',
    technicianName: 'Carlos (Administrador Principal)',
    status: 'Entregado',
    date: '2026-06-01',
  },
];

const SEED_INVENTORY: InventoryPart[] = [
  { id: '1', name: 'Pantalla iPhone 13 OLED', category: 'Pantallas', stock: 5, price: 340000 },
  { id: '2', name: 'Batería Samsung S23', category: 'Baterías', stock: 3, price: 120000 },
  { id: '3', name: 'Pin de Carga Tipo-C Universal', category: 'Pines', stock: 15, price: 34000 },
  { id: '4', name: 'Pantalla Xiaomi Note 11', category: 'Pantallas', stock: 2, price: 100000 },
  { id: '5', name: 'Soldadura Estaño / Flux', category: 'Herramientas', stock: 10, price: 48000 },
];

export function RepairProvider({ children }: { children: React.ReactNode }) {
  const [repairs, setRepairs] = useState<RepairItem[]>(SEED_REPAIRS);
  const [inventory, setInventory] = useState<InventoryPart[]>(SEED_INVENTORY);
  /** False until stored data (if any) has been read, so we don't overwrite it with seeds. */
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from AsyncStorage (once). Guard keeps typing safe before/after.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && !cancelled) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.repairs) && parsed.repairs.length > 0) {
            setRepairs(parsed.repairs);
          }
          if (Array.isArray(parsed.inventory)) {
            setInventory(parsed.inventory);
          }
        }
      } catch (error) {
        console.error('Error loading TechRepair data:', error);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist after hydration so seeds never overwrite stored backup.
  useEffect(() => {
    if (!hydrated) return;
    try {
      AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ repairs, inventory })
      ).catch((error) => console.error('Error saving TechRepair data:', error));
    } catch (error) {
      console.error('Error saving TechRepair data:', error);
    }
  }, [repairs, inventory, hydrated]);

  const addRepair = (newRep: Omit<RepairItem, 'id' | 'status' | 'date'>) => {
    const item: RepairItem = {
      ...newRep,
      id: Date.now().toString(),
      status: 'Pendiente',
      date: new Date().toISOString().split('T')[0],
    };
    setRepairs((prev) => [item, ...prev]);
  };

  const updateRepairStatus = (id: string, status: RepairStatus) => {
    setRepairs((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
  };

  /** Edita campos de una reparación existente (no status ni cancelación). */
  const updateRepair = (
    id: string,
    patch: Partial<Omit<RepairItem, 'id' | 'date' | 'status' | 'cancellationReason'>>
  ) => {
    setRepairs((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  };

  /**
   * Cancela la reparación con un motivo obligatorio. Devuelve true si se
   * aplicó la cancelación, false si el estado no lo permite o falta el motivo.
   */
  const cancelRepair = (id: string, reason: CancellationReason): boolean => {
    const target = repairs.find((r) => r.id === id);
    if (!target || !isValidCancellation(target.status, reason)) {
      return false;
    }
    setRepairs((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, status: 'Cancelado / No Reparado' as RepairStatus, cancellationReason: reason }
          : r
      )
    );
    return true;
  };

  /** Adds a payment toward the balance due (capped at the remaining balance). */
  const recordRepairPayment = (id: string, amount: number, method: PaymentMethod) => {
    setRepairs((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const result = applyPayment(r.advancePayment ?? 0, r.budget, amount);
        if (result.applied <= 0) return r;
        return {
          ...r,
          advancePayment: result.newAdvance,
          paymentMethod: method,
        };
      })
    );
  };

  const addInventoryPart = (part: Omit<InventoryPart, 'id'>) => {
    const item: InventoryPart = {
      ...part,
      id: Date.now().toString(),
    };
    setInventory((prev) => [item, ...prev]);
  };

  const updateInventoryStock = (id: string, delta: number) => {
    setInventory((prev) =>
      prev.map((p) => (p.id === id ? { ...p, stock: Math.max(0, p.stock + delta) } : p))
    );
  };

  return (
    <RepairContext.Provider
      value={{
        repairs,
        inventory,
        hydrated,
        addRepair,
        updateRepairStatus,
        updateRepair,
        cancelRepair,
        recordRepairPayment,
        addInventoryPart,
        updateInventoryStock,
      }}>
      {children}
    </RepairContext.Provider>
  );
}

export function useRepair() {
  const context = useContext(RepairContext);
  if (!context) {
    throw new Error('useRepair must be used within a RepairProvider');
  }
  return context;
}

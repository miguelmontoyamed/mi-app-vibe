import React, { createContext, useContext, useEffect, useState } from 'react';

import { useAuth } from '@/context/auth-context';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  applyPayment,
  isValidCancellation,
  type CancellationReason,
  type PaymentMethod,
  type RepairStatus,
} from '@/utils/repair-logic';
import { generateOrderId, ORDER_PREFIX } from '@/utils/order-generator';

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

/** Fallback: sin datos hasta que el dueño registre sus primeros trabajos. */
const SEED_REPAIRS: RepairItem[] = [];

const SEED_INVENTORY: InventoryPart[] = [];

// ────────────────────────────────────────────────────────────────────────────
// Mapeo de filas Supabase (snake_case) ↔ estado local (camelCase)
// ────────────────────────────────────────────────────────────────────────────

/** Fila de `public.repairs` tal como la devuelve Supabase (snake_case). */
interface RepairRow {
  id: string;
  workshop_id: string;
  client_name: string;
  phone: string | null;
  device: string;
  issue: string | null;
  budget: number | null;
  advance_payment: number | null;
  payment_method: PaymentMethod | null;
  unlock_code: string | null;
  imei: string | null;
  technician_id: string | null;
  technician_name: string | null;
  cancellation_reason: CancellationReason | null;
  status: string;
  date: string | null;
  created_at?: string | null;
}

/** Fila de `public.inventory` tal como la devuelve Supabase (snake_case). */
interface InventoryRow {
  id: string;
  name: string;
  category: string | null;
  stock: number | null;
  price: number | null;
}

/** Patch de reparación aceptado por el mapeo a columnas (incluye status/cancelación). */
type RepairPatch = Partial<Omit<RepairItem, 'id' | 'date'>>;

/** Convierte una reparación local (camelCase) en la fila completa de `repairs`. */
function repairToRow(item: RepairItem, workshopId: string): RepairRow {
  return {
    id: item.id,
    workshop_id: workshopId,
    client_name: item.clientName,
    phone: item.phone || null,
    device: item.device,
    issue: item.issue || null,
    budget: item.budget,
    advance_payment: item.advancePayment ?? 0,
    payment_method: item.paymentMethod ?? null,
    unlock_code: item.unlockCode ?? null,
    imei: item.imei ?? null,
    technician_id: item.technicianId ?? null,
    technician_name: item.technicianName ?? null,
    cancellation_reason: item.cancellationReason ?? null,
    status: item.status,
    date: item.date,
  };
}

/** Mapea SOLO las claves presentes del patch camelCase a columnas snake_case. */
function repairPatchToRow(patch: RepairPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.clientName !== undefined) row.client_name = patch.clientName;
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.device !== undefined) row.device = patch.device;
  if (patch.issue !== undefined) row.issue = patch.issue;
  if (patch.budget !== undefined) row.budget = patch.budget;
  if (patch.unlockCode !== undefined) row.unlock_code = patch.unlockCode;
  if (patch.imei !== undefined) row.imei = patch.imei;
  if (patch.advancePayment !== undefined) row.advance_payment = patch.advancePayment;
  if (patch.paymentMethod !== undefined) row.payment_method = patch.paymentMethod;
  if (patch.technicianId !== undefined) row.technician_id = patch.technicianId;
  if (patch.technicianName !== undefined) row.technician_name = patch.technicianName;
  if (patch.cancellationReason !== undefined) row.cancellation_reason = patch.cancellationReason;
  if (patch.status !== undefined) row.status = patch.status;
  return row;
}

/** Invierte el mapeo: fila de `repairs` → reparación local (camelCase). */
function rowToRepair(row: RepairRow): RepairItem {
  return {
    id: row.id,
    clientName: row.client_name,
    phone: row.phone ?? '',
    device: row.device,
    issue: row.issue ?? '',
    budget: Number(row.budget ?? 0),
    unlockCode: row.unlock_code ?? undefined,
    imei: row.imei ?? undefined,
    advancePayment: row.advance_payment != null ? Number(row.advance_payment) : undefined,
    paymentMethod: row.payment_method ?? undefined,
    technicianId: row.technician_id ?? undefined,
    technicianName: row.technician_name ?? undefined,
    cancellationReason: row.cancellation_reason ?? undefined,
    status: row.status as RepairStatus,
    date: row.date ?? (row.created_at?.split('T')[0] ?? ''),
  };
}

/** Fila de `inventory` → parte local (camelCase). */
function rowToInventory(row: InventoryRow): InventoryPart {
  return {
    id: row.id,
    name: row.name,
    category: row.category ?? '',
    stock: Number(row.stock ?? 0),
    price: Number(row.price ?? 0),
  };
}

/**
 * Fila de inserción de `inventory` (sin `id`: el uuid lo genera la DB).
 * Incluye `workshop_id` para que RLS (`with check workshop_id = current_workshop_id()`)
 * acepte la inserción. El patch de stock, en cambio, NO lleva `id` ni `workshop_id`.
 */
function inventoryToRowItem(
  part: Omit<InventoryPart, 'id'>,
  workshopId: string
): {
  workshop_id: string;
  name: string;
  category: string;
  stock: number;
  price: number;
} {
  return {
    workshop_id: workshopId,
    name: part.name,
    category: part.category,
    stock: part.stock,
    price: part.price,
  };
}

export function RepairProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const userId = currentUser?.id ?? null;

  const [repairs, setRepairs] = useState<RepairItem[]>(SEED_REPAIRS);
  const [inventory, setInventory] = useState<InventoryPart[]>(SEED_INVENTORY);
  /** False until stored data (if any) has been read, so we don't overwrite it with seeds. */
  const [hydrated, setHydrated] = useState(false);
  /** Id del taller (workshops.id) resuelto para el usuario autenticado; null en demo local. */
  const [workshopId, setWorkshopId] = useState<string | null>(null);

  // Hydrate desde Supabase (una vez por usuario). Sin Supabase configurado o sin
  // sesión/taller, el estado queda vacío (solo en memoria, demo local).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Cada hidratación (por usuario) arranca con el estado vacío: evita
      // heredar datos del usuario anterior (logout / switch de cuenta).
      setHydrated(false);
      setWorkshopId(null);
      try {
        if (isSupabaseConfigured && userId) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const { data: wid } = await supabase.rpc('current_workshop_id');
            const resolvedWorkshopId = (wid as string | null) ?? null;
            if (!cancelled) setWorkshopId(resolvedWorkshopId);
            if (resolvedWorkshopId) {
              const [repResult, invResult] = await Promise.all([
                supabase.from('repairs').select('*').order('created_at', { ascending: false }),
                supabase.from('inventory').select('*').order('created_at', { ascending: false }),
              ]);
              const repairsLoaded = !repResult.error;
              const inventoryLoaded = !invResult.error;
              if (!repairsLoaded) {
                console.error('Error loading repairs from Supabase:', repResult.error);
              }
              if (!inventoryLoaded) {
                console.error('Error loading inventory from Supabase:', invResult.error);
              }
              // Cada hidratación reemplaza el estado completo: si una consulta
              // falla, esa lista queda vacía (demo local) en lugar de heredar
              // datos del usuario anterior.
              if (!cancelled) {
                setRepairs(repairsLoaded ? ((repResult.data ?? []) as RepairRow[]).map(rowToRepair) : []);
                setInventory(inventoryLoaded ? ((invResult.data ?? []) as InventoryRow[]).map(rowToInventory) : []);
              }
            } else {
              // Usuario demo local sin fila en profiles: datos solo en memoria.
              if (!cancelled) {
                setRepairs([]);
                setInventory([]);
              }
            }
          } else {
            // Sin sesión Supabase: demo local, datos solo en memoria.
            if (!cancelled) {
              setWorkshopId(null);
              setRepairs([]);
              setInventory([]);
            }
          }
        } else {
          // Sin Supabase configurado o sin usuario: demo local.
          if (!cancelled) {
            setWorkshopId(null);
            setRepairs([]);
            setInventory([]);
          }
        }
      } catch (error) {
        console.error('Error loading TechRepair data from Supabase:', error);
        if (!cancelled) {
          setWorkshopId(null);
          setRepairs([]);
          setInventory([]);
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /**
   * Registra una nueva reparación con un ID de orden único, corto y
   * alfanumérico (TRM-XXXX). Si el ID generado ya existe en el estado
   * actual, se reintenta hasta 10 veces antes de fallar.
   */
  const addRepair = (newRep: Omit<RepairItem, 'id' | 'status' | 'date'>) => {
    // Generación PURA del id+item (fuera del updater) contra el estado actual.
    const existingIds = new Set(repairs.map((r) => r.id));
    let id = generateOrderId();
    let attempts = 0;
    while (existingIds.has(id) && attempts < 10) {
      id = generateOrderId();
      attempts++;
    }
    // Si tras 10 intentos sigue habiendo colisión (prácticamente imposible
    // con 30^4 = 810 000 combinaciones), usamos un fallback con timestamp.
    if (existingIds.has(id)) {
      id = `${ORDER_PREFIX}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    }

    const item: RepairItem = {
      ...newRep,
      id,
      status: 'Pendiente',
      date: new Date().toISOString().split('T')[0],
    };
    setRepairs((prev) => [item, ...prev]);

    // Write-through optimista a Supabase (fire-and-forget).
    if (isSupabaseConfigured && workshopId) {
      void supabase
        .from('repairs')
        .insert(repairToRow(item, workshopId))
        .then(({ error }) => {
          if (error) {
            console.error('Error inserting repair:', error);
            // PK duplicado (23505): colisión de TRM-XXXX entre dispositivos.
            // Regenerar el id con fallback de timestamp y reintentar una vez.
            if (String(error.code) === '23505') {
              const retryId = `${ORDER_PREFIX}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
              const retryItem: RepairItem = { ...item, id: retryId };
              void supabase
                .from('repairs')
                .insert(repairToRow(retryItem, workshopId))
                .then(({ error: retryError }) => {
                  if (retryError) {
                    console.error('Error retrying repair insert:', retryError);
                  }
                });
            }
          }
        });
    }
  };

  const updateRepairStatus = (id: string, status: RepairStatus) => {
    setRepairs((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
    if (isSupabaseConfigured && workshopId) {
      void supabase
        .from('repairs')
        .update(repairPatchToRow({ status }))
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('Error updating repair status:', error);
        });
    }
  };

  /** Edita campos de una reparación existente (no status ni cancelación). */
  const updateRepair = (
    id: string,
    patch: Partial<Omit<RepairItem, 'id' | 'date' | 'status' | 'cancellationReason'>>
  ) => {
    setRepairs((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
    if (isSupabaseConfigured && workshopId) {
      void supabase
        .from('repairs')
        .update(repairPatchToRow(patch))
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('Error updating repair:', error);
        });
    }
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
    if (isSupabaseConfigured && workshopId) {
      void supabase
        .from('repairs')
        .update({ status: 'Cancelado / No Reparado', cancellation_reason: reason })
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('Error cancelling repair:', error);
        });
    }
    return true;
  };

  /** Adds a payment toward the balance due (capped at the remaining balance). */
  const recordRepairPayment = (id: string, amount: number, method: PaymentMethod) => {
    const target = repairs.find((r) => r.id === id);
    if (!target) return;
    const result = applyPayment(target.advancePayment ?? 0, target.budget, amount);
    if (result.applied <= 0) return;
    setRepairs((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, advancePayment: result.newAdvance, paymentMethod: method }
          : r
      )
    );
    if (isSupabaseConfigured && workshopId) {
      void supabase
        .from('repairs')
        .update({ advance_payment: result.newAdvance, payment_method: method })
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('Error recording repair payment:', error);
        });
    }
  };

  const addInventoryPart = (part: Omit<InventoryPart, 'id'>) => {
    const item: InventoryPart = {
      ...part,
      id: Date.now().toString(),
    };
    setInventory((prev) => [item, ...prev]);
    if (isSupabaseConfigured && workshopId) {
      void supabase
        .from('inventory')
        .insert(inventoryToRowItem(part, workshopId))
        .select('id')
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error('Error inserting inventory part:', error);
            return;
          }
          if (data) {
            // Reemplaza el id local (timestamp) por el uuid real de la DB para
            // que updateInventoryStock apunte a la fila persistida.
            const dbId = (data as { id: string }).id;
            setInventory((prev) =>
              prev.map((p) => (p.id === item.id ? { ...p, id: dbId } : p))
            );
          }
        });
    }
  };

  const updateInventoryStock = (id: string, delta: number) => {
    const target = inventory.find((p) => p.id === id);
    if (!target) return;
    const stock = Math.max(0, target.stock + delta);
    setInventory((prev) =>
      prev.map((p) => (p.id === id ? { ...p, stock } : p))
    );
    if (isSupabaseConfigured && workshopId) {
      void supabase
        .from('inventory')
        .update({ stock })
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('Error updating inventory stock:', error);
        });
    }
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
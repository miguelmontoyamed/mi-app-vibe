import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { useAuth } from '@/context/auth-context';
import {
  assertSupabaseConfigured,
  getSupabaseEnvError,
  isSupabaseConfigured,
  supabase,
} from '@/lib/supabase';
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
  /** Motivo (texto libre) obligatorio cuando el estado es 'Cancelado / No Reparado'. */
  motivoCancelacion?: string;
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
  /** Error visible de carga desde la nube (null cuando todo salió bien). */
  loadError: string | null;
  addRepair: (repair: Omit<RepairItem, 'id' | 'status' | 'date'>) => Promise<void>;
  updateRepairStatus: (id: string, status: RepairStatus) => Promise<void>;
  /** Edita campos de una reparación (no el estado ni el motivo de cancelación). */
  updateRepair: (
    id: string,
    patch: Partial<Omit<RepairItem, 'id' | 'date' | 'status' | 'motivoCancelacion'>>
  ) => Promise<void>;
  /** Cancela la reparación exigiendo un motivo (texto libre); devuelve true si se aplicó. */
  cancelRepair: (id: string, motivo: string) => Promise<boolean>;
  /** Elimina definitivamente una orden (solo dueño). Devuelve true si existía. */
  deleteRepair: (id: string) => Promise<boolean>;
  recordRepairPayment: (id: string, amount: number, method: PaymentMethod) => Promise<void>;
  addInventoryPart: (part: Omit<InventoryPart, 'id'>) => Promise<void>;
  updateInventoryStock: (id: string, delta: number) => Promise<void>;
}

const RepairContext = createContext<RepairContextType | undefined>(undefined);

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
  motivo_cancelacion: string | null;
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
    motivo_cancelacion: item.motivoCancelacion ?? null,
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
  if (patch.motivoCancelacion !== undefined) row.motivo_cancelacion = patch.motivoCancelacion;
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
    motivoCancelacion: row.motivo_cancelacion ?? undefined,
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

  const [repairs, setRepairs] = useState<RepairItem[]>([]);
  const [inventory, setInventory] = useState<InventoryPart[]>([]);
  /** False until stored data (if any) has been read, so we don't overwrite it with seeds. */
  const [hydrated, setHydrated] = useState(false);
  /** Id del taller (workshops.id) resuelto para el usuario autenticado; null en demo local. */
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  /** Error visible de carga desde la nube (null cuando todo salió bien). */
  const [loadError, setLoadError] = useState<string | null>(null);

  const notifyError = (message: string) => {
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert('Error', message);
    }
  };

  const requireWorkshop = (): string | null => {
    try {
      assertSupabaseConfigured();
    } catch (e) {
      return e instanceof Error ? e.message : 'Supabase no está configurado.';
    }
    if (!workshopId) {
      return 'No se pudo resolver el taller. Inicia sesión de nuevo.';
    }
    return null;
  };

  // Hydrate desde Supabase (una vez por usuario). Sin Supabase configurado o sin
  // sesión/taller, el estado queda vacío (solo en memoria, demo local).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Cada hidratación (por usuario) arranca con el estado vacío: evita
      // heredar datos del usuario anterior (logout / switch de cuenta).
      setHydrated(false);
      setWorkshopId(null);
      setLoadError(null);
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
                setLoadError('Error al cargar reparaciones: ' + repResult.error.message);
              }
              if (!inventoryLoaded) {
                setLoadError('Error al cargar inventario: ' + invResult.error.message);
              }
              // Cada hidratación reemplaza el estado completo: si una consulta
              // falla, esa lista queda vacía en lugar de heredar datos del
              // usuario anterior.
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
            setLoadError(getSupabaseEnvError() ?? 'Supabase no está configurado.');
          }
        }
      } catch (error) {
        if (!cancelled) {
          setWorkshopId(null);
          setRepairs([]);
          setInventory([]);
          setLoadError(error instanceof Error ? error.message : 'Error al cargar los datos desde la nube.');
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
  const addRepair = async (newRep: Omit<RepairItem, 'id' | 'status' | 'date'>): Promise<void> => {
    const blockReason = requireWorkshop();
    if (blockReason) { notifyError(blockReason); return; }

    const existingIds = new Set(repairs.map((r) => r.id));
    let id = generateOrderId();
    let attempts = 0;
    while (existingIds.has(id) && attempts < 10) { id = generateOrderId(); attempts++; }
    if (existingIds.has(id)) { id = `${ORDER_PREFIX}-${Date.now().toString(36).slice(-4).toUpperCase()}`; }

    const item: RepairItem = { ...newRep, id, status: 'Pendiente', date: new Date().toISOString().split('T')[0] };

    const { error } = await supabase.from('repairs').insert(repairToRow(item, workshopId!));
    if (error) {
      if (String(error.code) === '23505') {
        const retryId = `${ORDER_PREFIX}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
        const retryItem: RepairItem = { ...item, id: retryId };
        const { error: retryError } = await supabase.from('repairs').insert(repairToRow(retryItem, workshopId!));
        if (retryError) { notifyError(`No se pudo guardar la reparación: ${retryError.message}`); return; }
        setRepairs((prev) => [retryItem, ...prev]);
        return;
      }
      notifyError(`No se pudo guardar la reparación: ${error.message}`);
      return;
    }
    setRepairs((prev) => [item, ...prev]);
  };

  const updateRepairStatus = async (id: string, status: RepairStatus): Promise<void> => {
    const blockReason = requireWorkshop();
    if (blockReason) { notifyError(blockReason); return; }
    const { error } = await supabase.from('repairs').update(repairPatchToRow({ status })).eq('id', id);
    if (error) { notifyError(`No se pudo actualizar el estado: ${error.message}`); return; }
    setRepairs((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  /** Edita campos de una reparación existente (no status ni cancelación). */
  const updateRepair = async (id: string, patch: Partial<Omit<RepairItem, 'id' | 'date' | 'status' | 'motivoCancelacion'>>): Promise<void> => {
    const blockReason = requireWorkshop();
    if (blockReason) { notifyError(blockReason); return; }
    const { error } = await supabase.from('repairs').update(repairPatchToRow(patch)).eq('id', id);
    if (error) { notifyError(`No se pudo actualizar la reparación: ${error.message}`); return; }
    setRepairs((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  /**
   * Cancela la reparación con un motivo obligatorio (texto libre). Devuelve
   * true si se aplicó la cancelación, false si el estado no lo permite o el
   * motivo está vacío.
   */
  const cancelRepair = async (id: string, motivo: string): Promise<boolean> => {
    const cleanMotivo = motivo.trim();
    const target = repairs.find((r) => r.id === id);
    if (!target || !isValidCancellation(target.status, cleanMotivo)) return false;
    const blockReason = requireWorkshop();
    if (blockReason) { notifyError(blockReason); return false; }
    const { error } = await supabase.from('repairs').update({ status: 'Cancelado / No Reparado', motivo_cancelacion: cleanMotivo }).eq('id', id);
    if (error) { notifyError(`No se pudo cancelar la orden: ${error.message}`); return false; }
    setRepairs((prev) => prev.map((r) => r.id === id ? { ...r, status: 'Cancelado / No Reparado' as RepairStatus, motivoCancelacion: cleanMotivo } : r));
    return true;
  };

  /** Elimina definitivamente una orden. Devuelve true si existía. */
  const deleteRepair = async (id: string): Promise<boolean> => {
    if (!repairs.some((r) => r.id === id)) return false;
    const blockReason = requireWorkshop();
    if (blockReason) { notifyError(blockReason); return false; }
    const { error } = await supabase.from('repairs').delete().eq('id', id);
    if (error) { notifyError(`No se pudo eliminar la orden: ${error.message}`); return false; }
    setRepairs((prev) => prev.filter((r) => r.id !== id));
    return true;
  };

  /** Adds a payment toward the balance due (capped at the remaining balance). */
  const recordRepairPayment = async (id: string, amount: number, method: PaymentMethod): Promise<void> => {
    const target = repairs.find((r) => r.id === id);
    if (!target) return;
    const result = applyPayment(target.advancePayment ?? 0, target.budget, amount);
    if (result.applied <= 0) return;
    const blockReason = requireWorkshop();
    if (blockReason) { notifyError(blockReason); return; }
    const { error } = await supabase.from('repairs').update({ advance_payment: result.newAdvance, payment_method: method }).eq('id', id);
    if (error) { notifyError(`No se pudo registrar el pago: ${error.message}`); return; }
    setRepairs((prev) => prev.map((r) => r.id === id ? { ...r, advancePayment: result.newAdvance, paymentMethod: method } : r));
  };

  const addInventoryPart = async (part: Omit<InventoryPart, 'id'>): Promise<void> => {
    const blockReason = requireWorkshop();
    if (blockReason) { notifyError(blockReason); return; }
    const { data, error } = await supabase.from('inventory').insert(inventoryToRowItem(part, workshopId!)).select('id').single();
    if (error || !data) { notifyError(`No se pudo agregar la pieza: ${error?.message ?? 'respuesta vacía'}`); return; }
    const dbId = (data as { id: string }).id;
    setInventory((prev) => [{ ...part, id: dbId }, ...prev]);
  };

  const updateInventoryStock = async (id: string, delta: number): Promise<void> => {
    const target = inventory.find((p) => p.id === id);
    if (!target) return;
    const stock = Math.max(0, target.stock + delta);
    const blockReason = requireWorkshop();
    if (blockReason) { notifyError(blockReason); return; }
    const { error } = await supabase.from('inventory').update({ stock }).eq('id', id);
    if (error) { notifyError(`No se pudo actualizar el stock: ${error.message}`); return; }
    setInventory((prev) => prev.map((p) => (p.id === id ? { ...p, stock } : p)));
  };

  return (
    <RepairContext.Provider
      value={{
        repairs,
        inventory,
        hydrated,
        loadError,
        addRepair,
        updateRepairStatus,
        updateRepair,
        cancelRepair,
        deleteRepair,
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
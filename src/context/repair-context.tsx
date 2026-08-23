import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { useAuth } from '@/context/auth-context';
import {
  assertSupabaseConfigured,
  getSupabaseEnvError,
  isSupabaseConfigured,
  resolveWorkshopId,
  supabase,
} from '@/lib/supabase';
import {
  applyPayment,
  isValidCancellation,
  type CancellationReason,
  type PaymentMethod,
  type RepairStatus,
} from '@/utils/repair-logic';
import {
  calculatePartsCost,
  calculateRemainingStock,
  calculateRestoredStock,
  hasAvailableStock,
} from '@/utils/inventory-parts';
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
  /** Valor del repuesto usado (COP). 0 = sin repuestos. Se resta del presupuesto para la utilidad. */
  partsCost?: number;
  /** ID del repuesto del inventario vinculado (si proviene de public.inventory). */
  inventoryPartId?: string;
  /** Nombre del repuesto vinculado. */
  inventoryPartName?: string;
  /** Cantidad de piezas usadas del inventario. */
  inventoryPartQty?: number;
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
  /**
   * Fecha real de entrega/cobro (ISO). La estampa el trigger
   * `trg_repairs_delivered_at` al pasar a 'Entregado'; base del agrupado
   * mensual del panel de liquidación. Ausente en órdenes no entregadas.
   */
  deliveredAt?: string;
  /** Referencia al repuesto del inventario usado (para trazabilidad y descuento de stock). */
  inventoryPartId?: string;
  /** Nombre del repuesto (snapshot al momento de la orden). */
  inventoryPartName?: string;
  /** Cantidad de unidades del repuesto usadas. */
  inventoryPartQty?: number;
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
  /** Carga las reparaciones del taller desde Supabase (nube). Devuelve { ok, error } con el motivo técnico. */
  fetchRepairs: () => Promise<{ ok: boolean; error?: string }>;
  /** Crea la orden en Supabase y devuelve { ok, error }. NO finge éxito si la DB rechaza el INSERT. */
  addRepair: (repair: Omit<RepairItem, 'id' | 'status' | 'date'>) => Promise<{ ok: boolean; error?: string }>;
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
  /** Asigna un repuesto del inventario a la reparación y descuenta el stock automáticamente. */
  assignInventoryPartToRepair: (
    repairId: string,
    partId: string,
    quantity: number,
    customPrice?: number
  ) => Promise<boolean>;
  /** Remueve el repuesto de inventario de la reparación y reintegra el stock. */
  removeInventoryPartFromRepair: (repairId: string) => Promise<boolean>;
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
  parts_cost: number | null;
  inventory_part_id?: string | null;
  inventory_part_name?: string | null;
  inventory_part_qty?: number | null;
  advance_payment: number | null;
  payment_method: PaymentMethod | null;
  unlock_code: string | null;
  imei: string | null;
  technician_id: string | null;
  technician_name: string | null;
  motivo_cancelacion: string | null;
  status: string;
  date: string | null;
  /** Solo lectura: lo estampa el trigger trg_repairs_delivered_at (nunca se inserta desde el cliente). */
  delivered_at?: string | null;
  created_at?: string | null;
  /** Referencia al repuesto del inventario (FK a public.inventory.id). */
  inventory_part_id?: string | null;
  /** Nombre del repuesto (snapshot). */
  inventory_part_name?: string | null;
  /** Cantidad de unidades usadas. */
  inventory_part_qty?: number | null;
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
    parts_cost: item.partsCost ?? 0,
    inventory_part_id: item.inventoryPartId ?? null,
    inventory_part_name: item.inventoryPartName ?? null,
    inventory_part_qty: item.inventoryPartQty ?? 0,
    advance_payment: item.advancePayment ?? 0,
    payment_method: item.paymentMethod ?? null,
    unlock_code: item.unlockCode ?? null,
    imei: item.imei ?? null,
    technician_id: item.technicianId ?? null,
    technician_name: item.technicianName ?? null,
    motivo_cancelacion: item.motivoCancelacion ?? null,
    status: item.status,
    date: item.date,
    inventory_part_id: item.inventoryPartId ?? null,
    inventory_part_name: item.inventoryPartName ?? null,
    inventory_part_qty: item.inventoryPartQty ?? 0,
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
  if (patch.partsCost !== undefined) row.parts_cost = patch.partsCost;
  if (patch.inventoryPartId !== undefined) row.inventory_part_id = patch.inventoryPartId;
  if (patch.inventoryPartName !== undefined) row.inventory_part_name = patch.inventoryPartName;
  if (patch.inventoryPartQty !== undefined) row.inventory_part_qty = patch.inventoryPartQty;
  if (patch.unlockCode !== undefined) row.unlock_code = patch.unlockCode;
  if (patch.imei !== undefined) row.imei = patch.imei;
  if (patch.advancePayment !== undefined) row.advance_payment = patch.advancePayment;
  if (patch.paymentMethod !== undefined) row.payment_method = patch.paymentMethod;
  if (patch.technicianId !== undefined) row.technician_id = patch.technicianId;
  if (patch.technicianName !== undefined) row.technician_name = patch.technicianName;
  if (patch.motivoCancelacion !== undefined) row.motivo_cancelacion = patch.motivoCancelacion;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.inventoryPartId !== undefined) row.inventory_part_id = patch.inventoryPartId;
  if (patch.inventoryPartName !== undefined) row.inventory_part_name = patch.inventoryPartName;
  if (patch.inventoryPartQty !== undefined) row.inventory_part_qty = patch.inventoryPartQty;
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
    partsCost: row.parts_cost != null ? Number(row.parts_cost) : 0,
    inventoryPartId: row.inventory_part_id ?? undefined,
    inventoryPartName: row.inventory_part_name ?? undefined,
    inventoryPartQty: row.inventory_part_qty != null && Number(row.inventory_part_qty) > 0 ? Number(row.inventory_part_qty) : undefined,
    unlockCode: row.unlock_code ?? undefined,
    imei: row.imei ?? undefined,
    advancePayment: row.advance_payment != null ? Number(row.advance_payment) : undefined,
    paymentMethod: row.payment_method ?? undefined,
    technicianId: row.technician_id ?? undefined,
    technicianName: row.technician_name ?? undefined,
    motivoCancelacion: row.motivo_cancelacion ?? undefined,
    status: row.status as RepairStatus,
    date: row.date ?? (row.created_at?.split('T')[0] ?? ''),
    deliveredAt: row.delivered_at ?? undefined,
    inventoryPartId: row.inventory_part_id ?? undefined,
    inventoryPartName: row.inventory_part_name ?? undefined,
    inventoryPartQty: row.inventory_part_qty != null ? Number(row.inventory_part_qty) : undefined,
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

/** Serializa un error de Supabase (PostgrestError) para consola con el detalle técnico exacto. */
function formatDbError(
  operation: string,
  error: { code?: string; message?: string; details?: string; hint?: string } | null
): string {
  return (
    `[repair-context] ${operation} rechazado por Supabase: ` +
    JSON.stringify(
      {
        code: error?.code ?? null,
        message: error?.message ?? null,
        details: error?.details ?? null,
        hint: error?.hint ?? null,
      },
      null,
      2
    )
  );
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

  /**
   * Carga las reparaciones del taller desde Supabase (nube) y reemplaza el
   * estado local. Si no hay sesión, no hay taller resuelto o la consulta
   * falla, devuelve { ok: false, error } con el motivo técnico exacto.
   */
  const fetchRepairs = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      const msg = getSupabaseEnvError() ?? 'Supabase no está configurado.';
      console.error('[repair-context] fetchRepairs bloqueado: ' + msg);
      return { ok: false, error: msg };
    }
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.user) {
      const msg = sessionError
        ? `Error de sesión: ${sessionError.message}`
        : 'Sin sesión activa de Supabase: inicia sesión para cargar los datos de la nube.';
      console.error('[repair-context] fetchRepairs bloqueado: ' + msg);
      return { ok: false, error: msg };
    }
    const resolvedWorkshopId = await resolveWorkshopId();
    if (!resolvedWorkshopId) {
      const msg =
        'No se pudo resolver el taller (ensure_workshop()/current_workshop_id() devolvieron null): ' +
        'revisa que el RPC ensure_workshop esté aplicado en la BD y que haya sesión activa.';
      console.error('[repair-context] fetchRepairs bloqueado: ' + msg);
      return { ok: false, error: msg };
    }
    setWorkshopId(resolvedWorkshopId);
    const { data, error } = await supabase
      .from('repairs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error(formatDbError('fetchRepairs (select repairs)', error));
      return { ok: false, error: `Error al cargar reparaciones: ${error.message}` };
    }
    setRepairs(((data ?? []) as RepairRow[]).map(rowToRepair));
    return { ok: true };
  }, []);

  /** Carga el inventario del taller desde Supabase (nube). Mismo contrato que fetchRepairs. */
  const fetchInventory = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      const msg = getSupabaseEnvError() ?? 'Supabase no está configurado.';
      console.error('[repair-context] fetchInventory bloqueado: ' + msg);
      return { ok: false, error: msg };
    }
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.user) {
      const msg = sessionError ? `Error de sesión: ${sessionError.message}` : 'Sin sesión activa de Supabase.';
      console.error('[repair-context] fetchInventory bloqueado: ' + msg);
      return { ok: false, error: msg };
    }
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error(formatDbError('fetchInventory (select inventory)', error));
      return { ok: false, error: `Error al cargar inventario: ${error.message}` };
    }
    setInventory(((data ?? []) as InventoryRow[]).map(rowToInventory));
    return { ok: true };
  }, []);

  // Hidratación desde Supabase (una vez por usuario): sin Supabase configurado
  // o sin sesión, el estado queda vacío (demo local). Con sesión, llama a
  // fetchRepairs/fetchInventory (nube) y reporta el motivo técnico si falla.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Cada hidratación (por usuario) arranca con el estado vacío: evita
      // heredar datos del usuario anterior (logout / switch de cuenta).
      setHydrated(false);
      setWorkshopId(null);
      setLoadError(null);
      try {
        if (!isSupabaseConfigured) {
          if (!cancelled) {
            setWorkshopId(null);
            setRepairs([]);
            setInventory([]);
            setLoadError(getSupabaseEnvError() ?? 'Supabase no está configurado.');
          }
          return;
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          // Sin sesión Supabase: demo local, datos solo en memoria.
          if (!cancelled) {
            setWorkshopId(null);
            setRepairs([]);
            setInventory([]);
          }
          return;
        }
        const [repResult, invResult] = await Promise.all([fetchRepairs(), fetchInventory()]);
        if (!cancelled) {
          // Cada hidratación reemplaza el estado completo: si una consulta
          // falla, esa lista queda vacía en lugar de heredar datos del
          // usuario anterior, y el motivo técnico queda visible.
          if (!repResult.ok) {
            setLoadError(repResult.error ?? 'Error al cargar reparaciones.');
            setRepairs([]);
          }
          if (!invResult.ok) {
            setLoadError((prev) => prev ?? invResult.error ?? 'Error al cargar inventario.');
            setInventory([]);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[repair-context] hidratación falló:', error);
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
  }, [userId, fetchRepairs, fetchInventory]);

  /**
   * Registra una nueva reparación con un ID de orden único, corto y
   * alfanumérico (TRM-XXXX). Si el ID generado ya existe en el estado
   * actual, se reintenta hasta 10 veces antes de fallar.
   *
   * El INSERT se ejecuta OBLIGATORIAMENTE contra Supabase y la respuesta se
   * valida (sin error + fila devuelta por `.select('id')`). Si la DB rechaza
   * la operación (RLS, sesión, token o conexión), se devuelve { ok: false,
   * error } con el motivo exacto y el error se imprime en consola: NUNCA se
   * finge un guardado local.
   */
  const addRepair = async (
    newRep: Omit<RepairItem, 'id' | 'status' | 'date'>
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      const msg = getSupabaseEnvError() ?? 'Supabase no está configurado.';
      console.error('[repair-context] addRepair bloqueado: ' + msg);
      return { ok: false, error: msg };
    }

    // Resuelve el taller con auto-aprovisionamiento si la hidratación aún no
    // lo dejó listo (race). ensure_workshop() repara perfiles sin workshop.
    let wid = workshopId;
    if (!wid) {
      wid = await resolveWorkshopId();
      if (wid) setWorkshopId(wid);
    }
    if (!wid) {
      const msg =
        'No se pudo resolver el taller (ensure_workshop()/current_workshop_id() devolvieron null). ' +
        'Sin taller no se puede guardar: revisa que el RPC ensure_workshop esté aplicado.';
      console.error('[repair-context] addRepair bloqueado: ' + msg);
      return { ok: false, error: msg };
    }

    const existingIds = new Set(repairs.map((r) => r.id));
    let id = generateOrderId();
    let attempts = 0;
    while (existingIds.has(id) && attempts < 10) { id = generateOrderId(); attempts++; }
    if (existingIds.has(id)) { id = `${ORDER_PREFIX}-${Date.now().toString(36).slice(-4).toUpperCase()}`; }

    const item: RepairItem = { ...newRep, id, status: 'Pendiente', date: new Date().toISOString().split('T')[0] };

    // Si se seleccionó un repuesto del inventario, validar stock y descontar
    if (item.inventoryPartId && item.inventoryPartQty && item.inventoryPartQty > 0) {
      const part = inventory.find((p) => p.id === item.inventoryPartId);
      if (!part) {
        return { ok: false, error: 'El repuesto seleccionado ya no existe en el inventario.' };
      }
      if (part.stock < item.inventoryPartQty) {
        return { ok: false, error: `Stock insuficiente: solo quedan ${part.stock} unidad(es) de "${part.name}".` };
      }
      // Calcular partsCost automáticamente: precio * cantidad
      item.partsCost = Number(part.price) * item.inventoryPartQty;
      // Snapshot del nombre por si el repuesto se renombra después
      item.inventoryPartName = part.name;
    }

    const { data, error } = await supabase.from('repairs').insert(repairToRow(item, wid)).select('id');
    if (error) {
      if (String(error.code) === '23505') {
        console.error(formatDbError('addRepair (insert, colisión 23505)', error));
        const retryId = `${ORDER_PREFIX}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
        const retryItem: RepairItem = { ...item, id: retryId };
        const { data: retryData, error: retryError } = await supabase
          .from('repairs')
          .insert(repairToRow(retryItem, wid))
          .select('id');
        if (retryError) {
          console.error(formatDbError('addRepair (reintento por 23505)', retryError));
          return { ok: false, error: `No se pudo guardar la reparación: ${retryError.message}` };
        }
        if (!retryData || retryData.length !== 1) {
          const msg = 'No se pudo confirmar la reparación en la base de datos (respuesta vacía tras INSERT).';
          console.error('[repair-context] ' + msg);
          return { ok: false, error: msg };
        }
        // Descontar stock del inventario si se usó un repuesto (reintento)
        if (retryItem.inventoryPartId && retryItem.inventoryPartQty && retryItem.inventoryPartQty > 0) {
          await updateInventoryStock(retryItem.inventoryPartId, -retryItem.inventoryPartQty);
        }
        setRepairs((prev) => [retryItem, ...prev]);
        return { ok: true };
      }
      console.error(formatDbError('addRepair (insert)', error));
      return { ok: false, error: `No se pudo guardar la reparación: ${error.message}` };
    }
    if (!data || data.length !== 1) {
      const msg = 'No se pudo confirmar la reparación en la base de datos (respuesta vacía tras INSERT).';
      console.error('[repair-context] ' + msg);
      return { ok: false, error: msg };
    }
    // Descontar stock del inventario si se usó un repuesto
    if (item.inventoryPartId && item.inventoryPartQty && item.inventoryPartQty > 0) {
      await updateInventoryStock(item.inventoryPartId, -item.inventoryPartQty);
    }
    setRepairs((prev) => [item, ...prev]);
    return { ok: true };
  };

  const updateRepairStatus = async (id: string, status: RepairStatus): Promise<void> => {
    const blockReason = requireWorkshop();
    if (blockReason) { notifyError(blockReason); return; }
    const { error } = await supabase.from('repairs').update(repairPatchToRow({ status })).eq('id', id);
    if (error) { console.error(formatDbError('updateRepairStatus (update)', error)); notifyError(`No se pudo actualizar el estado: ${error.message}`); return; }
    setRepairs((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  /** Edita campos de una reparación existente (no status ni cancelación). */
  const updateRepair = async (id: string, patch: Partial<Omit<RepairItem, 'id' | 'date' | 'status' | 'motivoCancelacion'>>): Promise<void> => {
    const blockReason = requireWorkshop();
    if (blockReason) { notifyError(blockReason); return; }
    const { error } = await supabase.from('repairs').update(repairPatchToRow(patch)).eq('id', id);
    if (error) { console.error(formatDbError('updateRepair (update)', error)); notifyError(`No se pudo actualizar la reparación: ${error.message}`); return; }
    setRepairs((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  /**
   * Cancela la reparación con un motivo obligatorio (texto libre). Devuelve
   * true si se aplicó la cancelación, false si el estado no lo permite o el
   * motivo está vacío.
   * Si la orden tenía un repuesto de inventario asignado, reintegra automáticamente
   * el stock al inventario.
   */
  const cancelRepair = async (id: string, motivo: string): Promise<boolean> => {
    const cleanMotivo = motivo.trim();
    const target = repairs.find((r) => r.id === id);
    if (!target || !isValidCancellation(target.status, cleanMotivo)) return false;
    const blockReason = requireWorkshop();
    if (blockReason) { notifyError(blockReason); return false; }

    // Reintegrar stock al inventario si la orden tenía pieza vinculada
    if (target.inventoryPartId) {
      const prevPart = inventory.find((p) => p.id === target.inventoryPartId);
      if (prevPart) {
        const qty = target.inventoryPartQty ?? 1;
        const restoredStock = calculateRestoredStock(prevPart.stock, qty);
        const { error: stockErr } = await supabase
          .from('inventory')
          .update({ stock: restoredStock })
          .eq('id', prevPart.id);
        if (!stockErr) {
          setInventory((prev) =>
            prev.map((p) => (p.id === prevPart.id ? { ...p, stock: restoredStock } : p))
          );
        }
      }
    }

    const { error } = await supabase
      .from('repairs')
      .update({
        status: 'Cancelado / No Reparado',
        motivo_cancelacion: cleanMotivo,
        inventory_part_id: null,
        inventory_part_name: null,
        inventory_part_qty: 0,
        parts_cost: 0,
      })
      .eq('id', id);
    if (error) {
      console.error(formatDbError('cancelRepair (update)', error));
      notifyError(`No se pudo cancelar la orden: ${error.message}`);
      return false;
    }
    setRepairs((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'Cancelado / No Reparado' as RepairStatus,
              motivoCancelacion: cleanMotivo,
              inventoryPartId: undefined,
              inventoryPartName: undefined,
              inventoryPartQty: undefined,
              partsCost: 0,
            }
          : r
      )
    );
    return true;
  };

  /** Elimina definitivamente una orden. SOLO el dueño/admin del taller.
   *  Devuelve true si existía y fue eliminada de la nube. */
  const deleteRepair = async (id: string): Promise<boolean> => {
    if (!repairs.some((r) => r.id === id)) return false;
    if (currentUser?.role !== 'admin') {
      notifyError('Solo el dueño del taller puede eliminar órdenes.');
      return false;
    }
    const blockReason = requireWorkshop();
    if (blockReason) { notifyError(blockReason); return false; }
    const { data, error } = await supabase.from('repairs').delete().eq('id', id).select('id');
    if (error) {
      console.error(formatDbError('deleteRepair (delete)', error));
      notifyError(`No se pudo eliminar la orden: ${error.message}`);
      return false;
    }
    if (!data || data.length === 0) {
      notifyError('No se pudo eliminar la orden: no pertenece a tu taller o ya no existe.');
      return false;
    }
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
    if (error) { console.error(formatDbError('recordRepairPayment (update)', error)); notifyError(`No se pudo registrar el pago: ${error.message}`); return; }
    setRepairs((prev) => prev.map((r) => r.id === id ? { ...r, advancePayment: result.newAdvance, paymentMethod: method } : r));
  };

  const addInventoryPart = async (part: Omit<InventoryPart, 'id'>): Promise<void> => {
    const blockReason = requireWorkshop();
    if (blockReason) { notifyError(blockReason); return; }
    const { data, error } = await supabase.from('inventory').insert(inventoryToRowItem(part, workshopId!)).select('id').single();
    if (error || !data) { console.error(formatDbError('addInventoryPart (insert)', error)); notifyError(`No se pudo agregar la pieza: ${error?.message ?? 'respuesta vacía'}`); return; }
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
    if (error) { console.error(formatDbError('updateInventoryStock (update)', error)); notifyError(`No se pudo actualizar el stock: ${error.message}`); return; }
    setInventory((prev) => prev.map((p) => (p.id === id ? { ...p, stock } : p)));
  };

  /**
   * Asigna un repuesto de inventario a una orden de reparación, descontando
   * automáticamente el stock de la pieza en la BD y reintegrando el stock
   * de cualquier pieza previamente asignada.
   */
  const assignInventoryPartToRepair = async (
    repairId: string,
    partId: string,
    quantity: number,
    customPrice?: number
  ): Promise<boolean> => {
    const target = repairs.find((r) => r.id === repairId);
    if (!target) {
      notifyError('Orden de reparación no encontrada.');
      return false;
    }
    const part = inventory.find((p) => p.id === partId);
    if (!part) {
      notifyError('Pieza de inventario no encontrada.');
      return false;
    }
    const blockReason = requireWorkshop();
    if (blockReason) {
      notifyError(blockReason);
      return false;
    }

    const prevPartId = target.inventoryPartId;
    const prevQty = target.inventoryPartQty ?? 1;

    // Caso 1: misma pieza, se ajusta la cantidad o precio
    if (prevPartId && prevPartId === partId) {
      const delta = quantity - prevQty;
      if (delta > 0 && !hasAvailableStock(part.stock, delta)) {
        notifyError(`Stock insuficiente de "${part.name}". Disponible adicional: ${part.stock}`);
        return false;
      }
      const newPartStock = calculateRemainingStock(part.stock, delta);
      const { error: invError } = await supabase
        .from('inventory')
        .update({ stock: newPartStock })
        .eq('id', partId);
      if (invError) {
        console.error(formatDbError('assignInventoryPartToRepair (update inventory)', invError));
        notifyError(`No se pudo actualizar el inventario: ${invError.message}`);
        return false;
      }

      const partsCost = calculatePartsCost(part.price, quantity, customPrice);
      const { error: repError } = await supabase
        .from('repairs')
        .update({
          parts_cost: partsCost,
          inventory_part_id: partId,
          inventory_part_name: part.name,
          inventory_part_qty: quantity,
        })
        .eq('id', repairId);
      if (repError) {
        console.error(formatDbError('assignInventoryPartToRepair (update repair)', repError));
        notifyError(`No se pudo actualizar la orden: ${repError.message}`);
        return false;
      }

      setInventory((prev) => prev.map((p) => (p.id === partId ? { ...p, stock: newPartStock } : p)));
      setRepairs((prev) =>
        prev.map((r) =>
          r.id === repairId
            ? {
                ...r,
                partsCost,
                inventoryPartId: partId,
                inventoryPartName: part.name,
                inventoryPartQty: quantity,
              }
            : r
        )
      );
      return true;
    }

    // Caso 2: pieza diferente o primera asignación
    if (!hasAvailableStock(part.stock, quantity)) {
      notifyError(`Stock insuficiente de "${part.name}". Stock disponible: ${part.stock}`);
      return false;
    }

    // Si había una pieza previa diferente, devolvemos su stock
    if (prevPartId) {
      const prevPart = inventory.find((p) => p.id === prevPartId);
      if (prevPart) {
        const restoredStock = calculateRestoredStock(prevPart.stock, prevQty);
        await supabase.from('inventory').update({ stock: restoredStock }).eq('id', prevPartId);
        setInventory((prev) =>
          prev.map((p) => (p.id === prevPartId ? { ...p, stock: restoredStock } : p))
        );
      }
    }

    // Descontar stock de la nueva pieza
    const newPartStock = calculateRemainingStock(part.stock, quantity);
    const { error: invError } = await supabase
      .from('inventory')
      .update({ stock: newPartStock })
      .eq('id', partId);
    if (invError) {
      console.error(formatDbError('assignInventoryPartToRepair (deduct inventory)', invError));
      notifyError(`No se pudo actualizar el inventario: ${invError.message}`);
      return false;
    }

    const partsCost = calculatePartsCost(part.price, quantity, customPrice);
    const { error: repError } = await supabase
      .from('repairs')
      .update({
        parts_cost: partsCost,
        inventory_part_id: partId,
        inventory_part_name: part.name,
        inventory_part_qty: quantity,
      })
      .eq('id', repairId);
    if (repError) {
      console.error(formatDbError('assignInventoryPartToRepair (update repair)', repError));
      notifyError(`No se pudo actualizar la orden: ${repError.message}`);
      return false;
    }

    setInventory((prev) => prev.map((p) => (p.id === partId ? { ...p, stock: newPartStock } : p)));
    setRepairs((prev) =>
      prev.map((r) =>
        r.id === repairId
          ? {
              ...r,
              partsCost,
              inventoryPartId: partId,
              inventoryPartName: part.name,
              inventoryPartQty: quantity,
            }
          : r
      )
    );
    return true;
  };

  /**
   * Remueve el repuesto asignado a la orden, reintegrando el stock al inventario
   * si la pieza provenía del inventario.
   */
  const removeInventoryPartFromRepair = async (repairId: string): Promise<boolean> => {
    const target = repairs.find((r) => r.id === repairId);
    if (!target) return false;
    const blockReason = requireWorkshop();
    if (blockReason) {
      notifyError(blockReason);
      return false;
    }

    if (target.inventoryPartId) {
      const prevPart = inventory.find((p) => p.id === target.inventoryPartId);
      if (prevPart) {
        const qty = target.inventoryPartQty ?? 1;
        const restoredStock = calculateRestoredStock(prevPart.stock, qty);
        await supabase.from('inventory').update({ stock: restoredStock }).eq('id', prevPart.id);
        setInventory((prev) =>
          prev.map((p) => (p.id === prevPart.id ? { ...p, stock: restoredStock } : p))
        );
      }
    }

    const { error } = await supabase
      .from('repairs')
      .update({
        parts_cost: 0,
        inventory_part_id: null,
        inventory_part_name: null,
        inventory_part_qty: 0,
      })
      .eq('id', repairId);
    if (error) {
      console.error(formatDbError('removeInventoryPartFromRepair (update)', error));
      notifyError(`No se pudo remover el repuesto: ${error.message}`);
      return false;
    }

    setRepairs((prev) =>
      prev.map((r) =>
        r.id === repairId
          ? {
              ...r,
              partsCost: 0,
              inventoryPartId: undefined,
              inventoryPartName: undefined,
              inventoryPartQty: undefined,
            }
          : r
      )
    );
    return true;
  };

  return (
    <RepairContext.Provider
      value={{
        repairs,
        inventory,
        hydrated,
        loadError,
        fetchRepairs,
        addRepair,
        updateRepairStatus,
        updateRepair,
        cancelRepair,
        deleteRepair,
        recordRepairPayment,
        addInventoryPart,
        updateInventoryStock,
        assignInventoryPartToRepair,
        removeInventoryPartFromRepair,
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
# 🛡️ Auditoría General Adversaria — TechRepair Master

**Fecha:** 2026-09-10
**Agente Auditor:** 💻 **Código** (OpenCode) + 1 subagente (reparaciones)
**Alcance:** TODA la estructura — puertas automáticas, sondas en vivo, barrido estático adversarial archivo por archivo.
**Regla del informe:** solo hallazgos verificados contra código real. Sin teoría.

---

## ✅ Puertas automáticas (todo en verde)

| Puerta | Resultado |
|---|---|
| TypeScript `npx tsc --noEmit` | 0 errores |
| Suite unitaria `npm test` | 157/157 PASS |
| Pipeline invitaciones | 6/6 checks PASS |
| Producción `/`, `/login`, `/signup` | HTTP 200 |
| Ruta inexistente | HTTP 200 (fallback SPA normal, el router muestra 404) |

## 🎯 Hallazgo A — Deriva base de datos vs planos (verificado en vivo)

El guard de esquema detectó **6 objetos que existen en la base real pero no en `schema.sql`**: columnas `workshops.trial_ends_at`, `subscription_ends_at`, `status` y funciones `list_all_workshops`, `list_all_profiles`, `activate_workshop`. Parecen restos de un sistema anterior. **Pendiente verificar:** con qué permisos quedaron esas 3 funciones — si las puede llamar cualquier usuario, verían datos de otros talleres.

## 🔴 Hallazgos B — Reparaciones e inventario (verificados en código)

1. **[CRÍTICO] Doble-clic al guardar** (`src/app/(tabs)/receive.tsx`, `handleSave` sin estado `submitting`): dos toques rápidos crean **dos órdenes duplicadas y descuentan inventario dos veces**. Dirección: bloquear el botón mientras guarda (`finally`).
2. **[CRÍTICO] Stock se descuadra en silencio** (`src/context/repair-context.tsx`, `assignInventoryPartToRepair` ~842-860): si la nube rechaza el descuento, igual actualiza la pantalla local y reporta éxito. Dirección: abortar y retornar `false` ante `invError`.
3. **[CRÍTICO] Descuento de stock no atómico** (`updateInventoryStock` ~708-717, lectura-modificación-escritura): dos mostradores simultáneos calculan sobre el mismo stock. Dirección: RPC `decrement_stock` en Postgres.
4. **[ALTO] Botones reviven órdenes canceladas** (`src/app/(tabs)/jobs.tsx` ~382-404, `disabled={item.status === st}`): en canceladas todos quedan activos y reactivan la orden con presupuesto en $0. Dirección: bloquear por estado terminal + validar transición en `updateRepairStatus`.
5. **[ALTO] Buscador de inventario se cae con repuestos sin nombre** (`src/utils/inventory-parts.ts:69`, `src/app/(tabs)/inventory.tsx:55-56`, `.toLowerCase()` sin guarda). Dirección: `(item.name ?? '')`.
6. **[ALTO] Guardado reporta fallo aunque sí guardó** (`addRepair`, `insert.select('id')` vacío por RLS): el usuario reintenta y **duplica la orden**. Dirección: validar por `error`, no por filas devueltas.
7. **[MEDIO] Modal de cancelación queda stale** (`src/app/job/[id].tsx` ~254-279): si la orden cambió de estado mientras el modal estaba abierto, no se cierra ni refresca.
8. **[MEDIO] Nombres nulos** (`src/utils/repair-logic.ts`, parámetro `technicianName` sin guarda + `item.phone.replace` en `jobs.tsx:105`): crash con datos legacy sin teléfono o usuario sin nombre.
9. **[MEDIO] Reintento único de folio** (colisión `23505`): dos recepciones en el mismo milisegundo fallan sin segundo intento.

## ✅ Zonas revisadas y SANAS (sin hallazgos)

Cálculos de dinero (compra/venta/comisiones/pagos: todos con guardas `isNaN`/`isFinite`), matemática de prueba gratuita, hidratación del panel con sesión nula, registro con doble-envío, limpieza de suscripciones realtime, orden inexistente en detalle, validación de stock con regex.


## 🔵 Hallazgos C — Auditoría Adversaria Estructural Asumida por Gravedad (Verificados en Código)

1. **[CRÍTICO / SEGURIDAD] Omisión de RLS en tabla `devices` en `supabase/schema.sql`**
   - `supabase/schema.sql` declara `create table if not exists public.devices` (líneas 129-167), pero en el bloque consolidado de seguridad (líneas 1120-1127) **falta `alter table public.devices enable row level security;`** y no se define ninguna política de aislamiento por taller.
   - *Impacto:* Si se levanta o resetea la BD con `schema.sql`, cualquier cliente anónimo con la clave pública `anon` puede leer, alterar o borrar todos los equipos, IMEI, precios de compra mayorista y márgenes de todos los talleres.
   - *Dirección:* Habilitar RLS y recrear la política `devices_workshop_all` en `schema.sql`.
   - *Asignado a:* 🌀 **Gravedad**.

2. **[CRÍTICO / CRASH] Caída por `TypeError` en `winAnsi` al Generar Recibos PDF Web**
   - `src/utils/receipt-pdf.web.ts:6-15` y `src/utils/device-receipt-pdf.web.ts:6-15`: `winAnsi(value: string)` invoca `value.replace(...)` directo sin validar tipos.
   - *Impacto:* Si `clientPhone`, `device`, `issue`, `attendedBy`, `address` o `phone` es nulo o indefinido, la generación del PDF colapsa con `TypeError: Cannot read properties of undefined (reading "replace")`.
   - *Dirección:* Normalizar a `winAnsi(value: unknown)` con coalescencia nula `if (!value) return ""; return String(value).replace(...)`.
   - *Asignado a:* 🌀 **Gravedad**.

3. **[CRÍTICO / CRASH] Caída por `TypeError` en `escapeHtml` en Recibos Nativos**
   - `src/app/receipt/[id].tsx:16-23` y `src/app/device-receipt/[id].tsx:16-23` duplican un helper privado `escapeHtml(value: string)` sin guardas.
   - *Impacto:* Crash en runtime en iOS y Android si faltan campos opcionales del perfil del taller o la orden.
   - *Dirección:* Reutilizar el helper blindado de `src/utils/comanda-template.ts`.
   - *Asignado a:* 🌀 **Gravedad**.

4. **[ALTO / CONTABILIDAD] Destrucción del Registro de Anticipos en Cancelaciones**
   - `src/context/repair-context.tsx` (`cancelRepair` ~190-205): sobreescribe `advance_payment: 0` y `budget: 0` en la BD al cancelar una orden.
   - *Impacto:* Si el cliente dejó un anticipo en efectivo de $50,000 COP, se borra el rastro contable del dinero recibido en caja, imposibilitando arqueos diarios y trazabilidad para devoluciones.
   - *Dirección:* Preservar montos originales intactos en la orden cancelada para auditoría contable.
   - *Asignado a:* 🌀 **Gravedad**.

5. **[ALTO / INVENTARIO] Inflación Fantasma de Stock al Eliminar Órdenes Entregadas**
   - `src/context/repair-context.tsx` (`deleteRepair` ~210-225): suma +1 al stock del repuesto incondicionalmente (`updateInventoryStock(target.inventoryPartId, 1)`).
   - *Impacto:* Si se elimina una orden con estado `"Entregado"` de hace meses (pieza física ya instalada y en manos del cliente), el sistema suma stock fantasma inexistente al taller.
   - *Dirección:* Reingresar stock únicamente si la orden NO estaba en estado terminal `"Entregado"`.
   - *Asignado a:* 🌀 **Gravedad**.

6. **[ALTO / PAYWALL] Falso Positivo de Expiración en Talleres Activos**
   - `src/utils/monetization-trial.ts` (`isWorkshopExpired` ~40-55): si un taller tiene `status: "active"` pero `subscription_ends_at = null` (cuentas vitalicias o especiales), evalúa el trial de 90 días vencido y bloquea la cuenta activa.
   - *Dirección:* Si `status === "active"` sin fecha de fin, tratar como activo sin degradar a trial.
   - *Asignado a:* 🌀 **Gravedad**.

7. **[ALTO / CRASH] Caída por `localeCompare` al Ordenar Técnicos sin Nombre**
   - `src/utils/billing-performance.ts:80-95`: `a.technicianName.localeCompare(...)` falla con `TypeError` ante registros históricos sin snapshot de nombre o tras desvinculaciones incompletas.
   - *Dirección:* Coalescencia nula `(a.technicianName ?? "").localeCompare(b.technicianName ?? "", "es", ...)`.
   - *Asignado a:* 🌀 **Gravedad**.

8. **[MEDIO / FECHAS & FOLIOS] Desbordamiento de Mes en Garantías y Colisión de Folios**
   - `src/utils/device-logic.ts:25-45`: `calculateWarrantyExpiry` no valida fechas vacías (crash con `.split("-")`) y sumar meses en JavaScript a fines de mes (ej. 31 enero + 1 mes) desborda a marzo (`2026-03-03`) en lugar de ajustar al 28 de febrero.
   - `generateDeviceInvoiceFolio` usa solo 4 dígitos aleatorios (1000..9999), provocando alta probabilidad de colisión de folios en ventas de equipos por mes.
   - *Asignado a:* 🌀 **Gravedad**.

9. **[MEDIO / CRASH] Null Pointer en Búsqueda de Clientes**
   - `src/app/(tabs)/customers.tsx:37`: `r.clientName.trim().toLowerCase()` rompe la pantalla si `clientName` es nulo.
   - *Dirección:* `(r.clientName ?? "").trim().toLowerCase()`.
   - *Asignado a:* 🌀 **Gravedad**.

10. **[MEDIO / NAVEGACIÓN] Pantalla `production.tsx` No Declarada en Root Layout**
    - `src/app/_layout.tsx`: pantalla huérfana en el árbol de rutas de Expo Router nativo.
    - *Dirección:* Registrar `<Stack.Screen name="production" options={{ title: "Producción" }} />`.
    - *Asignado a:* 🌀 **Gravedad**.

11. **[BAJO / ENLACES] Enlaces de WhatsApp con Tildes sin Codificar**
    - `admin.tsx:354`, `index.tsx:25` y `paywall.tsx:24` tienen tildes (`ó`, `á`) en URLs directas sin `encodeURIComponent()`.
    - *Asignado a:* 🌀 **Gravedad**.

---

## 🤝 Matriz de Distribución y Plan de Reparación Coordinado

| Frente | Responsable | Tareas Asignadas |
|---|---|---|
| **Flujos de Mostrador y Transiciones** | 💻 **Código** (OpenCode) | **T1:** Bloquear doble-guardado en recepción (`receive.tsx`).<br>**T2:** Abortar estado local si la nube rechaza descuento en `assignInventoryPartToRepair`.<br>**T3:** RPC atómica `decrement_stock` en PostgreSQL.<br>**T4:** Bloquear botones en órdenes canceladas en `jobs.tsx` y validar transiciones.<br>**T5:** Guardas nulas en buscador de repuestos (`inventory-parts.ts`).<br>**T6:** Auditoría de permisos en funciones `list_all_*` de super-admin. |
| **Core PDF, RLS, Contabilidad y Layout** | 🌀 **Gravedad** (Antigravity) | **G1:** Activar RLS y políticas para `devices` en `schema.sql`.<br>**G2:** Blindar `winAnsi` contra nulos en `receipt-pdf.web.ts` y `device-receipt-pdf.web.ts`.<br>**G3:** Blindar `escapeHtml` en vistas de recibos nativos.<br>**G4:** Proteger contabilidad de anticipos en cancelaciones (`repair-context.tsx`).<br>**G5:** Evitar inflación de inventario en eliminación de órdenes entregadas.<br>**G6:** Corregir falso positivo de paywall en talleres activos (`monetization-trial.ts`).<br>**G7:** Blindar `billing-performance.ts` y `customers.tsx` contra nulos.<br>**G8:** Reparar cálculo de meses de garantía y folios en `device-logic.ts`.<br>**G9:** Registrar `production` en `_layout.tsx` y codificar URLs de WhatsApp. |

---

## 📋 Tareas de Reparación Activas

### Cola para Código (OpenCode):
- [ ] T1: bloquear doble-guardado en recepción (`submitting` + `finally`).
- [ ] T2: abortar estado local si la nube rechaza el descuento de stock.
- [ ] T3: RPC atómica `decrement_stock` (requiere SQL en Supabase).
- [ ] T4: bloquear botones de estado en órdenes terminales + validación de transición.
- [ ] T5: guardas nulas en buscadores (`inventory-parts.ts:69`, `jobs.tsx:105`).
- [ ] T6: verificar permisos de `list_all_*` y limpiar deriva de esquema.

### Cola para Gravedad (Antigravity):
- [ ] G1: habilitar RLS y políticas en `schema.sql` para tabla `devices`.
- [ ] G2: blindar `winAnsi` contra `null`/`undefined` en generadores PDF.
- [ ] G3: unificar `escapeHtml` seguro en `receipt/[id].tsx` y `device-receipt/[id].tsx`.
- [ ] G4: preservar `advance_payment` en cancelación de órdenes (`repair-context.tsx`).
- [ ] G5: condicionar devolución de stock en `deleteRepair` para omitir órdenes `"Entregado"`.
- [ ] G6: corregir evaluación de talleres `active` en `isWorkshopExpired` (`monetization-trial.ts`).
- [ ] G7: blindar `technicianName.localeCompare` y `customers.tsx` contra nulos.
- [ ] G8: corregir desbordamiento de fin de mes en `device-logic.ts`.
- [ ] G9: registrar `production.tsx` en `RootNavigator` de `_layout.tsx` y codificar URLs WhatsApp.

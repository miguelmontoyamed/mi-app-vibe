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

## ⏳ Cobertura pendiente (agentes sin cuota gratuita)

Auditoría profunda dedicada de accesos/OAuth, facturación mensual/RPCs y shell de navegación. Se reintentará con cuota fresca o la asume Gravedad.

---

## 📋 Tareas propuestas (para tu orden "ejecuta")

- [ ] T1: bloquear doble-guardado en recepción (`submitting` + `finally`).
- [ ] T2: abortar estado local si la nube rechaza el descuento de stock.
- [ ] T3: RPC atómica `decrement_stock` (requiere SQL en Supabase).
- [ ] T4: bloquear botones de estado en órdenes terminales + validación de transición.
- [ ] T5: guardas nulas en buscadores, WhatsApp y nombres.
- [ ] T6: verificar permisos de `list_all_*` y limpiar deriva de esquema.

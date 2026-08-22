# Active Context — TechRepair Master

> **Documento de estado actual.** Leer SIEMPRE antes de comenzar cualquier tarea.
> Actualizar al finalizar cada tarea (ver `progress.md`).

## Estado Actual (Consolidado — verificado contra el código)
- **Asignación y reasignación de técnico en órdenes operativa (2026-08-21):**
  - Al crear (`receive.tsx`): selector "Asignar a" con chips — el usuario actual
    primero (`(tú)`, default = comportamiento histórico) + el resto de miembros
    activos del taller desde `useAuth().users`; el id/nombre elegido viaja en
    `addRepair({ technicianId, technicianName })`. El elegido NO se persiste en
    el blob `receiptData` de AsyncStorage.
  - Al editar (`job/[id].tsx`): botón "👥 Reasignar técnico" (oculto si la
    orden está cancelada) + modal con chips (asignado actual marcado
    "(actual)", self "(tú)") → `updateRepair(id, { technicianId,
    technicianName })`. Visible para CUALQUIER miembro que pueda ver la orden:
    RLS `repairs_workshop_update` ya autoriza UPDATE a todo el taller, así un
    técnico que no puede continuar pasa la orden a otro. Sin migración SQL.
  - Privacidad intacta: `visibleRepairs`/`canViewRepair` siguen filtrando —
    el técnico solo ve SUS órdenes; al reasignar, la orden desaparece de su
    lista y aparece en la del nuevo técnico.
- **Búsqueda multicriterio en tiempo real operativa** en
  `src/app/(tabs)/jobs.tsx`: filtra por **Folio TRM**, **IMEI/Serial**,
  **Teléfono** y **Nombre del Cliente** (`normalizeSearch()` + chips de estado).
- **Compartir recibo en PDF por WhatsApp operativo en TODOS los dispositivos:**
  - Web (`src/utils/receipt-pdf.web.ts`): `jspdf` genera el PDF real y el
    **Web Share API** abre WhatsApp/otras apps (`navigator.share({files})`);
    en PC donde no hay share, **fallback de descarga** (`<a download>`).
  - Nativo (`src/utils/receipt-pdf.ts`): `expo-print` → `expo-sharing`.
  - Membrete del taller, **cálculo DIAN Módulo 11** (`src/utils/nit.ts`),
    botones de impresión web y de compartir por WhatsApp/PDF con feedback.
- **Panel de Liquidación y Rendimiento Mensual por Técnico operativo
  (histórico mes a mes):**
  - `repairs.delivered_at` (fecha real de entrega/cobro) estampada por el
    trigger `trg_repairs_delivered_at` al pasar a 'Entregado' (se limpia si
    sale del estado); backfill aplicado con `updated_at` para órdenes previas.
  - RPC `get_technician_monthly_performance(p_period 'YYYY-MM')`
    (SECURITY DEFINER, taller resuelto desde la sesión, sin sesión → vacío):
    agrupa las órdenes ENTREGADAS por MES DE ENTREGA real
    (`coalesce(delivered_at, updated_at, date)::date`) y devuelve por técnico:
    órdenes entregadas, total recaudado (`budget`), repuestos (`parts_cost`),
    producción neta (Σ `max(budget − parts_cost, 0)`), comisión a liquidar
    (Σ redondeo de producción neta × `commission_rate`, fracción 0–1) y
    ganancia neta del taller. Órdenes legacy sin `technician_id` se agrupan
    por nombre histórico con comisión 0. Aplicada en vivo a la BD real.
  - Tipado estricto en `src/types/billing.ts` (`TechnicianMonthlyPerformance`,
    `MonthlyBreakdownSummary`, `PeriodOption`; cero `any`).
  - Lógica pura testeable en `src/utils/billing-performance.ts` (+9 tests:
    periodos disponibles, etiquetas es-CO, resumen global).
  - `BillingProvider.fetchMonthlyPerformance(period)` en
    `src/context/billing-context.tsx`: llama a la RPC y normaliza numeric → number.
  - UI en `admin.tsx`: selector de periodo (Mes Actual "En Curso" + meses
    archivados de `monthly_closures` y entregas, solo lectura), tarjeta de
    resumen global (Facturado / Repuestos / Comisiones por Pagar / Utilidad
    Neta) y tarjetas por técnico con badge de %, métricas COP exactas y fila
    destacada "Por liquidar al técnico".
- **Cierres de mes operativos** (snapshot mensual para verificación futura +
   facturación inmediata del mes nuevo):
  - Tabla `public.monthly_closures` (workshop_id, period 'YYYY-MM', revenue,
    parts_cost, delivered_count, cancelled_count, total_count) con RLS de SOLO
    lectura por taller.
  - RPC `ensure_month_closure()` (SECURITY DEFINER, idempotente): cierra los
    meses vencidos sin cierre y devuelve el periodo abierto ('YYYY-MM').
    Aplicada en vivo a la BD real (verificada 2 ejecuciones).
  - `src/context/billing-context.tsx` (`BillingProvider`/`useBilling`) en
    `src/app/_layout.tsx`: al abrir la app con sesión, ejecuta el RPC
    (auto-cierre) y expone `currentPeriod` + `closures` históricos.
- **Seguridad RLS multi-tenant por `workshop_id`** completada: toda tabla filtra
  por taller; RPCs `security definer` sin sesión bloqueadas.
- **Sistema de invitaciones por token temporal (10 min)** y **gestión de
  técnicos (hasta `MAX_TECHNICIANS = 5`)** completados.
- **Monetización Bre-B activa** (Llave: `3002011801`, 20.000 COP/mes) con
  **acumulación matemática de tiempo** de suscripción (90 días de prueba,
  alerta visual a 10 días del vencimiento).
- **Fix de sesiones obsoletas aplicado y desplegado:** un JWT de un usuario
  eliminado ya no bloquea `fetchRepairs`; el cliente se auto-desloguea.

## Foco Operativo Inmediato (Sprint Actual)
**Esperando definición de siguiente módulo de mostrador:** UI de patrón de
desbloqueo 3x3 en recepción o estandarización de modales MD3. El módulo de
liquidación mensual quedó consolidado y en producción (2026-08-21); la
exportación contable fue DESCARTADA del backlog (2026-08-22).

## Decisiones Recientes
- **Liquidación en tiempo real (2026-08-21):** el panel se suscribe a
  `postgres_changes` sobre `public.repairs` (canal `admin-liquidacion-realtime`)
  con DEBOUNCE de 800 ms que incrementa `realtimeTick`, dependencia del efecto
  que llama a la RPC. Requiere `repairs` en la publicación `supabase_realtime`
  (migración idempotente; la visibilidad de eventos respeta RLS por taller).
  El setState ocurre en el callback de la suscripción, nunca síncrono en el
  cuerpo del efecto (regla react-hooks/set-state-in-effect).
- **RPC liquidación (fix 2026-08-21):** `count(*)` devuelve bigint y
  `RETURN QUERY` no downcastea → error 42804 solo con usuario REAL (con
  service_role `auth.uid()` es null y la función salía temprano: por eso el
  smoke test no lo detectó). Fix: `count(*)::int`. Para probar RPCs con
  sesión simulada vía CLI: `supabase db query --linked` + set_config de
  `request.jwt.claims` en un statement con CROSS JOIN LATERAL.
- **Lint react-hooks (2026-08-21):** el periodo por defecto del panel de
  liquidación es DERIVADO (`effectivePeriod = selectedPeriod ?? currentPeriod
  ?? periodOptions[0]?.period`), sin efecto de ajuste; el spinner de carga se
  deriva comparando `loadedPeriod` vs `effectivePeriod` (todos los setState de
  la RPC ocurren tras el await). `jobs.tsx`/`customers.tsx` memoizan ANTES del
  guard de autenticación (regla de hooks) devolviendo vacío sin usuario. El
  dashboard lee el reloj con `useSyncExternalStore` (snapshot SSR = valor
  enorme para no disparar la alerta de trial en HTML estático). Quedan 3
  warnings de variables sin usar (refreshBilling, supabase, notifyError).
- **Liquidación mensual:** la comisión se liquida sobre la PRODUCCIÓN NETA
  (`max(budget − parts_cost, 0)`) con `commission_rate` como FRACCIÓN 0–1
  (0.30 = 30%), idéntico a `commissionForRepair()`; el agrupado mensual usa la
  FECHA DE ENTREGA REAL (`delivered_at`, trigger) y no la fecha de creación.
- Los meses archivados NO guardan snapshot por técnico: el histórico por
  técnico se recalcula desde `repairs` (inmutables en la práctica); el badge
  de % muestra la comisión VIGENTE del perfil también en meses pasados.
- `ensure_workshop()` devuelve `null` (sin violar FK) cuando el usuario ya no
  existe en `auth.users`; `resolveWorkshopId()` cierra la sesión obsoleta.
- `expo-print` en web solo llama a `window.print()` (no genera PDF); por eso el
  PDF web se construye con `jspdf` y se comparte con Web Share API.
- `metro.config.js` redirige `jspdf` a `dist/jspdf.es.min.js` (build ESM) en
  todas las plataformas: el SSR estático de Expo corre en Node y resolvería la
  build `node` que usa `require(["html2canvas"], t)` (AMD no transformable por
  Metro, rompía `expo export -p web`). jspdf solo se importa desde
  `src/utils/receipt-pdf.web.ts`, así que el redirect es inocuo en nativo.
- `monthly_closures` es SOLO lectura por RLS: la escritura ocurre vía RPC
  `ensure_month_closure()` (SECURITY DEFINER), nunca desde el cliente.
- El glass se aplica con moderación; en plataformas nativas se degrada a sólido.
- Las anon keys son públicas por diseño (RLS es la barrera real).

## Próximo Paso Esperado
- El panel de liquidación ya funciona en producción (fix 42804 aplicado en
  vivo el 2026-08-21): verificar en vivo alternando mes archivado vs en curso.
- La migración `20260821000000_technician_monthly_performance.sql` y el fix
  `20260821210000_fix_monthly_performance_count_type.sql` están aplicados en
  vivo; schema.sql espejado con delivered_at, trigger, RPC (count(*)::int).
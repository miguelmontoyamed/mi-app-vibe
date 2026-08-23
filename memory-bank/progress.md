# Progress — TechRepair Master

> Registro de avance del proyecto. Actualizar al finalizar cada tarea.

## Completado (✓)
- **Integración de Inventario con Órdenes de Reparación (`job/[id].tsx`):**
  selector de repuestos con indicador de stock en vivo, selector de cantidad
  `+ / -`, descuento y reintegro automático de stock en Supabase (`public.inventory`
  y `public.repairs`), modal con pestañas "Desde Inventario" / "Costo Manual",
  lógica pura testeada (`inventory-parts.ts`) con 11/11 tests unitarios PASS,
  tipado estricto (0 errores `tsc`) y suite global 105/105 tests PASS (2026-08-23).
- **Autocompletado inteligente de repuestos en Recepción con fallback manual (2026-08-24):**
  `PartAutocompleteInput` en `receive.tsx` — sugerencias tiempo real del inventario (stock > 0)
  por nombre/categoría insensible a tildes. Selección → autocompleta nombre, qty=1, precio = precio × qty,
  subtotal en vivo, badge verde "Se descontará stock", descuento atómico al guardar.
  Texto sin coincidencia exacta → modo manual: campo "Valor del Repuesto Manual (COP)" numérico,
  badge amarillo "Repuesto manual — No afecta inventario", no toca stock. Separación `partName` vs `manualPartsCost`.
  Tests `part-search.ts` (9) + `inventory-parts.ts` (6) → suite 105/105 PASS, deploy Vercel + smoke tests Chromium+WebKit 2/2.
- **Aislamiento Seguro de Google OAuth Web (`google-auth.web.ts`):** resolución
  específica para web evitando fallos de `expo-auth-session` con Client ID vacío
  en desarrollo local (2026-08-23).
- **Autenticación Supabase y roles:** email/password + Google OAuth (PKCE),
  sesiones persistentes, auto-refresh, auto-logueo de sesiones obsoletas y
  roles `admin` / `technician`.
- **RLS multi-taller:** aislamiento total por `workshop_id` en
  `repairs`, `profiles`, `inventory`, `clients`; pruebas de integración RLS
  (acceso cruzado bloqueado).
- **Gestión de técnicos:** límite `MAX_TECHNICIANS = 5`, invitaciones con token
  temporal de 10 minutos, roles con permisos por RLS.
- **Comisiones y costos de repuestos dinámicos:** cálculo de comisión y ganancia
  por técnico, costos de repuestos en cada orden.
- **Rediseño visual MD3 + Liquid Glass sutil:** tokens centralizados en
  `src/constants/theme.ts`, 44px, responsive.
- **Barrido Visual Universal (Touch targets de 44px, truncado de folios, Safe Areas y compatibilidad WebKit/Chromium):** suite RTL 11/11 passing, integración en `job/[id].tsx` y `admin.tsx`, reemplazo de `window.confirm`/`Alert` nativo, TypeScript limpio, 85/85 tests globales pasando. Commit `feat(ui): implement standardized MD3 liquid glass confirmation dialogs` (2026-08-22).
- **Modales de Confirmación MD3 + Liquid Glass (ConfirmDialog):** suite RTL 11/11
  passing, integración en `job/[id].tsx` y `admin.tsx`, reemplazo de
  `window.confirm`/`Alert` nativo, TypeScript limpio, 85/85 tests globales
  pasando. Commit `feat(ui): implement standardized MD3 liquid glass confirmation
  dialogs` (2026-08-22).
- **Paywall y renovación Bre-B:** prueba de 90 días, tarifa 20.000 COP/mes,
  acumulación automática de tiempo, alerta a 10 días del vencimiento.
- **Búsqueda multicriterio avanzada** (Folio TRM, IMEI, Teléfono, Cliente) en
  `src/app/(tabs)/jobs.tsx`.
- **Emisión e impresión de tickets/comprobantes PDF** con membrete y Módulo 11
  DIAN (`src/app/receipt/[id].tsx` + `src/utils/nit.ts` + `expo-print`).
- **Compartir recibo PDF por WhatsApp (todas las plataformas):** web con
  `jspdf` + Web Share API (+ fallback descarga en PC) en
  `src/utils/receipt-pdf.web.ts`; nativo con `expo-print` + `expo-sharing` en
  `src/utils/receipt-pdf.ts`; botones con feedback en `receipt/[id].tsx`;
  tests unitarios del PDF web (magia `%PDF`, folio, español).
- **Panel de Liquidación y Rendimiento Mensual por Técnico (histórico mes a
  mes):** `repairs.delivered_at` + trigger `trg_repairs_delivered_at` (fecha
  real de entrega/cobro, con backfill); RPC
  `get_technician_monthly_performance('YYYY-MM')` (SECURITY DEFINER por
  taller) con órdenes entregadas, recaudo (`budget`), repuestos
  (`parts_cost`), producción neta, comisión a liquidar y utilidad del taller;
  tipos estrictos en `src/types/billing.ts`; helpers puros en
  `src/utils/billing-performance.ts` (+9 tests); `fetchMonthlyPerformance()`
  en `BillingProvider`; UI en `admin.tsx` con selector de periodo (mes en
  curso + archivados solo lectura), resumen global y tarjetas COP por técnico.
  Migración aplicada en vivo; tsc 0 errores; 52/52 tests.
- **Cierres de mes:** tabla `monthly_closures` + RPC `ensure_month_closure()`
  (SECURITY DEFINER, idempotente) en schema.sql y migración
  `20260820010000_monthly_closures.sql` aplicada en vivo a la BD real;
  `BillingProvider`/`useBilling` (`src/context/billing-context.tsx`) registrado
  en `_layout.tsx` auto-cierra el mes vencido al abrir la app y arranca la
  facturación del mes nuevo de inmediato.
- **Fix de sesión obsoleta (ensure_workshop):** verificado contra BD real
  (7/7 checks), desplegado en producción.
- **Facturación y Recibos Simplificados (2026-08-23):** Vista `receipt/[id].tsx`
  y plantilla HTML del PDF muestran solo "Total reparación" (eliminadas filas
  "Repuesto" y "Abonado"). Commit `fix(receipt): remove spare part cost and
  deposit lines from invoice view and PDF template` — 85/85 tests passing.
- **Smoke Tests Automatizados en Producción (2026-08-23):** web-smoke.spec.ts
  PASS en Chromium y WebKit (2/2) contra `mi-app-vibe-ten.vercel.app`.
- **Suite E2E de Invitaciones (2026-08-23):** `invitation.spec.ts` reescrito
  con usuario aislado vía Admin API, selectores robustos (`getByRole`,
  `getByText` con regex), textos flexibles para producción.
- **UI & Estabilidad E2E (2026-08-23):** `GlassCard` `flexShrink: 1` (Safari/
  WebKit), feedback de error visible en `login.tsx`, merge de correcciones
  upstream. Commit `fix(e2e+ui): merge upstream fixes for invitation spec,
  login error handling, and GlassCard flexShrink`.

## En Desarrollo / Próximo (🔄)
- **Foco operativo:** validación y operación continua en mostrador del taller
  (recepción, asignación, cobro). MVP y Release Candidate cerrados; fase de uso
  en mostrador y soporte operativo.

## Pendiente (◻)
- Ninguno. La "exportación contable" fue DESCARTADA del backlog (2026-08-22).

## Historial Reciente
| Fecha | Cambio |
|-------|--------|
| 2026-08-24 | **Autocompletado repuestos con fallback manual:** `PartAutocompleteInput` en `receive.tsx` — sugerencias tiempo real (stock > 0), selección → autocompleta nombre + precio × qty, subtotal, descuento stock atómico; sin coincidencia exacta → campo "Valor Manual (COP)" numérico, sin tocar inventario. Separación `partName` / `manualPartsCost`. 105/105 tests, deploy + smoke Chromium+WebKit 2/2. |
| 2026-08-23 | PartAutocompleteInput: selector interactivo de repuestos con sugerencias en tiempo real desde el inventario del taller (nombre/categoría, sin distinción de tildes), auto-rellenado de precio en recepción (`receive.tsx`) y modo manual libre sin afectar el stock. Suite unitaria 94/94 y UI 17/17 PASS |
| 2026-08-23 | **Facturación y Recibos Simplificados:** `receipt/[id].tsx` + plantilla HTML PDF muestran solo "Total reparación" (eliminadas filas Repuesto/Abonado). 85/85 tests. |
| 2026-08-23 | **Despliegue Producción + Smoke Tests:** Vercel deploy `mi-app-vibe-ten.vercel.app`; web-smoke PASS Chromium+WebKit (2/2). |
| 2026-08-23 | **Suite E2E Invitaciones + UI Fixes:** `invitation.spec.ts` usuario aislado + selectores robustos; `GlassCard` `flexShrink: 1`; login error visible en UI; merge upstream. |
| 2026-08-22 | Admin: ALTA de técnicos SOLO vía enlace de invitación (se eliminó el formulario Nombre/Correo/Comisión y `createTechnician` del panel); panel queda para editar comisión y eliminar. Fix Safari/iOS: KPIs de Control de Ingresos se APILAN en <768px y `financeBox` con `minWidth:0` (WebKit min-width:auto partía los montos carácter a carácter) |
| 2026-08-22 | DeviceSecurityInput: selector Patrón 3x3 (tap+arrastre, nodos 44px, líneas sin SVG) / PIN-Contraseña / Ninguna en recepción; guarda en `unlock_code` existente; detalle muestra clave 🔑 o PatternPreview del trazo; +14 tests → 77/77 |
| 2026-08-22 | RepairWorkflowStepper: diagrama interactivo del flujo de la orden en `job/[id].tsx` (nodos 40px, conectores semánticos, rama cancelada en error, avance por toque con permisos dueño/técnico asignado vía `updateRepairStatus`) |
| 2026-08-22 | Higiene: exportación contable DESCARTADA del backlog; foco en espera de siguiente módulo de mostrador (patrón 3x3 o modales MD3); `PENDIENTE.md` obsoleto eliminado |
| 2026-08-21 | Contacto comercial real `3002011801` (+57 300 201 1801 / wa.me/573002011801): reemplaza los placeholders en banner comercial, PDF del recibo (web y nativo) y botón de soporte de Admin |
| 2026-08-21 | NIT de longitud libre (1–15 base + DV): `nit.ts` acepta cualquier longitud con módulo 11 DIAN correcto y formatea agrupando de a 3 desde la derecha; `taller.tsx` ya no limita a 9 dígitos (DV se calcula en vivo mientras se digita); PDF/recibo lo muestran formateado sin cambios. +7 tests de contrato (bases de 8 y 13 dígitos) → 59/59 |
| 2026-08-21 | Liquidación en TIEMPO REAL: `public.repairs` agregada a la publicación `supabase_realtime` (migración `20260821220000`, aplicada en vivo) + suscripción `postgres_changes` en `admin.tsx` con debounce 800 ms → el panel se refresca solo ante entregas/ediciones/reasignaciones de cualquier miembro, sin recargar |
| 2026-08-21 | Fix RPC `get_technician_monthly_performance` (error 42804 en producción): `count(*)` (bigint) no coincidía con `delivered_count int` del RETURNS TABLE; cast `count(*)::int` en migración `20260821210000` aplicada en vivo vía `supabase db query --linked` (Management API) y espejada en schema.sql. Repro y verificación con sesión simulada (request.jwt.claims + LATERAL) |
| 2026-08-21 | Fix lint: reparados los 6 errores react-hooks (set-state-in-effect en admin/super-admin, rules-of-hooks en jobs/customers, pureza Date.now en dashboard vía useSyncExternalStore). Lint repo: 0 errores; quedan 3 warnings de imports/vars sin usar |
| 2026-08-21 | Asignación de técnico al crear la orden (chips "Asignar a" en `receive.tsx`, default = creador) y reasignación desde el detalle (`job/[id].tsx`, modal visible para cualquier miembro; RLS de UPDATE por taller ya lo permitía — sin migración). tsc 0 errores, 52/52 tests, lint limpio en los 2 archivos tocados |
| 2026-08-21 | Panel de Liquidación y Rendimiento Mensual por Técnico: `delivered_at` + trigger + RPC `get_technician_monthly_performance` (migración aplicada en vivo), tipos estrictos, helpers testeados, UI con selector de periodo y tarjetas COP por técnico |
| 2026-08-20 | Fix deploy web: `metro.config.js` redirige jspdf a la build ESM (el SSR estático resolvía la build node con require AMD que rompía `expo export -p web`) |
| 2026-08-20 | Cierres de mes: tabla `monthly_closures` + RPC `ensure_month_closure` + `BillingProvider` (auto-cierre al abrir la app); migración aplicada en vivo |
| 2026-08-20 | Compartir recibo PDF por WhatsApp en web (jspdf + Web Share API + fallback descarga) y nativo (expo-print + sharing) con tests |
| 2026-08-20 | Sync del Memory Bank con el estado real (búsqueda e impresión verificadas en código) |
| 2026-08-20 | Fix `ensure_workshop` sesión obsoleta (migración aplicada en vivo + deploy Vercel) |
| 2026-08-19/20 | Rediseño visual de pantallas secundarias (login, signup, paywall, job, receipt, super-admin) |
| 2026-08 | Seguridad multi-tenant RLS + invitaciones temporales de técnicos |
| 2026-08 | Paywall Bre-B con acumulación de días |
# Progress — TechRepair Master

> Registro de avance del proyecto. Actualizar al finalizar cada tarea.

## Completado (✓)
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

## En Desarrollo / Próximo (🔄)
- **Verificación funcional en vivo** del panel de liquidación (alternar mes
  archivado vs en curso) tras el deploy a producción.

## Pendiente (◻)
- **Reportes financieros consolidados y exportación contable** (por servicio,
  márgenes, proyecciones).

## Historial Reciente
| Fecha | Cambio |
|-------|--------|
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
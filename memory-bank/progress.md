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
- **Cierres de mes:** tabla `monthly_closures` + RPC `ensure_month_closure()`
  (SECURITY DEFINER, idempotente) en schema.sql y migración
  `20260820010000_monthly_closures.sql` aplicada en vivo a la BD real;
  `BillingProvider`/`useBilling` (`src/context/billing-context.tsx`) registrado
  en `_layout.tsx` auto-cierra el mes vencido al abrir la app y arranca la
  facturación del mes nuevo de inmediato.
- **Fix de sesión obsoleta (ensure_workshop):** verificado contra BD real
  (7/7 checks), desplegado en producción.

## En Desarrollo / Próximo (🔄)
- **Creación de la tabla `cash_register` / `cash_movements`** y su RLS estricto
  por `workshop_id` en Supabase (hoy la tabla NO existe en el schema).
- **Pantalla de Control de Caja** (`src/app/(tabs)/caja.tsx` o dashboard de
  caja): apertura (base inicial), ingresos/egresos por método de pago
  (Efectivo, Bre-B/Transferencia) y arqueo/cierre de turno diario.

## Pendiente (◻)
- **Reportes financieros consolidados y exportación contable** (métricas por
  técnico, por servicio, márgenes, proyecciones).

## Historial Reciente
| Fecha | Cambio |
|-------|--------|
| 2026-08-20 | Fix deploy web: `metro.config.js` redirige jspdf a la build ESM (el SSR estático resolvía la build node con require AMD que rompía `expo export -p web`) |
| 2026-08-20 | Cierres de mes: tabla `monthly_closures` + RPC `ensure_month_closure` + `BillingProvider` (auto-cierre al abrir la app); migración aplicada en vivo |
| 2026-08-20 | Compartir recibo PDF por WhatsApp en web (jspdf + Web Share API + fallback descarga) y nativo (expo-print + sharing) con tests |
| 2026-08-20 | Sync del Memory Bank con el estado real (búsqueda e impresión verificadas en código) |
| 2026-08-20 | Fix `ensure_workshop` sesión obsoleta (migración aplicada en vivo + deploy Vercel) |
| 2026-08-19/20 | Rediseño visual de pantallas secundarias (login, signup, paywall, job, receipt, super-admin) |
| 2026-08 | Seguridad multi-tenant RLS + invitaciones temporales de técnicos |
| 2026-08 | Paywall Bre-B con acumulación de días |
# Progress — TechRepair Master

> Registro de avance del proyecto. Actualizar al finalizar cada tarea.

## Funcionalidades Listas (✓)
- **Autenticación Supabase:** email/password + Google OAuth (PKCE), sesiones
  persistentes, auto-refresh y auto-logueo de sesiones obsoletas.
- **RLS multi-taller:** aislamiento total por `workshop_id` en
  `repairs`, `profiles`, `inventory`, `cash_register`, `clients`; pruebas de
  integración RLS (acceso cruzado bloqueado).
- **Gestión de técnicos:** límite `MAX_TECHNICIANS = 5`, invitaciones con token
  temporal de 10 minutos, roles `admin` / `technician` con permisos por RLS.
- **Comisiones y costos de repuestos dinámicos:** cálculo de comisión y ganancia
  por técnico, costos de repuestos en cada orden.
- **Rediseño visual MD3 + Liquid Glass:** tokens centralizados, 44px, responsive.
- **Paywall Bre-B:** prueba de 90 días, tarifa 20.000 COP/mes, acumulación de
  días, alerta a 10 días del vencimiento.
- **Fix de sesión obsoleta (ensure_workshop):** verificado contra BD real
  (7/7 checks), desplegado en producción.

## En Desarrollo (🔄)
- **Búsqueda multicriterio avanzada** en `src/app/(tabs)/jobs.tsx`
  (Folio TRM, IMEI, Teléfono, Nombre del cliente).
- **Módulo de impresión de tickets** térmicos/PDF con membrete y NIT Módulo 11.

## Pendiente (◻)
- **Cierre de caja diario** (arqueo, reporte de ventas del día).
- **Reportes financieros avanzados** (métricas por técnico, por servicio,
  márgenes, proyecciones).

## Historial Reciente
| Fecha | Cambio |
|-------|--------|
| 2026-08-20 | Fix `ensure_workshop` sesión obsoleta (migración aplicada en vivo + deploy Vercel) |
| 2026-08-19/20 | Rediseño visual de pantallas secundarias (login, signup, paywall, job, receipt, super-admin) |
| 2026-08 | Seguridad multi-tenant RLS + invitaciones temporales de técnicos |
| 2026-08 | Paywall Bre-B con acumulación de días |
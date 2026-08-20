# Active Context — TechRepair Master

> **Documento de estado actual.** Leer SIEMPRE antes de comenzar cualquier tarea.
> Actualizar al finalizar cada tarea (ver `progress.md`).

## Estado Actual (Consolidado — verificado contra el código)
- **Búsqueda multicriterio en tiempo real operativa** en
  `src/app/(tabs)/jobs.tsx`: filtra por **Folio TRM**, **IMEI/Serial**,
  **Teléfono** y **Nombre del Cliente** (`normalizeSearch()` + chips de estado).
- **Generación e impresión de tickets térmicos/PDF operativa** en
  `src/app/receipt/[id].tsx`: membrete del taller, **cálculo DIAN Módulo 11**
  (`src/utils/nit.ts`) y `expo-print` (impresión web + PDF nativo + compartir).
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
**Módulo de Control de Caja y Cierre de Turno:**
1. **Diseñar el esquema SQL** para la tabla `cash_register` / `cash_movements`
   en Supabase con **RLS estricto por `workshop_id`** (hoy la tabla NO existe en
   el schema — solo hay métricas en memoria en `admin.tsx`).
2. **Flujo de caja:**
   - Apertura de caja (base inicial).
   - Registro de ingresos/egresos por **método de pago** (Efectivo,
     Bre-B/Transferencia).
   - Arqueo y cierre de turno diario.

## Decisiones Recientes
- `ensure_workshop()` devuelve `null` (sin violar FK) cuando el usuario ya no
  existe en `auth.users`; `resolveWorkshopId()` cierra la sesión obsoleta.
- El glass se aplica con moderación; en plataformas nativas se degrada a sólido.
- Las anon keys son públicas por diseño (RLS es la barrera real).

## Próximo Paso Esperado
- Definir el esquema `cash_register` + RLS (migración) y la pantalla de Control
  de Caja, según la prioridad del administrador del proyecto.
# Active Context — TechRepair Master

> **Documento de estado actual.** Leer SIEMPRE antes de comenzar cualquier tarea.
> Actualizar al finalizar cada tarea (ver `progress.md`).

## Estado Actual
- **Rediseño visual híbrido (Material Design 3 + Liquid Glass)** implementado:
  tokens centralizados en `src/constants/theme.ts`, 44px de touch target,
  bordes y radios por tema, degradación a `surfaceContainer` en nativas.
- **Seguridad multi-tenant y RLS blindada** contra accesos cruzados: toda tabla
  filtra por `workshop_id`; RPCs `security definer` sin sesión bloqueadas.
- **Pasarela y paywall Bre-B activo** con acumulación matemática de días de
  suscripción (20.000 COP/mes, llave `3002011801`).
- **Fix de sesiones obsoletas aplicado y desplegado:** un JWT de un usuario
  eliminado ya no bloquea `fetchRepairs`; el cliente se auto-desloguea.

## Foco Operativo Inmediato
1. **Búsqueda multicriterio avanzada** en `src/app/(tabs)/jobs.tsx`
   (Folio TRM, IMEI, Teléfono, Nombre).
2. **Generación e impresión de tickets térmicos/PDF** con membrete del taller
   y NIT Módulo 11 (`src/utils/nit.ts` + `expo-print`).

## Decisiones Recientes
- `ensure_workshop()` devuelve `null` (sin violar FK) cuando el usuario ya no
  existe en `auth.users`; `resolveWorkshopId()` cierra la sesión obsoleta.
- El glass se aplica con moderación; en plataformas nativas se degrada a sólido.
- Las anon keys son públicas por diseño (RLS es la barrera real).

## Próximo Paso Esperado
- Iniciar la búsqueda multicriterio en `jobs.tsx` o el módulo de impresión de
  tickets, según la prioridad del administrador del proyecto.
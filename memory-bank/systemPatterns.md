# System Patterns — TechRepair Master

## Stack y Arquitectura
- **Frontend:** React Native + Expo SDK 57 + `expo-router` (file-based routing).
- **Web:** React Native Web, desplegado en Vercel.
- **Backend:** Supabase (Auth, Postgres + RLS, Storage, Realtime).
- **Navegación:** estructura de tabs en `src/app/(tabs)/` (Inicio, Recepción, Trabajos, Clientes, Inventario, Equipos, Admin) + rutas de detalle (`job/[id]`, `receipt/[id]`, `device-receipt/[id]`).
- **Módulo de Equipos (Trade-in & Reventa):** `public.devices` con aislamiento contable total respecto a `repairs` (su utilidad no altera balances del taller ni producción de técnicos).

## Control de Acceso (RBAC)
Los roles viven en `profiles.role` (por taller). Las RLS policies leen el rol del
perfil del usuario autenticado.

### Rol `admin`
- Acceso total a su taller.
- Caja (`cash_register`) y métricas.
- Invitación de técnicos mediante **token temporal de 10 minutos**
  (`INVITE_EXPIRY_MS = 10 * 60 * 1000`), hasta el límite
  **`MAX_TECHNICIANS = 5`** (`src/context/auth-context.tsx`).
- Crear/editar órdenes, gestionar inventario, ver comisiones y cerrar ventas.

### Rol `technician`
- Solo sus órdenes asignadas (RLS filtra por `technician_id`).
- Inventario en **solo lectura**.
- Cobro y entrega de sus trabajos (puede avanzar el estado de sus órdenes).

## Invariantes de Seguridad
1. **Row Level Security (RLS) obligatorio** en todas las tablas, forzado por
   `workshop_id`: `repairs`, `technicians` (perfiles), `inventory`,
   `cash_register`, `clients`, etc.
2. **RPCs seguras:** las funciones que mutan estado (`ensure_workshop`,
   `current_workshop_id`, etc.) son `security definer`, validan `auth.uid()` y
   **no se ejecutan sin sesión** (sin `GRANT` a `anon`). Acceso solo
   `authenticated` / `service_role`.
3. **Sesiones obsoletas:** si el usuario fue eliminado de `auth.users`, las RPCs
   devuelven `null` (no violan FKs) y el cliente se auto-desloguea
   (`resolveWorkshopId()` valida con `getUser()`).
4. **Cero acceso cruzado entre talleres:** toda policy filtra por el
   `workshop_id` del perfil del usuario autenticado.

## Invariantes de Base de Datos y Dominio
1. **Persistencia Continua de Inventario (`public.inventory`)**:
   - Las existencias (`stock`) y el catálogo de repuestos son permanentes y NO se ven afectados por los cambios de mes de calendario (`YYYY-MM`).
   - Los cierres mensuales (`monthly_closures` / `get_technician_monthly_performance`) solo archivan snapshots financieros de órdenes de servicio (`repairs`), manteniendo el inventario activo sin modificaciones ni reseteos.
   - Nuevos ingresos de repuestos deben realizarse mediante `UPSERT` o incremento de stock (`stock = stock + incoming_qty`), prohibiendo el uso de `DELETE` en actualizaciones rutinarias.


## Sistema de Diseño
- **Material Design 3** para estructura y jerarquía:
  - `src/constants/theme.ts` = tokens centralizados (colores, `Shape` radios,
    `TouchTarget` de 44px, fuentes, elevación).
  - Safe areas, estados de interacción (hover/pressed/focus) y responsive.
- **Liquid Glass sutil** para acabados y profundidad:
  - Translucidez selectiva en tarjetas clave, cabeceras y modales.
  - **Degradación nativa:** en iOS/Android el glass se degrada a
    `surfaceContainer` sólido (sin `backdrop-filter`).
  - Prohibido saturar la UI de glassmorphism.
- **Regla de conflicto:** accesibilidad, contraste y rendimiento ganan siempre
  sobre la estética glass.

## Patrón de Datos
- **Realtime de Supabase** como fuente de verdad (nada de caché obsoleta).
- Identidad por `workshop_id` en cada fila; las queries del cliente siempre
  pasan por el taller resuelto (`resolveWorkshopId()`).
- Órdenes con folio generado por `generateOrderId()` (reintenta colisiones).
# Reparación de Inventario e Ingresos en Cancelación y Eliminación

Este plan detalla los ajustes necesarios en la lógica de negocio para cumplir con la regla de reversión total financiera y de inventario al cancelar o eliminar una orden.

## User Review Required

> [!IMPORTANT]
> Actualmente, al **eliminar** una orden (`deleteRepair`), esta desaparece de la base de datos (por lo que sus ingresos y utilidades desaparecen automáticamente), pero **no se estaba devolviendo el repuesto al stock**. Esto será corregido.
> 
> Al **cancelar** una orden (`cancelRepair`), el sistema **ya estaba devolviendo el repuesto al stock** y **ya estaba removiendo la orden de las utilidades** (ya que la utilidad solo suma órdenes en estado `Entregado`). Sin embargo, mantendremos la filosofía de "reversión total" asegurando que el presupuesto y el abono también queden en 0.

## Open Questions

> [!WARNING]
> Al cancelar una orden, procederé a poner automáticamente en 0 el **Presupuesto** (`budget`) y el **Abono** (`advance_payment`). ¿Estás de acuerdo con devolver el abono a 0 al cancelar, asumiendo que el dinero se le devuelve al cliente si no se reparó?

## Proposed Changes

### Contexto de Reparaciones

#### [MODIFY] [repair-context.tsx](file:///c:/Users/TORETO/mi-app-vibe/src/context/repair-context.tsx)
- **`deleteRepair`**: Agregar la lógica de restauración de inventario (leer el `target.inventoryPartId`, calcular el stock restaurado y hacer el `update` en la tabla `inventory`) antes de ejecutar el borrado de la orden en Supabase.
- **`cancelRepair`**: Agregar `budget: 0` y `advance_payment: 0` al payload de actualización de Supabase para asegurar que la orden quede completamente en ceros financieramente hablando, complementando la restauración de inventario que ya existe.

## Verification Plan

### Automated Tests
- Ejecutar `npx tsc --noEmit` para validar tipado estricto.
- (Si aplica) Ejecutar `npm test` para verificar que la lógica pura en `repair-logic.ts` no se rompa por los cambios en el contexto.

### Manual Verification
- Eliminar una orden con un repuesto asignado y verificar que el stock en Inventario regrese a la normalidad.
- Cancelar una orden con abono y presupuesto, y verificar que estos valores queden en 0 y el stock también regrese.

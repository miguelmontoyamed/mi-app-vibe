# Product Context — TechRepair Master

## Problemas que Resuelve
1. **Reemplazo definitivo de hojas de cálculo / AppSheet obsoletas:**
   - Fin de la pérdida de información, duplicados y errores manuales.
   - Datos centralizados en Supabase (Postgres + RLS) en lugar de archivos dispersos.
2. **Control de inventario:** repuestos y stock con visibilidad por taller.
3. **Flujo de mostrador rápido:** registro ágil de órdenes con diagnóstico preliminar
   en el momento en que el cliente llega al taller.
4. **Tickets térmicos / PDF con membrete:** impresión profesional con el NIT del
   taller (dígito de verificación DIAN, Módulo 11) y datos de contacto.
5. **Contacto por WhatsApp:** comunicación directa con el cliente desde la app.

## Flujo de Usuario
```
Registro de órdenes con diagnóstico preliminar
        │
        ▼
Asignación a técnico (rol technician)
        │
        ▼
Seguimiento de repuestos y comisión
        │
        ▼
Facturación / Entrega al cliente
```

### Detalle por etapa
1. **Registro de orden:** folio automático (`TRM-*`), datos del cliente, dispositivo,
   diagnóstico preliminar, presupuesto y abono inicial.
2. **Asignación a técnico:** el admin asigna la orden a un técnico del taller;
   el técnico solo ve y gestiona sus órdenes asignadas.
3. **Seguimiento:** avance de estado (Pendiente → En reparación → Listo → Entregado),
   repuestos usados (costo real vs. presupuestado) y comisión del técnico.
4. **Facturación/entrega:** liquidación del abono pendiente, cobro (abono/contado)
   y generación de ticket térmico/PDF con membrete y NIT del taller.

## Público Objetivo
- Administradores de talleres de reparación (rol `admin`).
- Técnicos del taller (rol `technician`).
- Clientes finales (contacto para seguimiento y entrega).
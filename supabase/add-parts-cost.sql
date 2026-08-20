-- Migración idempotente: valor del repuesto (costo de partes) por reparación.
-- Utilidad = budget - parts_cost. Opcional (default 0) porque hay reparaciones sin repuestos.
alter table public.repairs
  add column if not exists parts_cost numeric not null default 0;

-- Comentario para documentación del esquema
comment on column public.repairs.parts_cost is
  'Valor del repuesto usado en la reparación (COP). 0 = sin repuestos. Se resta del presupuesto para calcular la utilidad del taller.';
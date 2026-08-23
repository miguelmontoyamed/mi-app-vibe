-- Agregar columnas de vinculación y stock de inventario a las órdenes de reparación
alter table public.repairs add column if not exists inventory_part_id uuid references public.inventory(id) on delete set null;
alter table public.repairs add column if not exists inventory_part_name text;
alter table public.repairs add column if not exists inventory_part_qty int not null default 0;

-- Recargar la caché de esquema de PostgREST para exponer las nuevas columnas a la API
notify pgrst, 'reload schema';

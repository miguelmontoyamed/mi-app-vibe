-- ============================================================
-- MIGRACIÓN: 20260910000001_decrement_inventory_stock.sql
-- Descuento atómico de stock (una sola sentencia en Postgres):
-- elimina la carrera de lectura-modificación-escritura entre mostradores.
-- ============================================================

create or replace function public.decrement_inventory_stock(p_part_id uuid, p_delta int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  w_id uuid := public.current_workshop_id();
  new_stock int;
begin
  if auth.uid() is null or w_id is null then
    return jsonb_build_object('ok', false, 'message', 'No autenticado');
  end if;

  update public.inventory
     set stock = greatest(0, stock + p_delta)
   where id = p_part_id
     and workshop_id = w_id
  returning stock into new_stock;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Repuesto no encontrado en este taller');
  end if;

  return jsonb_build_object('ok', true, 'stock', new_stock);
end;
$$;

revoke execute on function public.decrement_inventory_stock(uuid, int) from public, anon;
grant execute on function public.decrement_inventory_stock(uuid, int) to authenticated, service_role;

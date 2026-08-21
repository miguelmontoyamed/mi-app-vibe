-- ============================================================================
--  Fix: RPC get_technician_monthly_performance — error 42804
--  "structure of query does not match function result type"
--
--  Causa: `count(*)` devuelve bigint y el RETURNS TABLE declara
--  delivered_count int. RETURN QUERY no downcastea implícitamente, así que la
--  función se CREABA bien pero fallaba al EJECUTARSE con un usuario real
--  (con service_role auth.uid() es null y salía temprano → por eso las
--  pruebas con service role no lo detectaron).
--
--  Fix mínimo: cast explícito count(*)::int. Idempotente.
-- ============================================================================

create or replace function public.get_technician_monthly_performance(p_period text)
returns table (
  technician_id        text,
  technician_name      text,
  commission_rate      numeric,
  delivered_count      int,
  total_revenue        numeric,
  total_parts_cost     numeric,
  net_production       numeric,
  commission_total     numeric,
  workshop_net_profit  numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  wid uuid;
begin
  -- Periodo inválido: error explícito (el cliente valida antes de llamar).
  if p_period is null or p_period !~ '^\d{4}-\d{2}$' then
    raise exception 'Periodo inválido: se espera YYYY-MM' using errcode = '22023';
  end if;

  -- Sin sesión o sin perfil: sin datos (nunca cross-taller).
  if uid is null then
    return;
  end if;

  select workshop_id into wid from public.profiles where id = uid;
  if wid is null then
    return;
  end if;

  return query
  select
    coalesce(prof.id::text, nullif(r.technician_id, ''), r.technician_name) as technician_id,
    coalesce(prof.full_name, nullif(r.technician_name, ''), 'Sin asignar')  as technician_name,
    coalesce(prof.commission_rate, 0)                                       as commission_rate,
    count(*)::int                                                           as delivered_count,
    coalesce(sum(r.budget), 0)                                              as total_revenue,
    coalesce(sum(r.parts_cost), 0)                                          as total_parts_cost,
    coalesce(sum(greatest(r.budget - coalesce(r.parts_cost, 0), 0)), 0)     as net_production,
    coalesce(sum(round(greatest(r.budget - coalesce(r.parts_cost, 0), 0)
                       * coalesce(prof.commission_rate, 0))), 0)            as commission_total,
    coalesce(sum(greatest(r.budget - coalesce(r.parts_cost, 0), 0)), 0)
      - coalesce(sum(round(greatest(r.budget - coalesce(r.parts_cost, 0), 0)
                           * coalesce(prof.commission_rate, 0))), 0)        as workshop_net_profit
  from public.repairs r
  left join public.profiles prof
         on prof.workshop_id = r.workshop_id
        and r.technician_id = prof.id::text
  where r.workshop_id = wid
    and r.status = 'Entregado'
    and to_char(coalesce(r.delivered_at::date, r.updated_at::date, r.date), 'YYYY-MM') = p_period
  group by 1, 2, 3
  order by net_production desc, technician_name asc;
end;
$$;

revoke execute on function public.get_technician_monthly_performance(text)
  from public, anon, authenticated;
grant execute on function public.get_technician_monthly_performance(text)
  to authenticated, service_role;

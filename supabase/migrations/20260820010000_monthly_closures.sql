-- ============================================================================
--  Cierres de mes (monthly_closures)
--  ---------------------------------------------------------------------------
--  Nuevo módulo de cierres de mes: cuando un mes se acaba, su snapshot
--  (totales de ingresos/repuestos/órdenes) queda guardado en `monthly_closures`
--  para verificación futura, y la facturación arranca de inmediato en el mes
--  nuevo (el periodo abierto es el mes calendario actual).
--
--  - `monthly_closures`: snapshot inmutable por (workshop_id, period 'YYYY-MM').
--  - RPC `ensure_month_closure()` (SECURITY DEFINER): idempotente; al llamarlo
--    cierra todos los meses anteriores al actual que aún no tengan cierre y
--    devuelve el periodo abierto ('YYYY-MM').
--  - RLS: SOLO LECTURA por taller para el cliente (la escritura es vía RPC).
--  Idempotente: se puede re-ejecutar sin errores.
-- ============================================================================

-- ------------------------------------------------------------------
-- 1) Tabla de cierres de mes
-- ------------------------------------------------------------------
create table if not exists public.monthly_closures (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  -- Suma de presupuestos de las órdenes ENTREGADAS del mes (ingreso realizado).
  revenue numeric not null default 0,
  -- Suma de costos de repuestos de las órdenes entregadas del mes.
  parts_cost numeric not null default 0,
  delivered_count int not null default 0,
  cancelled_count int not null default 0,
  -- Total de órdenes creadas en el mes (todas las estados).
  total_count int not null default 0,
  closed_at timestamptz not null default now(),
  unique (workshop_id, period)
);

-- ------------------------------------------------------------------
-- 2) RPC de cierre de mes (SECURITY DEFINER, idempotente)
-- ------------------------------------------------------------------
create or replace function public.ensure_month_closure()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  wid uuid;
  current_period text := to_char(now(), 'YYYY-MM');
  m record;
begin
  -- Sin sesión: nada que cerrar.
  if uid is null then
    return null;
  end if;

  select workshop_id into wid from public.profiles where id = uid;
  if wid is null then
    return null;
  end if;

  -- Cierra meses vencidos sin cierre que tengan órdenes (idempotente).
  for m in
    select distinct to_char(date, 'YYYY-MM') as period
      from public.repairs
     where workshop_id = wid
       and date < date_trunc('month', now())::date
  loop
    insert into public.monthly_closures
      (workshop_id, period, revenue, parts_cost, delivered_count, cancelled_count, total_count)
    select wid,
           m.period,
           coalesce(sum(budget) filter (where status = 'Entregado'), 0),
           coalesce(sum(parts_cost) filter (where status = 'Entregado'), 0),
           count(*) filter (where status = 'Entregado'),
           count(*) filter (where status = 'Cancelado / No Reparado'),
           count(*)
      from public.repairs
     where workshop_id = wid
       and to_char(date, 'YYYY-MM') = m.period
    on conflict (workshop_id, period) do nothing;
  end loop;

  return current_period;
end;
$$;

revoke execute on function public.ensure_month_closure() from public, anon, authenticated;
grant execute on function public.ensure_month_closure() to authenticated, service_role;

-- ------------------------------------------------------------------
-- 3) RLS: solo lectura por taller (la escritura es vía RPC)
-- ------------------------------------------------------------------
alter table public.monthly_closures enable row level security;

drop policy if exists "monthly_closures_workshop_read" on public.monthly_closures;
create policy "monthly_closures_workshop_read" on public.monthly_closures
  for select using (workshop_id = current_workshop_id());

-- ------------------------------------------------------------------
-- 4) Índice de rendimiento
-- ------------------------------------------------------------------
create index if not exists idx_monthly_closures_workshop_period on public.monthly_closures (workshop_id, period desc);
-- ============================================================================
--  TechRepair Master — Liquidación y Rendimiento Mensual por Técnico
--  Migración idempotente (se puede re-ejecutar sin errores).
--
--  1) `repairs.delivered_at`: fecha real de entrega/cobro de la orden.
--     - La estampa un trigger cuando el estado pasa a 'Entregado'.
--     - Se limpia si la orden sale de 'Entregado' (re-apertura).
--     - Backfill para órdenes ya entregadas: usa updated_at (o date).
--  2) RPC `get_technician_monthly_performance(period)`: desglose mensual por
--     técnico del taller del usuario autenticado (SECURITY DEFINER + filtro
--     por workshop_id resuelto desde la sesión; sin sesión devuelve vacío).
--
--  Convención de comisión: profiles.commission_rate es FRACCIÓN (0.30=30%).
--  Comisión por orden = round(max(budget − parts_cost, 0) × rate), igual que
--  commissionForRepair() en src/utils/repair-logic.ts.
-- ============================================================================

-- ------------------------------------------------------------------
-- 1) Columna delivered_at en repairs
-- ------------------------------------------------------------------
alter table public.repairs add column if not exists delivered_at timestamptz;

comment on column public.repairs.delivered_at is
  'Fecha real de entrega/cobro de la orden. La estampa el trigger al pasar a ''Entregado''; base del agrupado mensual del panel de liquidación.';

-- ------------------------------------------------------------------
-- 2) Trigger: estampar/limpiar delivered_at en transiciones de estado
-- ------------------------------------------------------------------
create or replace function public.stamp_delivered_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'Entregado' and old.status is distinct from 'Entregado' then
    new.delivered_at := now();
  elsif new.status is distinct from 'Entregado' then
    -- Re-apertura: la orden deja de estar entregada, se limpia la marca.
    new.delivered_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_repairs_delivered_at on public.repairs;
create trigger trg_repairs_delivered_at
  before update on public.repairs
  for each row execute function public.stamp_delivered_at();

-- Backfill idempotente: órdenes ya entregadas sin marca de entrega.
update public.repairs
   set delivered_at = coalesce(updated_at, date::timestamptz)
 where status = 'Entregado'
   and delivered_at is null;

-- ------------------------------------------------------------------
-- 3) RPC: desglose mensual por técnico (fuente de verdad del panel)
-- ------------------------------------------------------------------
-- Agrupa las órdenes ENTREGADAS por el MES DE ENTREGA real:
--   coalesce(delivered_at::date, updated_at::date, date) → 'YYYY-MM'.
-- Une con profiles (por taller) para nombre y comisión vigente; las órdenes
-- legacy sin technician_id se agrupan por su nombre histórico y quedan con
-- comisión 0 (nunca inventa liquidaciones).
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
    count(*)                                                                as delivered_count,
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

-- ------------------------------------------------------------------
-- 4) Índice de soporte (workshop + estado: filtro base de la RPC)
-- ------------------------------------------------------------------
create index if not exists idx_repairs_workshop_status
  on public.repairs (workshop_id, status);

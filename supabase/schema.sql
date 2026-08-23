-- ============================================================================
--  TechRepair Master — Esquema de base de datos (Supabase / PostgreSQL)
--  --------------------------------------------------------------
--  Para aplicar: en tu proyecto Supabase, SQL > "New query" > pega todo > Run.
--
--  Modelo: cada cuenta autenticada (auth.users) tiene su fila en `profiles`,
--  ligada a un taller (`workshops`). Las reparaciones, el inventario y el
--  perfil del taller (membrete) están atados al taller. RLS garantiza que cada
--  usuario solo ve/manipula los datos de SU taller (compartidos y que NUNCA se
--  pierdan porque viven en la nube).
--
--  Compatibilidad con el frontend (src/):
--    - `repairs.id` es el número de orden corto del taller (TRM-XXXX),
--      generado por src/utils/order-generator.ts. Es la clave primaria (texto)
--      y la misma cadena que aparece en la URL /receipt/[id].
--    - `status` y `payment_method` usan EXACTAMENTE los
--      literales de src/utils/repair-logic.ts (5 estados y 3 métodos de pago).
--    - `motivo_cancelacion` es texto libre obligatorio al cancelar (v2).
--  El script es idempotente: se puede volver a ejecutar sin errores.
-- ============================================================================

-- ------------------------------------------------------------------
-- 1) Talleres (workshops)
-- ------------------------------------------------------------------
create table if not exists public.workshops (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Mi Taller',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- 2) Perfiles de usuario (uno por cuenta auth, ligados a un taller)
-- ------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  full_name text not null,
  role text not null default 'technician' check (role in ('admin','technician')),
  -- Campos específicos para técnicos
  commission_rate numeric default 0 check (commission_rate >= 0 and commission_rate <= 1),
  is_active boolean default true,
  specialty text,
  joined_at timestamptz default now(),
  notes text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- 3) Clientes finales (los que se registran/agregan al taller)
-- ------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- 4) Reparaciones / órdenes de trabajo
--    `id` = número de orden corto del taller (TRM-XXXX). Texto, PK.
-- ------------------------------------------------------------------
create table if not exists public.repairs (
  id text primary key,
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null,
  phone text,
  device text not null,
  issue text,
  budget numeric not null default 0,
  parts_cost numeric not null default 0,
  inventory_part_id uuid references public.inventory(id) on delete set null,
  inventory_part_name text,
  inventory_part_qty int not null default 0,
  advance_payment numeric not null default 0,
  payment_method text,
  unlock_code text,
  imei text,
  technician_id text,
  technician_name text,
  motivo_cancelacion text,
  status text not null default 'Pendiente'
    check (status in ('Pendiente','En Proceso','Listo','Entregado','Cancelado / No Reparado')),
  date date not null default current_date,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (payment_method is null or payment_method in ('Efectivo','Transferencia','Tarjeta'))
);

-- ------------------------------------------------------------------
-- 5) Inventario de repuestos
-- ------------------------------------------------------------------
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  name text not null,
  category text,
  stock int not null default 0,
  price numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- 6) Perfil del taller (membrete) para los recibos PDF
--    Una fila por taller. `workshop_id` es UNIQUE (una sola fila por taller).
-- ------------------------------------------------------------------
create table if not exists public.workshop_profiles (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null unique references public.workshops(id) on delete cascade,
  name text not null,
  nit text not null,
  address text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- 7) Cierres de mes (monthly_closures)
--    Snapshot inmutable por taller y periodo ('YYYY-MM') con los totales
--    del mes al momento de cerrarlo (cuando empieza un mes nuevo, el mes
--    anterior se cierra y se conserva aquí para verificación futura).
--    `period` es el mes de la orden (columna `date` de repairs).
--    Solo se escribe vía RPC `ensure_month_closure()` (SECURITY DEFINER);
--    el cliente solo puede LEER su propio taller (RLS).
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

-- ============================================================
-- MIGRACIONES IDEMPOTENTES (si ya existía una versión anterior)
-- ============================================================

-- `repairs.id` como texto (TRM-XXXX) en vez de uuid. Si la tabla ya estaba
-- creada con id uuid, la convierte sin perder filas.
alter table public.repairs alter column id drop default;
alter table public.repairs alter column id type text using id::text;

-- Columnas que pueden faltar en una versión previa de `repairs`.
alter table public.repairs add column if not exists payment_method text;
alter table public.repairs add column if not exists technician_id text;
alter table public.repairs add column if not exists unlock_code text;
alter table public.repairs add column if not exists imei text;
alter table public.repairs add column if not exists issue text;
alter table public.repairs add column if not exists updated_at timestamptz not null default now();
-- Fecha real de entrega/cobro (panel de liquidación mensual por técnico).
alter table public.repairs add column if not exists parts_cost numeric not null default 0;
alter table public.repairs add column if not exists inventory_part_id uuid references public.inventory(id) on delete set null;
alter table public.repairs add column if not exists inventory_part_name text;
alter table public.repairs add column if not exists inventory_part_qty int not null default 0;
alter table public.repairs add column if not exists delivered_at timestamptz;
-- Referencia a repuesto del inventario usado en la orden (descuento automático de stock).
alter table public.repairs add column if not exists inventory_part_id uuid references public.inventory(id) on delete set null;
alter table public.repairs add column if not exists inventory_part_name text;
alter table public.repairs add column if not exists inventory_part_qty int not null default 0;

-- v2: cancelación con motivo en texto libre. Renombra la columna legacy
-- `cancellation_reason` (CHECK de lista fija) a `motivo_cancelacion` (sin CHECK).
alter table public.repairs add column if not exists motivo_cancelacion text;
update public.repairs
   set motivo_cancelacion = cancellation_reason
 where motivo_cancelacion is null
   and cancellation_reason is not null;
alter table public.repairs drop constraint if exists repairs_cancellation_reason_check;
alter table public.repairs drop column if exists cancellation_reason;

-- Columnas de `profiles` que pueden faltar en una versión previa (v2 técnicos).
-- OBLIGATORIO: el trigger handle_new_user inserta estas columnas; si la tabla
-- no las tiene, el INSERT falla (error 42703) y el `exception when others`
-- del trigger traga el error: la cuenta se crea SIN perfil y el usuario queda
-- bloqueado (current_workshop_id() = null). Este bloque evita ese fallo.
alter table public.profiles add column if not exists commission_rate numeric default 0
  check (commission_rate >= 0 and commission_rate <= 1);
alter table public.profiles add column if not exists is_active boolean default true;
alter table public.profiles add column if not exists specialty text;
alter table public.profiles add column if not exists joined_at timestamptz default now();
alter table public.profiles add column if not exists notes text;

-- CHECKs con los literales exactos de src/utils/repair-logic.ts (idempotente).
alter table public.repairs drop constraint if exists repairs_status_check;
alter table public.repairs add constraint repairs_status_check check (
  status in ('Pendiente','En Proceso','Listo','Entregado','Cancelado / No Reparado')
);
alter table public.repairs drop constraint if exists repairs_payment_method_check;
alter table public.repairs add constraint repairs_payment_method_check check (
  payment_method is null or payment_method in ('Efectivo','Transferencia','Tarjeta')
);

-- `updated_at` en workshop_profiles (idempotente).
alter table public.workshop_profiles add column if not exists updated_at timestamptz not null default now();

-- ============================================================
-- HELPERS RLS (SECURITY DEFINER: evita recursión infinita de políticas)
-- ============================================================
-- Id del taller del usuario autenticado.
create or replace function public.current_workshop_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workshop_id from public.profiles where id = auth.uid()
$$;

-- Rol del usuario autenticado (used en WITH CHECK de perfiles).
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ============================================================
-- SELF-HEALING DE TALLER (auto-aprovisionamiento)
-- ============================================================
-- Repara cuentas autenticadas sin fila en `public.profiles` (creadas antes
-- del trigger `handle_new_user` o con trigger que tragó un error): crea el
-- taller por defecto "Mi Taller" y el perfil con rol 'admin', y devuelve el
-- workshop_id resultante. Así `current_workshop_id()` NUNCA es null para un
-- usuario autenticado activo y el RLS deja de bloquear sus INSERT/SELECT.
-- Idempotente: si el perfil ya existe, solo devuelve su taller. SECURITY
-- DEFINER para sortear el RLS (el cliente no tiene políticas de INSERT).
create or replace function public.ensure_workshop()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  w_id uuid;
  full_name text;
begin
  -- Sin sesión: nada que sanear.
  if uid is null then
    return null;
  end if;

  -- Perfil existente → devolver su taller tal cual.
  select workshop_id into w_id from public.profiles where id = uid;
  if w_id is not null then
    return w_id;
  end if;

  -- Sin perfil: crear taller por defecto + perfil admin (mismo COALESCE que
  -- el trigger handle_new_user: nunca falla por datos incompletos).
  select coalesce(nullif(raw_user_meta_data->>'full_name', ''), email, 'Mi Taller')
    into full_name
    from auth.users
   where id = uid;

  -- Sesión obsoleta (usuario eliminado de auth.users pero con JWT aún válido):
  -- no hay taller que sanear. Devolver null SIN insertar: crear el perfil aquí
  -- violaría profiles_id_fkey (error 23503) y bloquearía fetchRepairs del
  -- cliente. El cliente detecta el null + getUser() fallido y cierra la sesión.
  if not found then
    return null;
  end if;

  insert into public.workshops (name)
  values (coalesce(nullif(full_name, ''), 'Mi Taller'))
  returning id into w_id;

  insert into public.profiles (id, workshop_id, full_name, role, is_active, joined_at)
  values (uid, w_id, coalesce(nullif(full_name, ''), 'Usuario'), 'admin', true, now())
  on conflict (id) do nothing;

  -- Re-leer por si otra sesión creó el perfil en paralelo (race).
  select workshop_id into w_id from public.profiles where id = uid;
  return w_id;
end;
$$;

revoke execute on function public.ensure_workshop() from public, anon, authenticated;
grant execute on function public.ensure_workshop() to authenticated, service_role;

-- ============================================================
-- CIERRE DE MES (monthly_closures)
-- ============================================================
-- Snapshot idempotente: al llamarlo (normalmente al cargar la app con sesión),
-- cierra TODOS los meses anteriores al actual que aún no tengan cierre y
-- tengan al menos una orden. Devuelve el periodo abierto ('YYYY-MM') para que
-- el cliente sepa que la facturación ya arrancó en el mes nuevo.
-- SECURITY DEFINER: el cliente no tiene políticas INSERT sobre monthly_closures;
-- solo puede LEER su propio taller (política SELECT por workshop_id).
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

-- ============================================================
-- LIQUIDACIÓN Y RENDIMIENTO MENSUAL POR TÉCNICO
-- ============================================================
-- Trigger: estampa `delivered_at` cuando la orden pasa a 'Entregado' y lo
-- limpia si sale de ese estado (re-apertura). Es la base del agrupado
-- mensual por MES DE ENTREGA del panel de liquidación.
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

-- RPC: desglose mensual por técnico del taller del usuario autenticado.
-- Agrupa las órdenes ENTREGADAS por el mes de entrega real:
--   coalesce(delivered_at::date, updated_at::date, date) → 'YYYY-MM'.
-- Une con profiles (por taller) para nombre y comisión vigente; las órdenes
-- legacy sin technician_id se agrupan por su nombre histórico con comisión 0.
-- Convención: commission_rate es FRACCIÓN (0.30 = 30%), igual que en
-- commissionForRepair() de src/utils/repair-logic.ts.
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

-- ============================================================
-- TRIGGER: al registrarse una cuenta nueva se crea su taller y su perfil.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  w_id uuid;
  req_workshop uuid;
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  new_role text;
begin
  -- 1) workshop_id opcional del metadata (solo si parece uuid válido;
  --    un cast directo a uuid lanzaría excepción con valores basura).
  begin
    req_workshop := (meta->>'workshop_id')::uuid;
  exception when others then
    req_workshop := null;
  end;

  -- 2) Resolver el taller real:
  --    - El frontend envía como workshop_id el id del admin invitador
  --      (auth.users.id); el taller real se obtiene desde SU fila en profiles.
  --    - Fallback: si ya llegara un workshop_id de workshops, se usa directo.
  --    - Si no hay taller (registro de dueño): se crea uno nuevo.
  if req_workshop is not null then
    select p.workshop_id into w_id
      from public.profiles p
     where p.id = req_workshop
     limit 1;
    if w_id is null then
      select id into w_id
        from public.workshops
       where id = req_workshop
       limit 1;
    end if;
  end if;

  if w_id is null then
    insert into public.workshops (name)
    values (coalesce(nullif(meta->>'workshop_name', ''), 'Mi Taller'))
    returning id into w_id;
  end if;

  -- 3) Rol validado contra el CHECK de profiles ('admin' | 'technician').
  new_role := coalesce(nullif(meta->>'role', ''), 'admin');
  if new_role not in ('admin', 'technician') then
    new_role := 'admin';
  end if;

  -- 4) Perfil con COALESCE total: nunca falla por datos incompletos o null.
  insert into public.profiles (id, workshop_id, full_name, role, commission_rate, is_active, specialty, joined_at)
  values (
    new.id,
    w_id,
    coalesce(nullif(meta->>'full_name', ''), new.email, 'Usuario'),
    new_role,
    coalesce(nullif(meta->>'commission_rate', '')::numeric, 0),
    true,
    nullif(meta->>'specialty', ''),
    now()
  );

  return new;
exception
  -- Red de seguridad: un fallo aquí NUNCA debe bloquear la creación de la
  -- cuenta en auth.users (evita el error "Database error saving new user").
  when others then
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- TRIGGERS: mantener `updated_at` al modificar reparaciones / membrete.
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_repairs_updated_at on public.repairs;
create trigger trg_repairs_updated_at
  before update on public.repairs
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_workshop_profiles_updated_at on public.workshop_profiles;
create trigger trg_workshop_profiles_updated_at
  before update on public.workshop_profiles
  for each row execute function public.touch_updated_at();

-- ============================================================
-- SEGURIDAD (Row Level Security)
-- ============================================================
alter table public.workshops         enable row level security;
alter table public.profiles          enable row level security;
alter table public.clients           enable row level security;
alter table public.repairs           enable row level security;
alter table public.inventory         enable row level security;
alter table public.workshop_profiles enable row level security;
alter table public.monthly_closures  enable row level security;

-- ---- Workshops: solo dueño/admin del taller ----
drop policy if exists "workshops_owner_all" on public.workshops;
create policy "workshops_owner_all" on public.workshops
  for all using (id = current_workshop_id());

-- ---- Profiles: el usuario ve su perfil y los de su taller ----
drop policy if exists "profiles_workshop_read" on public.profiles;
create policy "profiles_workshop_read" on public.profiles
  for select using (workshop_id = current_workshop_id());

-- Un usuario solo puede actualizar SU fila, sin cambiar taller ni rol.
drop policy if exists "profiles_own_update" on public.profiles;
create policy "profiles_own_update" on public.profiles
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and workshop_id = public.current_workshop_id()
    and role = public.current_user_role()
  );

-- Admins pueden gestionar los demás perfiles del taller (crear técnicos).
-- NOTA: NO usar subquery sobre profiles aquí (recursión infinita 42P17:
-- la política de profiles re-evalúa profiles). current_user_role() es
-- SECURITY DEFINER y devuelve el rol sin volver a pasar por RLS.
drop policy if exists "profiles_admin_manage_technicians" on public.profiles;
create policy "profiles_admin_manage_technicians" on public.profiles
  for all
  using (
    workshop_id = current_workshop_id()
    and auth.uid() != id
    and public.current_user_role() = 'admin'
  )
  with check (
    workshop_id = current_workshop_id()
    and auth.uid() != id
    and public.current_user_role() = 'admin'
  );

-- ---- Clients / Repairs / Inventory: acceso por taller ----
drop policy if exists "clients_workshop_all" on public.clients;
create policy "clients_workshop_all" on public.clients
  for all using (workshop_id = current_workshop_id())
  with check (workshop_id = current_workshop_id());

-- DELETE de reparaciones: SOLO el dueño/admin del taller. Los técnicos pueden
-- leer, crear, editar y marcar como 'Cancelado / No Reparado' (UPDATE), pero
-- NUNCA eliminar órdenes. current_user_role() es SECURITY DEFINER (sin recursión).
drop policy if exists "repairs_workshop_all" on public.repairs;
drop policy if exists "repairs_workshop_select" on public.repairs;
drop policy if exists "repairs_workshop_insert" on public.repairs;
drop policy if exists "repairs_workshop_update" on public.repairs;
drop policy if exists "repairs_admin_delete" on public.repairs;
create policy "repairs_workshop_select" on public.repairs
  for select using (workshop_id = current_workshop_id());
create policy "repairs_workshop_insert" on public.repairs
  for insert with check (workshop_id = current_workshop_id());
create policy "repairs_workshop_update" on public.repairs
  for update using (workshop_id = current_workshop_id())
  with check (workshop_id = current_workshop_id());
create policy "repairs_admin_delete" on public.repairs
  for delete using (
    workshop_id = current_workshop_id()
    and public.current_user_role() = 'admin'
  );

drop policy if exists "inventory_workshop_all" on public.inventory;
create policy "inventory_workshop_all" on public.inventory
  for all using (workshop_id = current_workshop_id())
  with check (workshop_id = current_workshop_id());

-- ---- Workshop profiles (membrete): acceso por taller ----
drop policy if exists "workshop_profiles_workshop_all" on public.workshop_profiles;
create policy "workshop_profiles_workshop_all" on public.workshop_profiles
  for all
  using (workshop_id = current_workshop_id())
  with check (workshop_id = current_workshop_id());

-- ---- Monthly closures: SOLO LECTURA por taller (la escritura es vía RPC
--      ensure_month_closure(), SECURITY DEFINER) ----
drop policy if exists "monthly_closures_workshop_read" on public.monthly_closures;
create policy "monthly_closures_workshop_read" on public.monthly_closures
  for select using (workshop_id = current_workshop_id());

-- ============================================================
-- ÍNDICES DE RENDIMIENTO
-- ============================================================
create index if not exists idx_profiles_workshop   on public.profiles (workshop_id);
create index if not exists idx_profiles_role       on public.profiles (workshop_id, role);
create index if not exists idx_repairs_workshop    on public.repairs (workshop_id);
create index if not exists idx_repairs_status      on public.repairs (status);
create index if not exists idx_repairs_workshop_status on public.repairs (workshop_id, status);
create index if not exists idx_repairs_date        on public.repairs (date desc);
create index if not exists idx_inventory_workshop  on public.inventory (workshop_id);
create index if not exists idx_clients_workshop    on public.clients (workshop_id);
create index if not exists idx_monthly_closures_workshop_period on public.monthly_closures (workshop_id, period desc);
-- workshop_profiles.workshop_id ya es UNIQUE (índice implícito).

-- ============================================================
-- DATOS INICIALES (demo)
-- ============================================================
-- Nota: el taller y el dueño se crean solos al registrar la 1ª cuenta.
-- ============================================================
-- REALTIME: liquidación y rendimiento mensual en vivo
-- ============================================================
-- public.repairs en la publicación supabase_realtime: el panel de
-- Liquidación (admin.tsx) se suscribe a postgres_changes y refresca el
-- desglose sin recargar. La visibilidad respeta RLS por taller.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'repairs'
  ) then
    alter publication supabase_realtime add table public.repairs;
  end if;
end
$$;

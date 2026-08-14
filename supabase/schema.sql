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
--    - `status`, `payment_method` y `cancellation_reason` usan EXACTAMENTE los
--      literales de src/utils/repair-logic.ts (5 estados, 3 métodos de pago y
--      4 motivos de cancelación).
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
  advance_payment numeric not null default 0,
  payment_method text,
  unlock_code text,
  imei text,
  technician_id text,
  technician_name text,
  cancellation_reason text,
  status text not null default 'Pendiente'
    check (status in ('Pendiente','En Proceso','Listo','Entregado','Cancelado / No Reparado')),
  date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (payment_method is null or payment_method in ('Efectivo','Transferencia','Tarjeta')),
  check (
    cancellation_reason is null
    or cancellation_reason in ('Fuera de presupuesto','Sin reparación','Repuesto no disponible','Cliente retiró')
  )
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

-- ============================================================
-- MIGRACIONES IDEMPOTENTES (si ya existía una versión anterior)
-- ============================================================

-- `repairs.id` como texto (TRM-XXXX) en vez de uuid. Si la tabla ya estaba
-- creada con id uuid, la convierte sin perder filas.
alter table public.repairs alter column id drop default;
alter table public.repairs alter column id type text using id::text;

-- Columnas que pueden faltar en una versión previa de `repairs`.
alter table public.repairs add column if not exists payment_method text;
alter table public.repairs add column if not exists cancellation_reason text;
alter table public.repairs add column if not exists technician_id text;
alter table public.repairs add column if not exists unlock_code text;
alter table public.repairs add column if not exists imei text;
alter table public.repairs add column if not exists issue text;
alter table public.repairs add column if not exists updated_at timestamptz not null default now();

-- CHECKs con los literales exactos de src/utils/repair-logic.ts (idempotente).
alter table public.repairs drop constraint if exists repairs_status_check;
alter table public.repairs add constraint repairs_status_check check (
  status in ('Pendiente','En Proceso','Listo','Entregado','Cancelado / No Reparado')
);
alter table public.repairs drop constraint if exists repairs_payment_method_check;
alter table public.repairs add constraint repairs_payment_method_check check (
  payment_method is null or payment_method in ('Efectivo','Transferencia','Tarjeta')
);
alter table public.repairs drop constraint if exists repairs_cancellation_reason_check;
alter table public.repairs add constraint repairs_cancellation_reason_check check (
  cancellation_reason is null
  or cancellation_reason in ('Fuera de presupuesto','Sin reparación','Repuesto no disponible','Cliente retiró')
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
-- TRIGGER: al registrarse una cuenta nueva se crea su taller y su perfil.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  w_id uuid;
begin
  insert into public.workshops (name)
  values (coalesce(new.raw_user_meta_data->>'workshop_name', 'Mi Taller'))
  returning id into w_id;

  insert into public.profiles (id, workshop_id, full_name, role, commission_rate, is_active, specialty, joined_at)
  values (
    new.id,
    w_id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'admin',  -- la primera cuenta (la que crea el taller) es el dueño admin
    0,
    true,
    null,
    now()
  );

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
drop policy if exists "profiles_admin_manage_technicians" on public.profiles;
create policy "profiles_admin_manage_technicians" on public.profiles
  for all using (
    workshop_id = current_workshop_id()
    and (
      (auth.uid() != id and exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
      ))
      or auth.uid() = id
    )
  );

-- ---- Clients / Repairs / Inventory: acceso por taller ----
drop policy if exists "clients_workshop_all" on public.clients;
create policy "clients_workshop_all" on public.clients
  for all using (workshop_id = current_workshop_id())
  with check (workshop_id = current_workshop_id());

drop policy if exists "repairs_workshop_all" on public.repairs;
create policy "repairs_workshop_all" on public.repairs
  for all using (workshop_id = current_workshop_id())
  with check (workshop_id = current_workshop_id());

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

-- ============================================================
-- ÍNDICES DE RENDIMIENTO
-- ============================================================
create index if not exists idx_profiles_workshop   on public.profiles (workshop_id);
create index if not exists idx_profiles_role       on public.profiles (workshop_id, role);
create index if not exists idx_repairs_workshop    on public.repairs (workshop_id);
create index if not exists idx_repairs_status      on public.repairs (status);
create index if not exists idx_repairs_date        on public.repairs (date desc);
create index if not exists idx_inventory_workshop  on public.inventory (workshop_id);
create index if not exists idx_clients_workshop    on public.clients (workshop_id);
-- workshop_profiles.workshop_id ya es UNIQUE (índice implícito).

-- ============================================================
-- DATOS INICIALES (demo)
-- ============================================================
-- Nota: el taller y el dueño se crean solos al registrar la 1ª cuenta.
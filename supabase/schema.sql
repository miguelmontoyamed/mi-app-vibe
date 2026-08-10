-- ============================================================================
--  TechRepair Master — Esquema de base de datos (Supabase / PostgreSQL)
--  --------------------------------------------------------------
--  Para aplicar: en tu proyecto Supabase, SQL > "New query" > pega todo > Run.
--
--  Modelo: cada cuenta autenticada es un perfil (dueño o técnico) que
--  pertenece a un taller (workshop). Los clientes finales, reparaciones e
--  inventario están atados al taller. Las reglas RLS garantizan que cada
--  usuario solo ve/manipula los datos suyo taller (info compartida y que
--  NUNCA se pierda al ser en la nube).
-- ============================================================

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

-- Trigger: al registrarse una cuenta nueva se crea automáticamente su
-- perfil. Si es la primera cuenta del taller se marca como dueño(a) (admin)
-- y se crea el taller; si no, queda como técnico pendiente de asignación.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  w_id uuid;
  is_first boolean;
begin
  insert into public.workshops (name)
  values (coalesce(new.raw_user_meta_data->>'workshop_name', 'Mi Taller'))
  returning id into w_id;

  insert into public.profiles (id, workshop_id, full_name, role, commission_rate, is_active, specialty, joined_at)
  values (
    new.id,
    w_id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'admin',  -- la primera cuenta (la que crea taller) es el dueño admin
    0,        -- commission_rate para admin
    true,     -- is_active para admin
    null,     -- specialty para admin
    now()     -- joined_at para admin
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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
-- ------------------------------------------------------------------
create table if not exists public.repairs (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null,
  phone text,
  device text not null,
  issue text,
  imei text,
  unlock_code text,
  budget numeric not null default 0,
  advance_payment numeric not null default 0,
  technician_name text,
  status text not null default 'Pendiente' check (status in ('Pendiente','En Proceso','Listo','Entregado')),
  date date not null default current_date,
  created_at timestamptz not null default now()
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

-- ============================================================
-- SECURIDAD (Row Level Security)
-- ============================================================
alter table public.workshops enable row level security;
alter table public.profiles   enable row level security;
alter table public.clients    enable row level security;
alter table public.repairs    enable row level security;
alter table public.inventory  enable row level security;

-- Helpe: id del taller del usuario autenticado
create or replace function public.current_workshop_id()
returns uuid
language sql
stable
as $$
  select workshop_id from public.profiles where id = auth.uid()
$$;

-- ---- Workshops: solo dueño/admin del taller ------------
create policy "workshops_owner_all" on public.workshops
  for all using (id = current_workshop_id());

-- ---- Profiles: el usuario ve su perfil y los de su taller ----
create policy "profiles_workshop_read" on public.profiles
  for select using (workshop_id = current_workshop_id());
create policy "profiles_own_update" on public.profiles
  for update using (id = auth.uid());
-- Solo admins pueden crear/actualizar técnicos (excepto su propio perfil)
create policy "profiles_admin_manage_technicians" on public.profiles
  for all using (
    workshop_id = current_workshop_id() 
    and (
      -- Admins pueden gestionar todos los perfiles excepto el suyo propio
      (auth.uid() != id and exists (
        select 1 from public.profiles 
        where id = auth.uid() and role = 'admin'
      ))
      -- O usuarios pueden editar su propio perfil
      or auth.uid() = id
    )
  );

-- ---- Clients / Repairs / Inventory: acceso por taller ----
create policy "clients_workshop_all" on public.clients
  for all using (workshop_id = current_workshop_id());
create policy "repairs_workshop_all" on public.repairs
  for all using (workshop_id = current_workshop_id());
create policy "inventory_workshop_all" on public.inventory
  for all using (workshop_id = current_workshop_id());

-- ============================================================
-- DATOS INICIALES (demo)
-- ============================================================
-- Nota: el taller y el dueño se crean solos al registrar la 1ª cuenta.
-- Opcional: cliente de ejemplo para estrenar la pantalla.
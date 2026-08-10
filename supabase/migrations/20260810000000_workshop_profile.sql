-- ============================================================================
--  Perfil del taller (membrete) para los recibos PDF.
--  --------------------------------------------------------------
--  Una fila por taller con los datos que se imprimen como membrete en el
--  recibo de reparación: nombre, NIT (con dígito de verificación), dirección
--  y teléfono. RLS por taller, igual que el resto de entidades del esquema.
-- ============================================================================

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

alter table public.workshop_profiles enable row level security;

-- ---- Workshop profiles: acceso por taller (igual que clients/repairs) ----
create policy "workshop_profiles_workshop_all" on public.workshop_profiles
  for all
  using (workshop_id = public.current_workshop_id())
  with check (workshop_id = public.current_workshop_id());
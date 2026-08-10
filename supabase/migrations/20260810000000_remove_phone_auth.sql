-- ============================================================================
--  Fase A2: elimina el teléfono del flujo de autenticación.
--  --------------------------------------------------------------
--  El registro/login ya no pide teléfono (solo Google OAuth y email+password
--  con correo verificado). Se quita la columna `phone` de las tablas que el
--  trigger `handle_new_user` crea desde `raw_user_meta_data` (workshops y
--  profiles). Las columnas `phone` de `clients` y `repairs` se conservan:
--  son datos de negocio (contacto del cliente), no de autenticación.
-- ============================================================================

-- Quita el teléfono de las tablas creadas por el flujo de registro.
alter table public.workshops drop column if exists phone;
alter table public.profiles drop column if exists phone;

-- Recrea el trigger sin leer `raw_user_meta_data->>'phone'`.
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
    'admin',  -- la primera cuenta (la que crea taller) es el dueño admin
    0,        -- commission_rate para admin
    true,     -- is_active para admin
    null,     -- specialty para admin
    now()     -- joined_at para admin
  );

  return new;
end;
$$;
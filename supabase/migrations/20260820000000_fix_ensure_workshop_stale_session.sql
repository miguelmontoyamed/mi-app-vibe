-- ============================================================================
--  Fix: ensure_workshop con sesión obsoleta (usuario eliminado de auth.users)
--  ---------------------------------------------------------------------------
--  Error observado en producción (web): código 23503, "insert or update on
--  table profiles violates foreign key constraint profiles_id_fkey".
--
--  Causa raíz: el navegador conserva un JWT válido de una cuenta que ya fue
--  eliminada de auth.users (p. ej. usuario de prueba borrado vía Admin API).
--  ensure_workshop() leía auth.uid() (id que ya no existe en auth.users),
--  no encontraba fila en profiles, y procedía a INSERTAR el perfil con ese id
--  → violaba la FK profiles_id_fkey → el RPC fallaba → resolveWorkshopId()
--  devolvía null → fetchRepairs quedaba bloqueado y las pantallas de
--  job/[id] y receipt/[id] eran inalcanzables.
--
--  Fix: guard `if not found then return null` tras leer auth.users. Con una
--  sesión obsoleta ya no se inserta taller ni perfil; el cliente detecta el
--  null + getUser() fallido y cierra la sesión (src/lib/supabase.ts).
--  Idempotente: create or replace function.
-- ============================================================================

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

  -- Sin perfil: leer el nombre del usuario (mismo COALESCE que el trigger
  -- handle_new_user: nunca falla por datos incompletos).
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
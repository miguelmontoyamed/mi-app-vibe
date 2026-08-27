-- ============================================================
-- REWRITE: handle_new_user
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
  -- 1) Extraer workshop_id de raw_user_meta_data.
  --    El cliente (frontend) ya DEBE enviar el workshop_id directo.
  begin
    req_workshop := (meta->>'workshop_id')::uuid;
  exception when others then
    req_workshop := null;
  end;

  -- 2) Resolver el taller:
  if req_workshop is not null then
    -- Si el cliente envió un workshop_id, validamos que exista EN workshops.
    select id into w_id
      from public.workshops
     where id = req_workshop
     limit 1;
     
    -- NUNCA creamos un taller si venía con invitación pero el taller no se encontró
    -- (si no existe, simplemente fallará el FK profile->workshop, lo cual es correcto
    -- para no dejar perfiles huérfanos con talleres falsos).
    new_role := 'technician';
  else
    -- Si NO viene workshop_id, es un registro orgánico del dueño.
    insert into public.workshops (name)
    values (coalesce(nullif(meta->>'workshop_name', ''), 'Mi Taller'))
    returning id into w_id;
    new_role := 'admin';
  end if;

  -- 3) Crear Perfil
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

-- ============================================================
-- REWRITE: ensure_workshop
-- ============================================================
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
  req_workshop uuid;
  meta jsonb;
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

  -- Sin perfil: intentar recuperar raw_user_meta_data
  select raw_user_meta_data into meta
    from auth.users
   where id = uid;
   
  -- Sesión obsoleta:
  if not found then
    return null;
  end if;

  meta := coalesce(meta, '{}'::jsonb);
  full_name := coalesce(nullif(meta->>'full_name', ''), 'Usuario');

  begin
    req_workshop := (meta->>'workshop_id')::uuid;
  exception when others then
    req_workshop := null;
  end;

  if req_workshop is not null then
    -- Es un técnico invitado al que no se le creó el perfil por algún fallo.
    -- Validar que el taller exista
    select id into w_id
      from public.workshops
     where id = req_workshop
     limit 1;
     
    if w_id is not null then
      insert into public.profiles (id, workshop_id, full_name, role, is_active, joined_at)
      values (uid, w_id, full_name, 'technician', true, now())
      on conflict (id) do nothing;
      return w_id;
    end if;
  end if;

  -- Si NO había workshop_id o era inválido, creamos el taller por defecto (dueño)
  insert into public.workshops (name)
  values (coalesce(nullif(meta->>'workshop_name', ''), 'Mi Taller'))
  returning id into w_id;

  insert into public.profiles (id, workshop_id, full_name, role, is_active, joined_at)
  values (uid, w_id, full_name, 'admin', true, now())
  on conflict (id) do nothing;

  -- Re-leer por si otra sesión creó el perfil en paralelo (race).
  select workshop_id into w_id from public.profiles where id = uid;
  return w_id;
end;
$$;

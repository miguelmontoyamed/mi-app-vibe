-- ============================================================
-- MIGRACIÓN: 20260904010000_patch_invitation_claim_and_handle_new_user.sql
-- 1. Permite a claim_technician_invitation actualizar el perfil sin ser bloqueado por trg_check_profile_updates
-- 2. Cierra la vulnerabilidad en handle_new_user donde se permitía unirse a cualquier taller sin token
-- 3. Resuelve la búsqueda de gen_random_bytes especificando extensions.gen_random_bytes
-- 4. Inserta el perfil antes de actualizar claimed_by para satisfacer la FK workshop_invitations_claimed_by_fkey
-- ============================================================

-- 1. TRIGGER check_profile_updates: permitir bypass durante flujo autorizado de reclamo de invitación
create or replace function public.check_profile_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := public.current_user_role();
begin
  -- Si la mutación proviene de una transacción autorizada por token (claim_technician_invitation)
  if current_setting('app.claiming_invitation', true) = 'true' then
    return new;
  end if;

  -- Si quien ejecuta el update no es admin del taller:
  if caller_role is distinct from 'admin' then
    -- Prohibir modificar rol
    if new.role is distinct from old.role then
      raise exception 'No tienes permisos para modificar tu rol de usuario';
    end if;
    -- Prohibir cambiar de taller
    if new.workshop_id is distinct from old.workshop_id then
      raise exception 'No tienes permisos para cambiar de taller';
    end if;
    -- Prohibir modificar comisión
    if new.commission_rate is distinct from old.commission_rate then
      raise exception 'No tienes permisos para modificar la comisión. Solo el administrador puede asignarla';
    end if;
    -- Prohibir activar o desactivar usuario
    if new.is_active is distinct from old.is_active then
      raise exception 'No tienes permisos para modificar el estado de activación';
    end if;
  end if;

  -- Nadie (ni admin) puede transferir un perfil a otro taller directamente vía UPDATE REST
  if new.workshop_id is distinct from old.workshop_id and caller_role = 'admin' then
    if old.id = auth.uid() then
      raise exception 'No está permitido cambiar de taller directamente. Debes usar una invitación válida.';
    end if;
  end if;

  return new;
end;
$$;


-- 2. RPC create_technician_invitation: calificar extensions.gen_random_bytes y search_path
create or replace function public.create_technician_invitation(
  p_email text default null,
  p_hours int default 24
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  w_id uuid;
  tech_count int;
  new_token text;
  inv_id uuid;
  clean_email text;
  valid_hours int;
  exp_timestamp timestamptz;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'message', 'No autenticado');
  end if;

  if public.current_user_role() <> 'admin' then
    return jsonb_build_object('ok', false, 'message', 'Solo el administrador del taller puede generar invitaciones');
  end if;

  w_id := public.current_workshop_id();
  if w_id is null then
    return jsonb_build_object('ok', false, 'message', 'Taller no encontrado para este usuario');
  end if;

  -- Validar límite de 5 técnicos activos
  select count(*) into tech_count
    from public.profiles
   where workshop_id = w_id
     and role = 'technician'
     and is_active = true;

  if tech_count >= 5 then
    return jsonb_build_object('ok', false, 'message', 'El taller ya alcanzó el límite de 5 técnicos permitidos');
  end if;

  clean_email := lower(trim(coalesce(p_email, '')));
  if clean_email = '' then
    clean_email := null;
  end if;

  valid_hours := coalesce(p_hours, 24);
  if valid_hours < 1 or valid_hours > 168 then
    valid_hours := 24; -- valor por defecto: 24 horas (máx 7 días)
  end if;
  exp_timestamp := now() + (valid_hours || ' hours')::interval;

  -- Generar token aleatorio criptográfico (32 bytes hex = 64 caracteres)
  new_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.workshop_invitations (
    workshop_id,
    invited_by,
    email,
    token,
    role,
    status,
    expires_at
  )
  values (
    w_id,
    uid,
    clean_email,
    new_token,
    'technician',
    'pending',
    exp_timestamp
  )
  returning id into inv_id;

  return jsonb_build_object(
    'ok', true,
    'id', inv_id,
    'token', new_token,
    'email', clean_email,
    'expires_at', exp_timestamp,
    'workshop_id', w_id
  );
end;
$$;


-- 3. RPC claim_technician_invitation: marcar app.claiming_invitation para evitar falso positivo del trigger
create or replace function public.claim_technician_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  u_email text;
  inv record;
  target_workshop public.workshops%rowtype;
  cur_profile public.profiles%rowtype;
  tech_count int;
  auto_created_workshop_id uuid;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'message', 'No autenticado');
  end if;

  if p_token is null or length(trim(p_token)) = 0 then
    return jsonb_build_object('ok', false, 'message', 'Token de invitación requerido');
  end if;

  select email into u_email from auth.users where id = uid;

  -- Bloquear y leer la fila de invitación
  select * into inv
    from public.workshop_invitations
   where token = trim(p_token)
     for update;

  if inv.id is null then
    return jsonb_build_object('ok', false, 'message', 'Invitación no encontrada o enlace inválido');
  end if;

  if inv.status = 'revoked' then
    return jsonb_build_object('ok', false, 'message', 'La invitación fue revocada por el administrador');
  end if;

  if inv.status = 'accepted' then
    return jsonb_build_object('ok', false, 'message', 'Esta invitación ya fue utilizada previamente');
  end if;

  if inv.expires_at < now() or inv.status = 'expired' then
    update public.workshop_invitations set status = 'expired' where id = inv.id;
    return jsonb_build_object('ok', false, 'message', 'El enlace de invitación ha expirado');
  end if;

  -- Si la invitación requería un correo específico, validar
  if inv.email is not null and lower(trim(inv.email)) <> lower(trim(coalesce(u_email, ''))) then
    return jsonb_build_object(
      'ok', false,
      'message', 'Esta invitación es exclusiva para la cuenta de correo ' || inv.email || ' (iniciaste con ' || coalesce(u_email, 'desconocido') || ')'
    );
  end if;

  -- Verificar taller
  select * into target_workshop
    from public.workshops
   where id = inv.workshop_id;

  if target_workshop.id is null then
    return jsonb_build_object('ok', false, 'message', 'El taller especificado ya no existe');
  end if;

  -- Verificar límite de 5 técnicos activos
  select count(*) into tech_count
    from public.profiles
   where workshop_id = inv.workshop_id
     and role = 'technician'
     and is_active = true
     and id <> uid;

  if tech_count >= 5 then
    return jsonb_build_object('ok', false, 'message', 'El taller ya alcanzó el límite de 5 técnicos');
  end if;

  -- Habilitar bypass de seguridad para reclamación legítima de invitación en esta transacción
  perform set_config('app.claiming_invitation', 'true', true);

  -- Consultar perfil del usuario
  select * into cur_profile
    from public.profiles
   where id = uid;

  if cur_profile.id is not null then
    auto_created_workshop_id := cur_profile.workshop_id;

    update public.profiles
       set workshop_id = inv.workshop_id,
           role = 'technician',
           joined_at = coalesce(joined_at, now())
     where id = uid;

    -- Limpiar taller huérfano si el usuario venía de uno auto-creado sin datos
    if auto_created_workshop_id is not null and auto_created_workshop_id <> inv.workshop_id then
      if not exists (select 1 from public.repairs where workshop_id = auto_created_workshop_id)
         and not exists (select 1 from public.profiles where workshop_id = auto_created_workshop_id and id <> uid) then
        delete from public.workshops where id = auto_created_workshop_id;
      end if;
    end if;
  else
    insert into public.profiles (id, workshop_id, full_name, role, is_active, joined_at)
    values (
      uid,
      inv.workshop_id,
      coalesce((select coalesce(nullif(raw_user_meta_data->>'full_name', ''), nullif(raw_user_meta_data->>'name', ''), email, 'Técnico') from auth.users where id = uid), 'Técnico'),
      'technician',
      true,
      now()
    )
    on conflict (id) do update
       set workshop_id = inv.workshop_id,
           role = 'technician';
  end if;

  -- Marcar invitación como aceptada
  update public.workshop_invitations
     set status = 'accepted',
         claimed_by = uid,
         claimed_at = now()
   where id = inv.id;

  return jsonb_build_object(
    'ok', true,
    'workshop_id', inv.workshop_id,
    'workshop_name', target_workshop.name
  );
end;
$$;


-- 4. HARDENING: handle_new_user
-- Cierra la vulnerabilidad donde un usuario podía unirse a cualquier taller sin token
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  w_id uuid;
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  provided_token text := nullif(trim(meta->>'invite_token'), '');
  inv record;
begin
  -- 1) Si viene con invite_token, validar rigurosamente contra workshop_invitations
  if provided_token is not null then
    select * into inv
      from public.workshop_invitations
     where token = provided_token
       and status = 'pending'
       and expires_at > now()
       for update;

    if inv.id is not null then
      -- Si la invitación tenía email restringido, validar coincidencia
      if inv.email is null or lower(trim(inv.email)) = lower(trim(coalesce(new.email, ''))) then
        w_id := inv.workshop_id;

        -- 1. Primero crear perfil como técnico del taller invitado (para satisfacer la FK de claimed_by)
        insert into public.profiles (id, workshop_id, full_name, role, commission_rate, is_active, specialty, joined_at)
        values (
          new.id,
          w_id,
          coalesce(nullif(meta->>'full_name', ''), new.email, 'Técnico'),
          'technician',
          0,
          true,
          nullif(meta->>'specialty', ''),
          now()
        );

        -- 2. Consumir la invitación asociándola al nuevo perfil
        update public.workshop_invitations
           set status = 'accepted',
               claimed_by = new.id,
               claimed_at = now()
         where id = inv.id;

        return new;
      end if;
    end if;
  end if;

  -- 2) Si NO viene con token válido: SIEMPRE crear un nuevo taller propio para el usuario.
  -- NUNCA permitir unirse a un workshop_id de terceros sin invitación validada.
  insert into public.workshops (name)
  values (coalesce(nullif(meta->>'workshop_name', ''), 'Mi Taller'))
  returning id into w_id;

  insert into public.profiles (id, workshop_id, full_name, role, commission_rate, is_active, specialty, joined_at)
  values (
    new.id,
    w_id,
    coalesce(nullif(meta->>'full_name', ''), new.email, 'Usuario'),
    'admin',
    0,
    true,
    nullif(meta->>'specialty', ''),
    now()
  );

  return new;
exception
  when others then
    return new;
end;
$$;

-- ============================================================
-- MIGRACIÓN: 20260904000000_harden_invitations_and_rbac.sql
-- Blindaje integral de invitaciones de técnicos y control de permisos RBAC/RLS
-- ============================================================

-- 1. TABLA: public.workshop_invitations
create table if not exists public.workshop_invitations (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  email text,
  token text unique not null,
  role text not null default 'technician' check (role in ('technician')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Índices de búsqueda y rendimiento
create index if not exists idx_workshop_invitations_token on public.workshop_invitations(token);
create index if not exists idx_workshop_invitations_workshop_status on public.workshop_invitations(workshop_id, status);

-- Habilitar RLS en workshop_invitations
alter table public.workshop_invitations enable row level security;

-- Política RLS: Solo administradores pueden gestionar invitaciones de su taller
drop policy if exists "invitations_admin_all" on public.workshop_invitations;
create policy "invitations_admin_all" on public.workshop_invitations
  for all
  using (
    workshop_id = public.current_workshop_id()
    and public.current_user_role() = 'admin'
  )
  with check (
    workshop_id = public.current_workshop_id()
    and public.current_user_role() = 'admin'
  );


-- 2. RPC: create_technician_invitation
-- Permite al admin generar una invitación persistente con token criptográfico
create or replace function public.create_technician_invitation(
  p_email text default null,
  p_hours int default 24
)
returns jsonb
language plpgsql
security definer
set search_path = public
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
  new_token := encode(gen_random_bytes(32), 'hex');

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

revoke execute on function public.create_technician_invitation(text, int) from public, anon;
grant execute on function public.create_technician_invitation(text, int) to authenticated, service_role;


-- 3. RPC: get_invitation_info
-- Permite al frontend (anon/auth) verificar la validez de una invitación y ver el nombre del taller
create or replace function public.get_invitation_info(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid', 'message', 'Token de invitación no proporcionado');
  end if;

  select i.*, w.name as workshop_name
    into inv
    from public.workshop_invitations i
    join public.workshops w on w.id = i.workshop_id
   where i.token = trim(p_token);

  if inv.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found', 'message', 'Invitación no encontrada o enlace inválido');
  end if;

  if inv.status = 'revoked' then
    return jsonb_build_object('ok', false, 'reason', 'revoked', 'message', 'Esta invitación fue revocada por el administrador del taller');
  end if;

  if inv.status = 'accepted' then
    return jsonb_build_object('ok', false, 'reason', 'already_used', 'message', 'Esta invitación ya fue utilizada');
  end if;

  if inv.expires_at < now() or inv.status = 'expired' then
    return jsonb_build_object('ok', false, 'reason', 'expired', 'message', 'El enlace de invitación ha vencido');
  end if;

  return jsonb_build_object(
    'ok', true,
    'workshop_id', inv.workshop_id,
    'workshop_name', inv.workshop_name,
    'email', inv.email,
    'expires_at', inv.expires_at
  );
end;
$$;

grant execute on function public.get_invitation_info(text) to anon, authenticated, service_role;


-- 4. RPC: claim_technician_invitation
-- Permite a un usuario autenticado reclamar una invitación con token verificado
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

  -- Verificar límite de 5 técnicos
  select count(*) into tech_count
    from public.profiles
   where workshop_id = inv.workshop_id
     and role = 'technician'
     and is_active = true
     and id <> uid;

  if tech_count >= 5 then
    return jsonb_build_object('ok', false, 'message', 'El taller ya alcanzó el límite de 5 técnicos');
  end if;

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

revoke execute on function public.claim_technician_invitation(text) from public, anon;
grant execute on function public.claim_technician_invitation(text) to authenticated, service_role;


-- 5. RPC: revoke_technician_invitation
-- Permite al administrador revocar una invitación activa
create or replace function public.revoke_technician_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  w_id uuid;
  target_inv record;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'message', 'No autenticado');
  end if;

  if public.current_user_role() <> 'admin' then
    return jsonb_build_object('ok', false, 'message', 'Solo el administrador del taller puede revocar invitaciones');
  end if;

  w_id := public.current_workshop_id();

  select * into target_inv
    from public.workshop_invitations
   where id = p_invitation_id
     and workshop_id = w_id;

  if target_inv.id is null then
    return jsonb_build_object('ok', false, 'message', 'Invitación no encontrada');
  end if;

  if target_inv.status = 'accepted' then
    return jsonb_build_object('ok', false, 'message', 'No se puede revocar una invitación que ya fue aceptada');
  end if;

  update public.workshop_invitations
     set status = 'revoked'
   where id = p_invitation_id;

  return jsonb_build_object('ok', true, 'message', 'Invitación revocada con éxito');
end;
$$;

revoke execute on function public.revoke_technician_invitation(uuid) from public, anon;
grant execute on function public.revoke_technician_invitation(uuid) to authenticated, service_role;


-- 6. RPC: claim_workshop_invitation (OBSOLETO / SEGURO)
-- Bloquea llamadas arbitrarias directas sin token
create or replace function public.claim_workshop_invitation(p_workshop_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return jsonb_build_object(
    'ok', false,
    'message', 'Método deshabilitado por motivos de seguridad. Debe usarse un enlace de invitación seguro con token.'
  );
end;
$$;


-- 7. TRIGGER: Prevenir auto-escalación y modificación de comisión en profiles
create or replace function public.check_profile_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := public.current_user_role();
begin
  -- Si quien ejecuta el update no es admin del taller (ej. el técnico modificando su propio perfil):
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

  return new;
end;
$$;

drop trigger if exists trg_check_profile_updates on public.profiles;
create trigger trg_check_profile_updates
  before update on public.profiles
  for each row execute function public.check_profile_updates();


-- 8. POLÍTICAS RLS: workshop_profiles (Membrete / Datos del Taller)
-- Solo lectura para técnicos; escritura estrictamente restringida a administradores
drop policy if exists "workshop_profiles_workshop_all" on public.workshop_profiles;
drop policy if exists "workshop_profiles_workshop_select" on public.workshop_profiles;
drop policy if exists "workshop_profiles_admin_insert" on public.workshop_profiles;
drop policy if exists "workshop_profiles_admin_update" on public.workshop_profiles;
drop policy if exists "workshop_profiles_admin_delete" on public.workshop_profiles;

create policy "workshop_profiles_workshop_select" on public.workshop_profiles
  for select using (workshop_id = current_workshop_id());

create policy "workshop_profiles_admin_insert" on public.workshop_profiles
  for insert with check (
    workshop_id = current_workshop_id()
    and public.current_user_role() = 'admin'
  );

create policy "workshop_profiles_admin_update" on public.workshop_profiles
  for update using (
    workshop_id = current_workshop_id()
    and public.current_user_role() = 'admin'
  ) with check (
    workshop_id = current_workshop_id()
    and public.current_user_role() = 'admin'
  );

create policy "workshop_profiles_admin_delete" on public.workshop_profiles
  for delete using (
    workshop_id = current_workshop_id()
    and public.current_user_role() = 'admin'
  );


-- 9. POLÍTICAS RLS: inventory (Catálogo de Repuestos)
-- Técnicos pueden leer y actualizar stock; pero NO crear ni eliminar repuestos del catálogo
drop policy if exists "inventory_workshop_all" on public.inventory;
drop policy if exists "inventory_workshop_select" on public.inventory;
drop policy if exists "inventory_admin_insert" on public.inventory;
drop policy if exists "inventory_workshop_update" on public.inventory;
drop policy if exists "inventory_admin_delete" on public.inventory;

create policy "inventory_workshop_select" on public.inventory
  for select using (workshop_id = current_workshop_id());

create policy "inventory_admin_insert" on public.inventory
  for insert with check (
    workshop_id = current_workshop_id()
    and public.current_user_role() = 'admin'
  );

create policy "inventory_workshop_update" on public.inventory
  for update using (workshop_id = current_workshop_id())
  with check (workshop_id = current_workshop_id());

create policy "inventory_admin_delete" on public.inventory
  for delete using (
    workshop_id = current_workshop_id()
    and public.current_user_role() = 'admin'
  );

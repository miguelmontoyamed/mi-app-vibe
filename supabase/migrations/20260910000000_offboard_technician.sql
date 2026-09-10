-- ============================================================
-- MIGRACIÓN: 20260910000000_offboard_technician.sql
-- Desvinculación definitiva de técnicos (offboarding completo):
--  1. Columna `notes` en public.clients (trazabilidad del alta automática).
--  2. Endurece current_workshop_id(): NULL si el perfil falta o está inactivo
--     (cierra el acceso con JWTs aún vigentes tras una desvinculación).
--  3. Nueva RPC offboard_technician: el admin elimina al técnico en
--     auth.users (libera el email y cascada el perfil), congelando antes su
--     historial (technician_name), reasignando sus invitaciones al admin y
--     registrando su contacto como cliente del taller.
-- ============================================================

-- 1. Trazabilidad en clientes
alter table public.clients add column if not exists notes text;


-- 2. Helper endurecido: sin perfil o inactivo => sin taller => todo denegado
create or replace function public.current_workshop_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workshop_id
    from public.profiles
   where id = auth.uid()
     and is_active is not false
$$;


-- 3. RPC: offboard_technician
-- Desvincula definitivamente a un técnico del taller del admin invocador.
create or replace function public.offboard_technician(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  w_id uuid;
  target public.profiles%rowtype;
  target_email text;
  frozen_count int := 0;
  reassigned_count int := 0;
  client_created bool := false;
  client_existed bool := false;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'message', 'No autenticado');
  end if;

  if public.current_user_role() <> 'admin' then
    return jsonb_build_object('ok', false, 'message', 'Solo el administrador del taller puede desvincular técnicos');
  end if;

  w_id := public.current_workshop_id();
  if w_id is null then
    return jsonb_build_object('ok', false, 'message', 'Taller no encontrado para este usuario');
  end if;

  if p_profile_id is null then
    return jsonb_build_object('ok', false, 'message', 'Técnico no especificado');
  end if;

  if p_profile_id = uid then
    return jsonb_build_object('ok', false, 'message', 'No puedes desvincularte a ti mismo');
  end if;

  select * into target
    from public.profiles
   where id = p_profile_id;

  if target.id is null then
    return jsonb_build_object('ok', false, 'message', 'Técnico no encontrado');
  end if;

  if target.workshop_id is distinct from w_id then
    return jsonb_build_object('ok', false, 'message', 'Ese técnico no pertenece a tu taller');
  end if;

  if target.role <> 'technician' then
    return jsonb_build_object('ok', false, 'message', 'Solo se puede desvincular a técnicos');
  end if;

  select email into target_email from auth.users where id = target.id;

  -- 3a. Congelar el nombre en el historial de órdenes (filas legacy sin snapshot)
  update public.repairs
     set technician_name = coalesce(technician_name, target.full_name, 'Técnico')
   where technician_id = target.id::text
     and workshop_id = w_id;
  get diagnostics frozen_count = row_count;

  -- 3b. Reasignar al admin las invitaciones creadas por el técnico
  -- (evita que se pierdan por el CASCADE de invited_by)
  update public.workshop_invitations
     set invited_by = uid
   where invited_by = target.id;
  get diagnostics reassigned_count = row_count;

  -- 3c. Registrar el contacto como cliente del taller (dedupe por email)
  if target_email is not null and length(trim(target_email)) > 0 then
    if exists (
      select 1 from public.clients
       where workshop_id = w_id
         and lower(email) = lower(trim(target_email))
    ) then
      client_existed := true;
    else
      insert into public.clients (workshop_id, name, email, notes)
      values (
        w_id,
        coalesce(nullif(trim(target.full_name), ''), 'Ex-técnico'),
        lower(trim(target_email)),
        'Ex-técnico desvinculado el ' || now()::date
      );
      client_created := true;
    end if;
  end if;

  -- 3d. Eliminar la cuenta Auth: libera el email y cascada el perfil.
  -- Las órdenes conservan technician_id/technician_name (texto, sin FK);
  -- claimed_by en invitaciones pasa a NULL (FK existente).
  delete from auth.users where id = target.id;

  return jsonb_build_object(
    'ok', true,
    'repairs_preserved', frozen_count,
    'invites_reassigned', reassigned_count,
    'client_created', client_created,
    'client_existed', client_existed,
    'email_freed', coalesce(target_email, '')
  );
end;
$$;

revoke execute on function public.offboard_technician(uuid) from public, anon;
grant execute on function public.offboard_technician(uuid) to authenticated, service_role;

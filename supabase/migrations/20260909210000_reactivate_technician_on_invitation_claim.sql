-- ============================================================
-- MIGRACIÓN: 20260909210000_reactivate_technician_on_invitation_claim.sql
-- Reactiva al técnico (is_active = true) al reclamar una invitación de taller.
-- Resuelve el problema donde un técnico desactivado (soft-delete) recontratado
-- mediante invitación quedaba en el taller pero con is_active = false.
-- ============================================================

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
           is_active = true,
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
           role = 'technician',
           is_active = true;
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

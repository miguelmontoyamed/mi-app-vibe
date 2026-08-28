-- ============================================================
-- RPC: claim_workshop_invitation
-- Permite a un usuario autenticado (nuevo o registrado vía Google/OAuth)
-- vincularse al taller al que fue invitado como técnico.
-- ============================================================
create or replace function public.claim_workshop_invitation(p_workshop_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target_workshop public.workshops%rowtype;
  cur_profile public.profiles%rowtype;
  tech_count int;
  auto_created_workshop_id uuid;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'message', 'No autenticado');
  end if;

  if p_workshop_id is null then
    return jsonb_build_object('ok', false, 'message', 'Workshop ID inválido');
  end if;

  -- 1) Verificar que el taller objetivo exista
  select * into target_workshop
    from public.workshops
   where id = p_workshop_id;
   
  if target_workshop.id is null then
    return jsonb_build_object('ok', false, 'message', 'El taller especificado no existe');
  end if;

  -- 2) Verificar límite de 5 técnicos en el taller destino
  select count(*) into tech_count
    from public.profiles
   where workshop_id = p_workshop_id
     and role = 'technician'
     and is_active = true
     and id <> uid;

  if tech_count >= 5 then
    return jsonb_build_object('ok', false, 'message', 'El taller ya alcanzó el límite de 5 técnicos');
  end if;

  -- 3) Consultar el perfil actual del usuario
  select * into cur_profile
    from public.profiles
   where id = uid;

  if cur_profile.id is not null then
    -- Si ya está asociado a este taller como técnico, nada que hacer
    if cur_profile.workshop_id = p_workshop_id and cur_profile.role = 'technician' then
      return jsonb_build_object('ok', true, 'workshop_id', p_workshop_id, 'workshop_name', target_workshop.name);
    end if;

    auto_created_workshop_id := cur_profile.workshop_id;

    -- Actualizar perfil al nuevo taller con rol 'technician'
    update public.profiles
       set workshop_id = p_workshop_id,
           role = 'technician',
           joined_at = coalesce(joined_at, now())
     where id = uid;

    -- Si el taller anterior fue auto-creado y no tiene reparaciones ni otros perfiles, limpiarlo
    if auto_created_workshop_id is not null and auto_created_workshop_id <> p_workshop_id then
      if not exists (select 1 from public.repairs where workshop_id = auto_created_workshop_id)
         and not exists (select 1 from public.profiles where workshop_id = auto_created_workshop_id and id <> uid) then
        delete from public.workshops where id = auto_created_workshop_id;
      end if;
    end if;
  else
    -- Perfil no existía: crearlo directamente
    insert into public.profiles (id, workshop_id, full_name, role, is_active, joined_at)
    values (
      uid,
      p_workshop_id,
      coalesce((select coalesce(nullif(raw_user_meta_data->>'full_name', ''), nullif(raw_user_meta_data->>'name', ''), email, 'Técnico') from auth.users where id = uid), 'Técnico'),
      'technician',
      true,
      now()
    )
    on conflict (id) do update
       set workshop_id = p_workshop_id,
           role = 'technician';
  end if;

  return jsonb_build_object('ok', true, 'workshop_id', p_workshop_id, 'workshop_name', target_workshop.name);
end;
$$;

revoke execute on function public.claim_workshop_invitation(uuid) from public, anon;
grant execute on function public.claim_workshop_invitation(uuid) to authenticated, service_role;

-- Permitir limpieza de talleres huérfanos sin reparaciones ni perfiles
drop policy if exists "workshops_admin_delete" on public.workshops;
create policy "workshops_admin_delete" on public.workshops
  for delete using (
    (id = current_workshop_id() and public.current_user_role() = 'admin')
    or (not exists (select 1 from public.profiles where workshop_id = workshops.id)
        and not exists (select 1 from public.repairs where workshop_id = workshops.id))
  );

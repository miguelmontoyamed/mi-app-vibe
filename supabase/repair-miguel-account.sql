-- Script de reparación manual (DML) para reasignar la cuenta de Miguel Montoya
-- a su verdadero taller y purgar el taller huérfano.

do $$
declare
  jaider_uid uuid;
  jaider_workshop uuid;
  miguel_uid uuid;
  miguel_current_workshop uuid;
begin
  -- 1. Obtener los IDs de auth.users usando los emails
  select id into jaider_uid from auth.users where email = 'jaiderpr@gmail.com';
  select id into miguel_uid from auth.users where email = 'miguelmontoyabq@gmail.com';

  -- Si alguno no existe, detenemos la ejecución (seguridad).
  if jaider_uid is null then
    raise notice 'No se encontro el usuario jaiderpr@gmail.com';
    return;
  end if;

  if miguel_uid is null then
    raise notice 'No se encontro el usuario miguelmontoyabq@gmail.com';
    return;
  end if;

  -- 2. Obtener el taller legítimo del dueño
  select workshop_id into jaider_workshop
    from public.profiles
   where id = jaider_uid;

  if jaider_workshop is null then
    raise notice 'Jaider no tiene un taller asociado';
    return;
  end if;

  -- 3. Obtener el taller actual de Miguel para luego intentar purgarlo
  select workshop_id into miguel_current_workshop
    from public.profiles
   where id = miguel_uid;

  -- 4. Reasignar a Miguel como técnico del taller legítimo
  update public.profiles
     set workshop_id = jaider_workshop,
         role = 'technician',
         is_active = true
   where id = miguel_uid;

  raise notice 'Cuenta % migrada al taller % como technician.', miguel_uid, jaider_workshop;

  -- 5. Intentar eliminar el taller huérfano de Miguel
  -- Solo se elimina si nadie más lo está usando (el motor lanzará error de FK si hay reparaciones u otros perfiles,
  -- lo cual es deseable, pero usaremos delete que fallará gracefully si lo capturamos, o validamos primero).
  if miguel_current_workshop is not null and miguel_current_workshop != jaider_workshop then
    begin
      delete from public.workshops where id = miguel_current_workshop;
      raise notice 'Taller huerfano % eliminado.', miguel_current_workshop;
    exception when others then
      raise notice 'No se pudo eliminar el taller huerfano % (puede tener registros dependientes).', miguel_current_workshop;
    end;
  end if;

end;
$$;

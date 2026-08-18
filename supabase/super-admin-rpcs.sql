-- Super Admin RPCs (Security Definer)
-- Acceso exclusivo del dueño (SUPER_ADMIN_USER_ID). Sin estas funciones,
-- la RLS de workshops solo permite leer/actualizar el taller propio.

-- Solo el dueño puede listar todos los talleres.
-- `auth.uid() = uid` con auth.uid() NULL simplemente no matchea filas (seguro);
-- IS NOT DISTINCT FROM haría lo contrario. El WHERE = es correcto aquí.
create or replace function public.list_all_workshops()
returns table (
  id uuid,
  name text,
  status text,
  trial_ends_at timestamptz,
  subscription_ends_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select w.id, w.name, w.status, w.trial_ends_at, w.subscription_ends_at, w.created_at
  from public.workshops w
  where auth.uid() = 'ecb17edb-bf94-4b03-a798-28ef60b99720'::uuid
  order by w.created_at asc;
$$;

-- Solo el dueño puede añadir 30 días acumulables a cualquier taller.
-- ACUMULACIÓN INTELIGENTE: si el taller ya tiene una fecha de expiración
-- futura (subscription_ends_at o trial_ends_at mayor que now()), se suman 30
-- días EXACTOS a esa fecha; si ya expiró por completo, se suman 30 días desde
-- now(). Así N pagos seguidos = N*30 días acumulados.
-- OJO: usar IS DISTINCT FROM — con `<>`, un auth.uid() NULL (p. ej. service_role)
-- hace que la condición sea NULL y el IF se salta la excepción (NULL trap).
create or replace function public.activate_workshop(p_workshop_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base timestamptz;
begin
  if auth.uid() is distinct from 'ecb17edb-bf94-4b03-a798-28ef60b99720'::uuid then
    raise exception 'Acceso denegado: solo el super admin puede activar talleres';
  end if;

  -- Fecha de vencimiento más lejana vigente (suscripción o trial futura).
  select greatest(
    coalesce(subscription_ends_at, '-infinity'::timestamptz),
    coalesce(trial_ends_at, '-infinity'::timestamptz)
  ) into v_base
  from public.workshops
  where id = p_workshop_id;

  -- Si no hay vencimiento futuro, la base es ahora (caso expirado/nuevo).
  if v_base <= now() then
    v_base := now();
  end if;

  update public.workshops
  set status = 'active',
      subscription_ends_at = v_base + interval '30 days'
  where id = p_workshop_id;
end;
$$;

-- Rechazar anónimos; solo usuarios autenticados (y la función valida el uid).
revoke execute on function public.list_all_workshops() from anon;
revoke execute on function public.list_all_workshops() from public;
revoke execute on function public.activate_workshop(uuid) from anon;
revoke execute on function public.activate_workshop(uuid) from public;
grant execute on function public.list_all_workshops() to authenticated;
grant execute on function public.activate_workshop(uuid) to authenticated;

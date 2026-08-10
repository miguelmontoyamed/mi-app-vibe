-- ============================================================================
--  Fix RLS: cierre de escalación de privilegios y evasión de taller.
--  --------------------------------------------------------------
--  Problema 1: `profiles_own_update` usaba solo `using (id = auth.uid())`
--  sin `WITH CHECK` → un usuario podía actualizar su propio perfil para
--  cambiar `workshop_id` (mudarse a otro taller y ver sus datos) o su `role`
--  (auto-promocionarse a admin).
--  Problema 2: la policy de SELECT por taller funcionaba, pero la de UPDATE
--    no validaba que la fila siguiera perteneciendo al mismo taller.
--  Solución: `WITH CHECK` que fija taller y rol al valor ACTUAL del usuario
--    (leído con SECURITY DEFINER para evitar recursión RLS).
-- ============================================================================

-- Helper: rol del usuario autenticado (seguro contra recursión RLS).
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Recrea la policy de perfil con WITH CHECK: el usuario solo puede tocar SU
-- fila, mantener su taller y su rol (no se puede auto-promocionar ni migrar).
drop policy if exists "profiles_own_update" on public.profiles;
create policy "profiles_own_update" on public.profiles
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and workshop_id = public.current_workshop_id()
    and role = public.current_user_role()
  );
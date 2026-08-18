-- ============================================================
-- TechRepair Master — SCRIPT DE HARDENING DE SEGURIDAD (RLS)
-- Generado por auditoría multi-tenant (2026-08-17)
-- IDEMPOTENTE: seguro de ejecutar múltiples veces.
-- Ejecutar en: Supabase Dashboard → SQL Editor (rol postgres/owner).
-- ============================================================

begin;

-- ============================================================
-- 1) Asegurar RLS habilitado en todas las tablas
-- ============================================================
alter table public.workshops         enable row level security;
alter table public.profiles          enable row level security;
alter table public.clients           enable row level security;
alter table public.repairs           enable row level security;
alter table public.inventory         enable row level security;
alter table public.workshop_profiles enable row level security;

-- ============================================================
-- 2) workshops: SELECT para miembros del taller; UPDATE/DELETE
--    SOLO admin. (La app no usa esta tabla directamente; el
--    trigger handle_new_user la crea. El DELETE en cascada de
--    un taller borraría profiles/clients/repairs/inventory/
--    workshop_profiles — por eso solo el admin puede borrarlo.)
-- ============================================================
drop policy if exists "workshops_owner_all"         on public.workshops;
drop policy if exists "workshops_workshop_select"   on public.workshops;
drop policy if exists "workshops_admin_update"      on public.workshops;
drop policy if exists "workshops_admin_delete"      on public.workshops;

create policy "workshops_workshop_select" on public.workshops
  for select using (id = current_workshop_id());

create policy "workshops_admin_update" on public.workshops
  for update
  using (id = current_workshop_id())
  with check (id = current_workshop_id() and public.current_user_role() = 'admin');

create policy "workshops_admin_delete" on public.workshops
  for delete using (
    id = current_workshop_id()
    and public.current_user_role() = 'admin'
  );

-- ============================================================
-- 3) clients: SELECT/INSERT/UPDATE para miembros; DELETE SOLO admin.
--    (La app deriva clientes de repairs; la tabla clients no se
--    usa en el frontend, pero se protege igual por defensa en profundidad.)
-- ============================================================
drop policy if exists "clients_workshop_all"  on public.clients;
drop policy if exists "clients_workshop_select" on public.clients;
drop policy if exists "clients_workshop_insert" on public.clients;
drop policy if exists "clients_workshop_update" on public.clients;
drop policy if exists "clients_admin_delete"   on public.clients;

create policy "clients_workshop_select" on public.clients
  for select using (workshop_id = current_workshop_id());

create policy "clients_workshop_insert" on public.clients
  for insert with check (workshop_id = current_workshop_id());

create policy "clients_workshop_update" on public.clients
  for update
  using (workshop_id = current_workshop_id())
  with check (workshop_id = current_workshop_id());

create policy "clients_admin_delete" on public.clients
  for delete using (
    workshop_id = current_workshop_id()
    and public.current_user_role() = 'admin'
  );

-- ============================================================
-- 4) inventory: SELECT/INSERT/UPDATE para miembros; DELETE SOLO admin.
--    (La app hace select/insert/update; nunca borra desde la UI.)
-- ============================================================
drop policy if exists "inventory_workshop_all"  on public.inventory;
drop policy if exists "inventory_workshop_select" on public.inventory;
drop policy if exists "inventory_workshop_insert" on public.inventory;
drop policy if exists "inventory_workshop_update" on public.inventory;
drop policy if exists "inventory_admin_delete"  on public.inventory;

create policy "inventory_workshop_select" on public.inventory
  for select using (workshop_id = current_workshop_id());

create policy "inventory_workshop_insert" on public.inventory
  for insert with check (workshop_id = current_workshop_id());

create policy "inventory_workshop_update" on public.inventory
  for update
  using (workshop_id = current_workshop_id())
  with check (workshop_id = current_workshop_id());

create policy "inventory_admin_delete" on public.inventory
  for delete using (
    workshop_id = current_workshop_id()
    and public.current_user_role() = 'admin'
  );

-- ============================================================
-- 5) repairs: ya correcto en schema.sql (DELETE solo admin).
--    Se re-crean por idempotencia.
-- ============================================================
drop policy if exists "repairs_workshop_all"    on public.repairs;
drop policy if exists "repairs_workshop_select" on public.repairs;
drop policy if exists "repairs_workshop_insert" on public.repairs;
drop policy if exists "repairs_workshop_update" on public.repairs;
drop policy if exists "repairs_admin_delete"    on public.repairs;

create policy "repairs_workshop_select" on public.repairs
  for select using (workshop_id = current_workshop_id());

create policy "repairs_workshop_insert" on public.repairs
  for insert with check (workshop_id = current_workshop_id());

create policy "repairs_workshop_update" on public.repairs
  for update
  using (workshop_id = current_workshop_id())
  with check (workshop_id = current_workshop_id());

create policy "repairs_admin_delete" on public.repairs
  for delete using (
    workshop_id = current_workshop_id()
    and public.current_user_role() = 'admin'
  );

-- ============================================================
-- 6) profiles: re-crear las políticas existentes por idempotencia
--    (read por taller; update de la propia fila sin cambiar taller/rol;
--    admin gestiona técnicos del taller).
-- ============================================================
drop policy if exists "profiles_workshop_read"              on public.profiles;
drop policy if exists "profiles_own_update"                 on public.profiles;
drop policy if exists "profiles_admin_manage_technicians"   on public.profiles;

create policy "profiles_workshop_read" on public.profiles
  for select using (workshop_id = current_workshop_id());

create policy "profiles_own_update" on public.profiles
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and workshop_id = public.current_workshop_id()
    and role = public.current_user_role()
  );

create policy "profiles_admin_manage_technicians" on public.profiles
  for all
  using (
    workshop_id = current_workshop_id()
    and auth.uid() != id
    and public.current_user_role() = 'admin'
  )
  with check (
    workshop_id = current_workshop_id()
    and auth.uid() != id
    and public.current_user_role() = 'admin'
  );

-- ============================================================
-- 7) workshop_profiles (membrete): acceso por taller.
--    Se mantiene FOR ALL por taller (sin cambio de rol) porque
--    la pantalla "taller" permite a los miembros editar el membrete.
-- ============================================================
drop policy if exists "workshop_profiles_workshop_all" on public.workshop_profiles;
create policy "workshop_profiles_workshop_all" on public.workshop_profiles
  for all
  using (workshop_id = current_workshop_id())
  with check (workshop_id = current_workshop_id());

-- ============================================================
-- 8) Defensa en profundidad: revocar EXECUTE de las funciones de
--    RLS al rol anónimo (solo authenticated y service_role).
--    Sin sesión autenticada, las consultas a tablas devolverán
--    error 401/403 en lugar de 200 con 0 filas (más estricto).
-- ============================================================
revoke execute on function public.current_workshop_id() from public, anon;
revoke execute on function public.current_user_role()   from public, anon;
grant  execute on function public.current_workshop_id() to authenticated, service_role;
grant  execute on function public.current_user_role()   to authenticated, service_role;

revoke execute on function public.ensure_workshop() from public, anon;
grant  execute on function public.ensure_workshop() to authenticated, service_role;

commit;

-- ============================================================
-- 9) VERIFICACIÓN (ejecutar DESPUÉS del commit):
--    Debe listar todas las políticas por tabla.
-- ============================================================
-- select schemaname, tablename, policyname
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, policyname;
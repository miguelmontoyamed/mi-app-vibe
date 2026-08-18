-- ============================================================
-- TechRepair Master — Monetización Fase 1: Trial 90 días + Paywall
-- Generado: 2026-08-17
-- IDEMPOTENTE: seguro de ejecutar múltiples veces.
-- Ejecutar en: Supabase Dashboard → SQL Editor (rol postgres/owner).
--
-- Efecto sobre talleres EXISTENTES: Postgres rellena las columnas
-- nuevas con su default, así que los 12 talleres actuales quedan en
-- 'trial' con trial_ends_at = ahora + 90 días (desde el momento del ALTER).
-- ============================================================

begin;

-- status: 'trial' (prueba gratis), 'active' (pagó), 'expired' (bloqueado)
alter table public.workshops
  add column if not exists status text
    not null default 'trial'
    check (status in ('trial', 'active', 'expired'));

-- Fin del periodo de prueba gratuito: 90 días desde la creación.
alter table public.workshops
  add column if not exists trial_ends_at timestamptz
    not null default (now() + interval '90 days');

-- Fin de la suscripción paga (null = sin suscripción activa).
alter table public.workshops
  add column if not exists subscription_ends_at timestamptz;

commit;

-- ============================================================
-- VERIFICACIÓN (ejecutar DESPUÉS del commit):
-- Debe mostrar 12 talleres en 'trial' con trial_ends_at futuro.
-- ============================================================
-- select id, name, status, trial_ends_at, subscription_ends_at
-- from public.workshops
-- order by created_at;
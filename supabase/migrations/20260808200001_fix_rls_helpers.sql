-- Fix RLS recursion: current_workshop_id() must be SECURITY DEFINER so the
-- inner SELECT on public.profiles does not re-trigger the RLS policy on
-- profiles (which itself calls this function) -> infinite recursion.
create or replace function public.current_workshop_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workshop_id from public.profiles where id = auth.uid()
$$;

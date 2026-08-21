-- ============================================================================
--  Realtime: Liquidación y Rendimiento Mensual en vivo
--
--  Agrega public.repairs a la publicación supabase_realtime para que el
--  cliente reciba postgres_changes (INSERT/UPDATE/DELETE) y refresque el
--  desglose mensual sin recargar. La visibilidad de los eventos respeta RLS:
--  cada miembro solo recibe eventos de filas que puede SELECT (su taller).
--  Idempotente: solo agrega la tabla si aún no es miembro.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'repairs'
  ) then
    alter publication supabase_realtime add table public.repairs;
  end if;
end
$$;

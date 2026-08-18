-- ============================================================
-- REPARACIÓN: técnico con taller propio (sus órdenes no aparecen
-- en el panel del dueño)
--
-- Causa: la orden se insertó con workshop_id del taller del
-- trabajador (registro por signup o cuenta sin perfil que
-- ensure_workshop() auto-aprovisionó como 'admin' con taller
-- propio "Mi Taller"). El RLS solo expone órdenes del taller
-- del usuario actual.
--
-- USO (3 pasos):
--   1) Ejecuta el bloque DIAGNÓSTICO y pega la salida al chat.
--   2) Sustituye los IDs marcados con <<< >>>.
--   3) Ejecuta los UPDATEs y verifica con el bloque final.
-- ============================================================

-- ── 1) DIAGNÓSTICO: quién está en qué taller ──────────────────
select p.id, p.full_name, p.role, p.workshop_id, w.name as taller
from profiles p
left join workshops w on w.id = p.workshop_id
order by p.joined_at;

-- ── 2) DIAGNÓSTICO: últimas órdenes y su taller ───────────────
select id, order_id, workshop_id, technician_name, status, created_at
from repairs
order by created_at desc
limit 10;

-- ============================================================
-- FIX (rellenar los IDs ANTES de ejecutar)
-- ============================================================

-- A) Asocia la cuenta del trabajador al taller del dueño y le da
--    rol técnico (si su cuenta había quedado como 'admin' por el
--    auto-aprovisionamiento). El trabajador debe cerrar sesión y
--    volver a entrar para refrescar rol y taller.
update profiles
set workshop_id = '<<<workshop_id_dueño>>>',
    role = 'technician'
where id = '<<<id_del_trabajador>>>';

-- B) Mueve las órdenes creadas en el taller huérfano al taller
--    del dueño para que aparezcan en su lista de trabajos.
update repairs
set workshop_id = '<<<workshop_id_dueño>>>'
where workshop_id = '<<<workshop_id_viejo_del_trabajador>>>';

-- ── 3) VERIFICACIÓN: órdenes visibles ahora en el taller del dueño ──
select id, order_id, workshop_id, technician_name, status, created_at
from repairs
where workshop_id = '<<<workshop_id_dueño>>>'
order by created_at desc
limit 10;
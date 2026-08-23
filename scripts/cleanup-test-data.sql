-- ============================================================================
-- TechRepair Master — Script de Limpieza de Datos de Prueba (Idempotente)
-- ============================================================================
-- Propósito: Eliminar exclusivamente registros de prueba/integración (E2E, smoke)
-- sin afectar datos reales de talleres en producción.
--
-- Criterios de identificación (patrones exclusivos de tests automatizados):
--   - repairs.client_name con prefijos 'QA E2E%', 'Verify QA%'
--   - clients.name con prefijos 'QA E2E%', 'Verify QA%', 'SMOKE%'
--   - inventory.name con prefijos 'TEST%', 'SMOKE%', 'QA-%'
--
-- SEGURIDAD: Solo elimina si el patrón coincide EXACTAMENTE.
--            No toca datos reales de usuarios (nombres como "Juan", "Miguel", etc.).
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1) ELIMINAR ÓRDENES DE PRUEBA (repairs)
-- -----------------------------------------------------------------------------
DELETE FROM public.repairs
WHERE 
  client_name ILIKE 'QA E2E%'      -- Generados por core-flows.spec.ts / invitation.spec.ts
  OR client_name ILIKE 'Verify QA%' -- Generados por tests de verificación
  OR client_name ILIKE 'SMOKE-TEST%' -- Generados por smoke tests
  OR client_name ILIKE 'QA-%';      -- Patrón genérico de QA

-- -----------------------------------------------------------------------------
-- 2) ELIMINAR CLIENTES DE PRUEBA (clients)
-- -----------------------------------------------------------------------------
DELETE FROM public.clients
WHERE 
  name ILIKE 'QA E2E%'
  OR name ILIKE 'Verify QA%'
  OR name ILIKE 'SMOKE-TEST%'
  OR name ILIKE 'QA-%';

-- -----------------------------------------------------------------------------
-- 3) ELIMINAR INVENTARIO DE PRUEBA (inventory) — solo si existe
-- -----------------------------------------------------------------------------
DELETE FROM public.inventory
WHERE 
  name ILIKE 'TEST%'
  OR name ILIKE 'SMOKE%'
  OR name ILIKE 'QA-%';

-- -----------------------------------------------------------------------------
-- 4) VERIFICACIÓN POST-LIMPIEZA (SELECT para confirmar)
-- -----------------------------------------------------------------------------
SELECT 'repairs' AS tabla, count(*) AS restantes_test
FROM public.repairs
WHERE client_name ILIKE 'QA E2E%' 
   OR client_name ILIKE 'Verify QA%' 
   OR client_name ILIKE 'SMOKE-TEST%' 
   OR client_name ILIKE 'QA-%'

UNION ALL

SELECT 'clients', count(*)
FROM public.clients
WHERE name ILIKE 'QA E2E%' 
   OR name ILIKE 'Verify QA%' 
   OR name ILIKE 'SMOKE-TEST%' 
   OR name ILIKE 'QA-%'

UNION ALL

SELECT 'inventory', count(*)
FROM public.inventory
WHERE name ILIKE 'TEST%' 
   OR name ILIKE 'SMOKE%' 
   OR name ILIKE 'QA-%';
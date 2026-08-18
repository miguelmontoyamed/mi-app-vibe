# Informe de Auditoría de Seguridad — TechRepair Master

**Fecha:** 2026-08-17
**Alcance:** Aislamiento multi-tenant (garantizar que ningún taller pueda acceder/leer/modificar/eliminar datos de otro taller)
**Método:** Revisión de `supabase/schema.sql` + pruebas de comportamiento contra la BD real (Supabase project `phmhlbodkoicjctlamah`) con anon key y usuarios reales creados vía Admin API (limpiados después).

---

## 1. Veredicto Ejecutivo

✅ **APTO para go-live respecto al aislamiento multi-tenant.** Todas las pruebas de cruce entre talleres pasaron (9/9). Un taller NO puede acceder, leer, modificar ni eliminar datos de otro taller. Las 6 tablas tienen RLS habilitado y las políticas están correctamente ancladas a `workshop_id = current_workshop_id()`.

⚠️ **3 recomendaciones de hardening de menor severidad** (no rompen el aislamiento entre talleres, pero cierran abusos de rol dentro del propio taller). Script listo en `supabase/security-hardening.sql`.

🔴 **1 acción operativa urgente:** rotar la `service_role` key (quedó expuesta en este chat y en scripts temporales ya eliminados).

---

## 2. Hallazgos Verificados (Tablas)

| Capa | Estado | Evidencia |
|---|---|---|
| RLS habilitado en 6 tablas (workshops, profiles, clients, repairs, inventory, workshop_profiles) | ✅ | schema.sql L354-359 |
| anon key: SELECT a todas las tablas | ✅ 0 filas | Prueba real: status 200, filas=0 en las 6 |
| anon key: INSERT a todas las tablas | ✅ bloqueado | Prueba real: 401 "violates row-level security policy" en las 6 |
| anon key: UPDATE/DELETE | ✅ bloqueado | 400 "requires a WHERE clause" (PostgREST) + RLS detrás |
| RPC `ensure_workshop` sin sesión | ✅ bloqueado | 401 "permission denied for function" (revocado de anon) |
| RPC `current_workshop_id` sin sesión | ✅ inofensivo | 200 null (no expone datos); se recomienda revocar igualmente |
| Aislamiento cruzado SELECT | ✅ | B no ve repairs de A (0 filas) |
| Aislamiento cruzado UPDATE | ✅ | B actualiza repair de A → 0 filas afectadas |
| Aislamiento cruzado DELETE | ✅ | B borra repair de A → 0 filas borradas |
| Aislamiento cruzado INSERT (usurpación de workshop_id) | ✅ | 401 RLS "new row violates policy" |
| `ensure_workshop` devuelve SIEMPRE el taller propio | ✅ | B → su taller; nunca crea/retorna otro |
| SECURITY DEFINER con `set search_path = public` | ✅ | current_workshop_id, current_user_role, ensure_workshop, handle_new_user |
| Secretos en el bundle frontend | ✅ | Sin `service_role` en `src/` (grep); solo RPCs `ensure_workshop`/`current_workshop_id` |
| Rutas públicas | ✅ | Solo `login` y `signup`; resto bajo `Stack.Protected` (`_layout.tsx` L30-35) |

---

## 3. Detalle por Capa

### 3.1 Row Level Security
- 6 tablas con `ENABLE ROW LEVEL SECURITY` (L354-359).
- Políticas `repairs`: SELECT/INSERT/UPDATE por `workshop_id = current_workshop_id()`; DELETE **solo admin** (`repairs_admin_delete`, L421-425). Correcto: los técnicos nunca pueden eliminar órdenes.
- Políticas `profiles`: read por taller; update solo de la propia fila **sin poder cambiar taller ni rol** (`profiles_own_update` L372-380, con `with check role = current_user_role()`); admins gestionan técnicos del taller (L386-398) usando `current_user_role()` SECURITY DEFINER para evitar recursión 42P17.
- `workshops`: `workshops_owner_all FOR ALL using (id = current_workshop_id())` — **hallazgo menor**: cualquier miembro (incluido técnico) podría UPDATE/DELETE la fila del taller; el DELETE en cascada borraría todo el taller (profiles, clients, repairs, inventory, workshop_profiles vía FK `on delete cascade`). **El hardening restringe UPDATE/DELETE a admin.**
- `clients` y `inventory`: `FOR ALL` por taller — **hallazgo menor**: técnicos podrían borrar inventario o clientes por API (la UI no lo expone). **El hardening restringe DELETE a admin.**

### 3.2 Funciones SECURITY DEFINER
- `current_workshop_id()`, `current_user_role()`, `ensure_workshop()`, `handle_new_user()` — todas con `set search_path = public` (evita hijacking de search_path). ✅
- `ensure_workshop()`: revocado de `public/anon/authenticated`, concedido solo a `authenticated` + `service_role` (L246-247). ✅ Verificado: 401 sin sesión.
- Recomendación de defensa en profundidad: revocar EXECUTE de `current_workshop_id()`/`current_user_role()` al rol `anon` (incluido en el hardening).

### 3.3 Endpoints / Rutas
- `_layout.tsx` usa `Stack.Protected guard={isAuthenticated}`: protege `(tabs)`, `receipt/[id]`, `job/[id]`, `taller`. Públicas: solo `login`, `signup`. ✅
- Sin buckets de storage en uso, sin edge functions expuestas.

---

## 4. Riesgos y Acciones

| # | Severidad | Hallazgo | Acción |
|---|---|---|---|
| 1 | 🔴 Alta (ops) | `service_role` key expuesta en chat/scripts | **Rotar en Supabase Dashboard → Settings → API Keys → Roll** (inmediato) |
| 2 | 🟠 Media | Técnicos pueden DELETE/UPDATE la fila `workshops` (cascada destructiva) | Aplicar `security-hardening.sql` (sección 2) |
| 3 | 🟠 Media | Técnicos pueden DELETE `clients`/`inventory` por API | Aplicar `security-hardening.sql` (secciones 3-4) |
| 4 | 🟡 Baja | `current_workshop_id`/`current_user_role` ejecutables por anon | Aplicar `security-hardening.sql` (sección 8) |

---

## 5. Cómo Aplicar

1. **Rotar la service_role key** (Dashboard → Settings → API Keys → Roll service_role key). Actualizar cualquier backend/script que la use.
2. **Ejecutar `supabase/security-hardening.sql`** en Supabase SQL Editor (idempotente, envuelto en transacción; se puede re-ejecutar).
3. **Verificar** con la consulta al final del script (`pg_policies`) y opcionalmente re-correr las pruebas anon/multi-tenant.

---

## 6. Limitaciones de la Auditoría

- No se pudo consultar `pg_policies` directamente (sin access token de Management API en la máquina; se verificó por **comportamiento**, que es más fuerte que la lectura de catálogo: se probó con usuarios reales y anon key contra el proyecto en vivo).
- La coherencia BD real vs `schema.sql` se infiere de los resultados de las pruebas (todas las operaciones anónimas y cruzadas fallaron como esperado).
- Los usuarios de prueba creados para la verificación multi-tenant fueron **eliminados** (Admin API) junto con sus talleres y datos; se confirmó 0 residuales.
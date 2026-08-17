# HANDOFF — TechRepair Master (mi-app-vibe)

> Registro de continuidad creado el **17-ago-2026**. Sirve para retomar el flujo
> desde cualquier máquina (ej. portátil del trabajo) con un `git pull`.

---

## 1. Qué es y dónde vive

| | |
|---|---|
| **App** | TechRepair Master — gestión de taller de reparaciones (órdenes, clientes, inventario, recibos). Idioma: español. |
| **Stack** | Expo SDK 57 / React Native 0.86 / React 19, TypeScript, expo-router (rutas en `src/app/`), Supabase (auth Google OAuth + Postgres con RLS), web desplegada en Vercel. |
| **Repo** | https://github.com/miguelmontoyamed/mi-app-vibe — rama `main` |
| **Web en vivo** | https://mi-app-vibe-ten.vercel.app/ |
| **Supabase** | Proyecto `phmhlbodkoicjctlamah` — región `sa-east-1` — pooler `aws-0-sa-east-1.pooler.supabase.com:6543` |
| **Documentación interna** | `AGENTS.md` (guía de proyecto) y `supabase/schema.sql` (esquema + RLS + triggers, idempotente) |

## 2. Credenciales y config (¡leer antes de clonar!)

### Públicas por diseño — se pueden poner en `.env`
Copia `.env.example` a `.env` y pega estos valores (son públicos: viajan dentro del bundle web):

```
EXPO_PUBLIC_SUPABASE_URL=https://phmhlbodkoicjctlamah.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBobWhsYm9ka29pY2pjdGxhbWFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyMTkzMzUsImV4cCI6MjEwMTc5NTMzNX0.a4w9DW-NarxLVnOgSMnZ_PNwZdFJimIcpi8MCBtasUQ
```

`EXPO_PUBLIC_GOOGLE_CLIENT_ID` (opcional, solo dev local con Google): está configurado en Vercel; si lo necesitas localmente pídelo en el historial del chat.

### SECRETAS — NUNCA subir al repo (`.gitignore` ya las excluye: `.env*`, `.env*.local`)
- **`SUPABASE_SERVICE_ROLE_KEY`** (JWT de servicio): necesaria para `scripts/db-smoke-test.mjs` (modo service role + Admin API). Está en el historial del chat de hoy / máquina de casa.
- **Token de Management API** (`sbp_...`): para ejecutar SQL contra la BD real vía `https://api.supabase.com/v1/projects/phmhlbodkoicjctlamah/database/query` (patrón usado para aplicar RPCs y políticas). También en el chat.

> ⚠️ **PENDIENTE DE SEGURIDAD**: estos dos secretos se compartieron por chat. **Recomendación: rotarlos** (Regenerar service_role en Supabase > Settings > API, y revocar/regenerar el token en `access-tokens` del dashboard). La app y los tests solo necesitan la anon key pública.

## 3. Estado del trabajo — TODO verificado hoy (17-ago)

### Commits de la sesión (rama `main`, ya en GitHub y desplegados)

| Commit | Qué resuelve |
|---|---|
| `4437ab6` | `addRepair` ahora devuelve `{ok, error}` (antes tragaba errores) + `receive.tsx` ya no navega si el INSERT falla |
| `c75bc81` | RPC `ensure_workshop` + helper `resolveWorkshopId` → auto-crea taller/perfil para cuentas sin fila en `profiles` (arregla RLS 42501 en INSERT) |
| `3210b85` | **Borrado de órdenes solo para el dueño/admin**: política RLS `repairs_admin_delete` (SELECT/INSERT/UPDATE quedan para todos los miembros), `deleteRepair` con gate de rol + verificación de fila borrada, smoke test con aserción "técnico NO puede borrar" |
| `5be3d32` | **Bug web: `Alert.alert` es no-op en react-native-web** → en `job/[id].tsx` la confirmación de borrado usa `window.confirm` en web (y `Alert.alert` en nativo); mismos avisos para el flujo de cancelar |

### Gates (verificados al final de la sesión)
- `npx tsc --noEmit` → **exit 0**
- `npm test` → **31/31 PASS**
- `npx expo lint` → **0 errores** (1 warning pre-existente en `auth-context.tsx`)
- `node scripts/db-smoke-test.mjs` (con `SUPABASE_SERVICE_ROLE_KEY`) → **11 PASS, 0 FAIL** contra la BD real
- Bundle web desplegado verificado: `entry-e725aacf...` contiene `window.confirm` + textos de confirmación

### Estado de la BD real (datos del usuario)
- `miguelmontoyamed@gmail.com` → **admin**, taller `67a82114-5010-4c20-ac84-2da488d7e684` ("Mi Taller"), 3 órdenes: `TRM-BNW6`, `TRM-YZCV`, `TRM-3GBG` (todas `Pendiente`)
- `miguelmontoya1003@gmail.com` → admin, taller `6f3eb346-...`, 1 orden (`TRM-A9WB`)
- `jcarlos2418@gmail.com` → taller `0665c6e0-...`, 1 orden (`TRM-WMT8`)
- Cada cuenta ve solo SU taller (RLS por diseño): "datos diferentes entre cuentas" NO es un bug.
- Limpieza hecha: talleres huérfanos "Mi Taller" sin perfiles (junk de tests) eliminados.

## 4. Cómo reanudar desde el portátil del trabajo

```bash
# 1. Clonar (o git pull si ya existe el repo)
git clone https://github.com/miguelmontoyamed/mi-app-vibe.git
cd mi-app-vibe

# 2. Dependencias
npm install

# 3. Entorno local (ver sección 2; solo valores públicos + opcional Google client id)
copy .env.example .env   # Windows — pegar URL + anon key

# 4. Verificar que todo sigue verde
npx tsc --noEmit
npm test
npx expo lint

# 5. Web local
npm run web             # http://localhost:8081

# 6. Smoke test real (solo si tienes la service role key en el entorno)
$env:SUPABASE_SERVICE_ROLE_KEY="<del chat>"; node scripts/db-smoke-test.mjs
```

Para continuar la sesión de agente: abre opencode en el repo y pídele que lea `HANDOFF.md` (este archivo) y `AGENTS.md` antes de empezar.

## 5. Pendientes / próximos pasos

1. **Confirmar con el usuario en web**: borrar una orden de prueba en Chrome/Brave con **Ctrl+F5** — debe aparecer el diálogo nativo y borrar. (Fix `5be3d32` ya desplegado y verificado en bundle.)
2. **Rotar secretos** (service_role + token `sbp_`) — pendiente de seguridad, ver sección 2.
3. **NO borrar órdenes de prueba del usuario** — pidió explícitamente no eliminar sus datos.
4. Decidir sobre huérfanos de pruebas del 15-ago ("Taller Fix Test", "Taller PostFix", "Taller Verif", "QA E2E…") — los dejé intactos; no son de los smoke runs.
5. (Opcional) Avisos `Alert.alert` silenciosos en web en otras pantallas (login, inventario, taller, admin feedback, recibos): aplicar el mismo patrón `window.alert`/`window.confirm` — solo afecta avisos de éxito/error, no bloquea acciones.
6. (Opcional) Diálogo de confirmación con la marca de la app (patrón `<Modal>` como el de "Marcar como No Realizado") en lugar del `window.confirm` del navegador, si se quiere look consistente en las 4 plataformas.

## 6. Comandos y patrones útiles

- **Aplicar SQL a la BD real** (políticas, RPCs, limpieza): script temporal en la raíz del repo que hace `POST https://api.supabase.com/v1/projects/phmhlbodkoicjctlamah/database/query` con `Authorization: Bearer <sbp_...>` y body `{ query: "<sql>" }`; se borra después de usarlo. (Ojo: en PowerShell los scripts `.cjs` con SQL multilínea → normalizar `\r\n` antes de `indexOf`.)
- **Verificar bundle desplegado**: el HTML de `https://mi-app-vibe-ten.vercel.app/` apunta a `/_expo/static/js/web/entry-<hash>.js`; descargar y buscar marcadores de texto (los strings del código se conservan en el bundle).
- **El smoke test se auto-limpia** (borra usuario, taller y técnico de prueba); si un run falla a mitad puede dejar un taller huérfano "Mi Taller" → limpiar con la query de la sección 5.4.
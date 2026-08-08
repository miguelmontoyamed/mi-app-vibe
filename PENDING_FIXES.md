# PENDING FIXES — Auditoría E2E de producción

**Fecha:** 2026-08-08
**Objetivo:** `https://mi-app-vibe-ten.vercel.app/` (deploy Vercel de `mi-app-vibe`, Expo SDK 57 / RN 0.86 web)
**Método:** Playwright + Chrome 151 (headless), ejecutado contra el sitio público y contra el build local con el fix.
**Evidencia cruda:** `C:\Users\MIGUEL\AppData\Local\Temp\opencode\e2e\{final-results.json, diag.json, reload-probe.json, probe.json, local-reload-probe.json}` + capturas PNG.

---

## Resumen ejecutivo

El **flujo principal funciona en producción** (7/7 pasos E2E PASS): registro de dueño → dashboard → recepción de equipo (incluye campo "Código / Desbloqueo") → el trabajo aparece en la Lista de Trabajos → licencia de prueba "Prueba - 3 Meses / 90 días restantes" visible en Admin. Cero errores de consola ni de página en todo el recorrido.

Se detectó **un bug funcional real**: la sesión **no sobrevivía a una recarga completa de página** (F5) ni a la entrada directa por URL en rutas protegidas. **Fix #1 aplicado y verificado en build local** (detalle abajo). **Pendiente: redeploy a Vercel para propagarlo a producción.**

---

## Lista numerada de hallazgos

### 1. [ALTA] [FIX APLICADO ✅] La sesión no sobrevivía a recarga completa (F5) ni a navegación directa a rutas protegidas

- **Qué se observó (pre-fix):** Tras registrar un dueño (sesión activa), un `page.reload()` redirigía a `/login` y **se quedaba ahí indefinidamente** (verificado durante 11s). Lo mismo al navegar con carga completa a `/admin`, `/receive` o `/jobs`.
- **Evidencia pre-fix:**
  - `reload-probe.json → A2_tras_reload`: timeline `1s..11s` todo en `/login`, con `session: {"userId":…}` presente en localStorage.
  - `diag.json → 04_navega_admin` y `05_tras_reload`: idem; los datos (session + usuarios) **siguen en localStorage**, la app no los restauró.
  - `probe.json → post_signup_5s`: la navegación por tabs (SPA, sin reload) sí funcionaba — el bug era exclusivo de la restauración tras carga completa.
- **Causa raíz:** `RootNavigator` (`src/app/_layout.tsx`) montaba `Stack.Protected guard={isAuthenticated}` **antes** de que terminara la hidratación asíncrona de `AsyncStorage` en `auth-context.tsx`. En la primera render `isAuthenticated=false` → el router decidía `/login`; al restaurarse la sesión (se huele `currentUser`), el build no re-dirigía de vuelta a la zona protegida.
- **Fix aplicado (2026-08-08):**
  1. `src/context/auth-context.tsx`: se expuso `hydrated` en la interfaz `AuthContextType` y en el `value` del Provider.
  2. `src/app/_layout.tsx`: `RootNavigator` ahora **no monta el `Stack`** (devuelve `null` mientras `hydrated === false`, cubierto por `AnimatedSplashOverlay`) — así la primera render del guard ya decide con la sesión real restaurada y se elimina la carrera.
- **Verificación post-fix (build local, `expo export -p web` + serve):** `local-reload-probe.json`:
  - `L2_tras_reload`: tras `page.reload()`, la URL permanece en `/` y el contenido muestra el dashboard (timeline registró 1s, nunca cayó a `/login`).
  - `L3_receive_directo`: navegación directa a `/receive` devuelve el formulario con el campo "código de desbloqueo" presente (sin redirigir a login).
- **Gates:** `npx tsc --noEmit` limpio, `npm run lint` exit 0, `npm test` 17/17 PASS.
- **Pendiente:** redeploy de Vercel para propagar el fix a producción y re-correr la sonda contra el sitio público.

### 2. [MEDIA — pendiente] Confirmar estado del deploy en Vercel antes de pactar el fix

- El bundle desplegado `entry-fde747da928eb5a217abe55b2c2c11f0.js` (2.6 MB) contenía las claves de storage pero el flujo real no restauraba la sesión. Tras aplicar el fix local, se debe:
  1. Verificar fecha de deploy (`vercel ls` / git log vs. último commit).
  2. Hacer redeploy (el código actual ya incluye el fix del hallazgo 1).
  3. Re-ejecutar la prueba de recarga contra `https://mi-app-vibe-ten.vercel.app/`.
- Si tras el redeploy el fix no se ve en producción, puede haber caché o build viejo — reiniciar/limpiar el deploy y repetir.

### 3. [VERIFICADO — sin acción] Flujo E2E core 7/7 en producción

- Registro de cuenta nueva de dueño → aterriza en dashboard ("Panel de Control") → tab Recepción → formulario con campo "Código / Desbloqueo" → guardar → redirige a `/jobs` con el trabajo visible → tab Admin & Licencia muestra licencia activa.
- `final-results.json`: `02_signup_submit.dash=true`, `04_recepcion_save.onJobs=true/jobVisible=true`, `05_jobs_list.hasDevice=true/hasClient=true`, `06_licencia_90.active=true/plan=true/keyShown=true`.
- **Sin errores** de consola ni de página (`consoleErrors: []`, `pageErrors: []`) en los 7 pasos.

### 4. [VERIFICADO — sin acción] El código de desbloqueo / PIN no se persiste en localStorage

- `final-results.json → 07_unlock_no_persist`: `unlockLeaked: false`. El dato persistido en `receiptData` contiene solo 7 claves (`clientName, phone, device, issue, imei, advancePayment, budget`) — **sin `unlockCode`**.
- Coincide con la intención documentada en `src/app/(tabs)/receive.tsx` ("unlockCode is intentionally NOT persisted"). Seguridad correcta.

### 5. [VERIFICADO — sin acción] Licencia de prueba de 90 días confirmada en UI

- `reload-probe.json → B_licencia_admin`: "Plan: **Prueba - 3 Meses** | Vence: 2026-11-(**90 días restantes**)" y "Clave actual: **TRIAL-90DAYS-ACTIVE**" visibles en Admin.
- Nota: el valor `daysRemaining: null` en `final-results.json` fue un artefacto del extractor de texto (trunca cadenas a 60 caracteres), no un bug de la app.

---

## Estado

| # | Hallazgo | Estado |
|---|----------|--------|
| 1 | Sesión no sobrevivía a recarga/navegación directa | **FIX desplegado y verificado en producción** (`prod-reload-probe.json`: tras reload queda en `/` con dashboard; commits `e2de298` + `36d640b`) |
| 2 | Deploy de Vercel posiblemente desactualizado | **RESUELTO** — redeploy automático vía GitHub → Vercel confirmado con el fix activo |
| 3 | Flujo core 7/7 | Verificado OK |
| 4 | PIN no persistido | Verificado OK (seguridad) |
| 5 | Licencia 90 días | Verificado OK |

**Post-auditoría (2026-08-08):** migración a **auth real de Supabase** desplegada (commit `07bfc34`): registro con email + verificación OTP de 6 dígitos y Google OAuth en producción, con `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY` configuradas en Vercel. Storage del navegador limpio; base de datos Supabase vacía y lista para registros reales.